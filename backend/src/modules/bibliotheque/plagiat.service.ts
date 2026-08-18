import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { StatutSuspicionPlagiat, SuspicionPlagiat } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';

/**
 * Détection de doublons dans le dépôt. Le service regroupe toute la logique
 * « extraction PDF + empreinte + comparaison + acquittement » : c'est l'unité
 * qui touche aux nouvelles colonnes (`contenuTexte`, `empreinteHash`,
 * `indicePlagiat`) et au modèle `SuspicionPlagiat`, et qui tourne derrière
 * les POST/PUT du contrôleur `bibliotheque`.
 */
const SEUIL_JACCARD = 0.8;
const TAILLE_MIN_JACCARD = 30;

/**
 * Ce que la fiche d'un document suspect doit porter pour être lisible à
 * l'écran : sans `auteurs` ni `departement`, la carte de suspicion n'affichait
 * qu'un titre et deux tirets, alors qu'on y arbitre une accusation.
 */
const DOCUMENT_SUSPECT_SELECT = {
  id: true,
  titre: true,
  type: true,
  auteurs: true,
  deposeParId: true,
  empreinteHash: true,
  departement: { select: { id: true, nom: true } },
} as const;

/**
 * Découpe une data-url en mime + octets. Tolère une chaîne sans en-tête
 * `data:` (cas rare, ex : payload déjà extrait) : on tente alors le base64
 * brut sans mime.
 */
function decouperDataUrl(dataUrl: string): { mime?: string; octets: Buffer } {
  const virgule = dataUrl.indexOf(',');
  const enTete = virgule === -1 ? '' : dataUrl.slice(0, virgule);
  const base64 = virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1);
  return { mime: /^data:([^;]+)/.exec(enTete)?.[1], octets: Buffer.from(base64, 'base64') };
}

/** Tokenise un texte en sac de mots normalisés (lowercase, sans accents, ≥ 3). */
function tokeniser(texte: string): Set<string> {
  const sac = new Set<string>();
  const nettoye = texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  for (const mot of nettoye.split(/\s+/)) {
    if (mot.length >= 3) sac.add(mot);
  }
  return sac;
}

/**
 * Indice de Jaccard entre deux ensembles de tokens. Retourne un score entre 0
 * et 1. Renvoie `0` si l'un des ensembles est trop petit : sur quelques mots,
 * la « similarité » n'a pas de sens (un mot commun sur quatre donne déjà 25 %).
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size < TAILLE_MIN_JACCARD || b.size < TAILLE_MIN_JACCARD) return 0;
  const inter = new Set<string>();
  const plusPetit = a.size <= b.size ? a : b;
  const plusGrand = a.size <= b.size ? b : a;
  for (const tok of plusPetit) {
    if (plusGrand.has(tok)) inter.add(tok);
  }
  const union = a.size + b.size - inter.size;
  return union === 0 ? 0 : inter.size / union;
}

/** Texte à comparer : PDF d'abord, résumé en repli, sinon vide. */
function texteDeComparaison(doc: {
  contenuTexte?: string | null;
  resume?: string | null;
  titre?: string | null;
  motsClefs?: string[];
}): string {
  const parties = [doc.contenuTexte, doc.resume, doc.titre, ...(doc.motsClefs ?? [])];
  return parties.filter(Boolean).join('\n');
}

/**
 * Normalise un texte extrait de PDF : on retire les espaces multiples et les
 * sauts de ligne excédentaires qui polluent les résultats de `pdf-parse` sur
 * certains documents.
 */
function nettoyerTextePdf(brut: string): string {
  return brut.replace(/\s+/g, ' ').trim();
}

export interface ContenuExtrait {
  contenuTexte: string | null;
  empreinteHash: string | null;
}

@Injectable()
export class PlagiatService {
  private readonly logger = new Logger(PlagiatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extrait le texte d'un PDF et calcule son empreinte SHA-256. Le hash porte
   * sur les octets du fichier décodé : deux scans d'un même document donnent
   * le même hash même si leur représentation PDF diffère marginalement. Un
   * PDF corrompu ou mal formé ne fait pas échouer la création — on stocke
   * `contenuTexte = null` et on loggue l'incident pour reprise manuelle.
   */
  async preparerContenu(fichier: string | null | undefined, typeMime?: string | null): Promise<ContenuExtrait> {
    if (!fichier) return { contenuTexte: null, empreinteHash: null };
    const { mime, octets } = decouperDataUrl(fichier);
    const mimeEffectif = typeMime ?? mime;
    const empreinteHash = createHash('sha256').update(octets).digest('hex');

    if (!mimeEffectif || mimeEffectif !== 'application/pdf') {
      return { contenuTexte: null, empreinteHash };
    }

    try {
      const parser = new PDFParse({ data: new Uint8Array(octets) });
      try {
        const resultat = await parser.getText();
        const texte = nettoyerTextePdf(resultat.text ?? '');
        return { contenuTexte: texte || null, empreinteHash };
      } finally {
        await parser.destroy();
      }
    } catch (e: any) {
      this.logger.warn(
        `Échec d'extraction PDF (${e?.message ?? e}). Document enregistré sans texte.`,
      );
      return { contenuTexte: null, empreinteHash };
    }
  }

  /**
   * Variante silencieuse de `detecterDoublons` : l'erreur est attrapée et
   * journalisée mais n'est pas propagée. Utilisée par le dépôt / la mise à
   * jour de document : un échec de détection ne doit pas faire échouer la
   * création, le recalcul global rattrapera.
   */
  async detecterSilencieusement(documentId: string): Promise<{ creees: number; ignorees: number } | null> {
    try {
      return await this.detecterDoublons(documentId);
    } catch (e: any) {
      this.logger.warn(
        `Détection de doublons en échec pour ${documentId} : ${e?.message ?? e}`,
      );
      return null;
    }
  }

  /**
   * Compare un document (déjà persisté) à tous les autres documents du dépôt
   * et crée une `SuspicionPlagiat` à chaque match. Une seule suspicion par
   * paire : on range la paire dans l'ordre canonique (idMin, idMax) pour
   * confondre (A,B) et (B,A). Les suspicions déjà tranchées ne sont pas
   * écrasées — l'arbitrage humain reste prioritaire.
   */
  async detecterDoublons(documentId: string): Promise<{ creees: number; ignorees: number }> {
    const cible = await this.prisma.documentDepot.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        titre: true,
        contenuTexte: true,
        resume: true,
        motsClefs: true,
        empreinteHash: true,
      },
    });
    if (!cible) return { creees: 0, ignorees: 0 };

    const autres = await this.prisma.documentDepot.findMany({
      where: { id: { not: documentId } },
      select: {
        id: true,
        titre: true,
        contenuTexte: true,
        resume: true,
        motsClefs: true,
        empreinteHash: true,
      },
    });

    const tokensCible = tokeniser(texteDeComparaison(cible));
    let creees = 0;
    let ignorees = 0;
    const nouvelIndice = cible.empreinteHash ? 100 : 0;

    for (const autre of autres) {
      let score = 0;
      let motif: 'hash' | 'jaccard' | null = null;
      if (cible.empreinteHash && cible.empreinteHash === autre.empreinteHash) {
        score = 100;
        motif = 'hash';
      } else {
        const tokensAutre = tokeniser(texteDeComparaison(autre));
        const ratio = jaccard(tokensCible, tokensAutre);
        if (ratio >= SEUIL_JACCARD) {
          score = Math.round(ratio * 100);
          motif = 'jaccard';
        }
      }
      if (!motif) continue;
      const [aId, bId] = [cible.id, autre.id].sort();
      const existante = await this.prisma.suspicionPlagiat.findFirst({
        where: {
          OR: [
            { documentAId: aId, documentBId: bId },
            { documentAId: bId, documentBId: aId },
          ],
        },
      });
      if (existante) {
        if (existante.statut === StatutSuspicionPlagiat.EN_ATTENTE && existante.score < score) {
          await this.prisma.suspicionPlagiat.update({
            where: { id: existante.id },
            data: { score },
          });
          creees += 1;
        } else {
          ignorees += 1;
        }
        continue;
      }
      await this.prisma.suspicionPlagiat.create({
        data: {
          documentAId: aId,
          documentBId: bId,
          score,
          statut: StatutSuspicionPlagiat.EN_ATTENTE,
        },
      });
      creees += 1;
    }

    if (nouvelIndice > 0) {
      await this.prisma.documentDepot.update({
        where: { id: cible.id },
        data: { indicePlagiat: nouvelIndice },
      });
    }
    return { creees, ignorees };
  }

  /**
   * Dashboard admin : liste des suspicions en attente (les plus fortes en
   * tête), KPIs agrégés et top 10 des paires par score.
   */
  async dashboard() {
    const [suspicions, total, moyenneRow, topDix, parStatut] = await Promise.all([
      this.prisma.suspicionPlagiat.findMany({
        where: { statut: StatutSuspicionPlagiat.EN_ATTENTE },
        orderBy: [{ score: 'desc' }, { detecteLe: 'desc' }],
        include: {
          // La carte de suspicion nomme les auteurs et le département : sans
          // eux elle n'affichait que des tirets.
          documentA: { select: DOCUMENT_SUSPECT_SELECT },
          documentB: { select: DOCUMENT_SUSPECT_SELECT },
        },
      }),
      this.prisma.suspicionPlagiat.count(),
      this.prisma.suspicionPlagiat.aggregate({ _avg: { score: true } }),
      this.prisma.suspicionPlagiat.findMany({
        orderBy: [{ score: 'desc' }, { detecteLe: 'desc' }],
        take: 10,
        include: {
          documentA: { select: { id: true, titre: true } },
          documentB: { select: { id: true, titre: true } },
        },
      }),
      this.prisma.suspicionPlagiat.groupBy({
        by: ['statut'],
        _count: { _all: true },
      }),
    ]);

    return {
      suspicions,
      kpis: {
        total,
        scoreMoyen: Number((moyenneRow._avg.score ?? 0).toFixed(2)),
        enAttente: parStatut.find((l) => l.statut === StatutSuspicionPlagiat.EN_ATTENTE)?._count._all ?? 0,
        acquittees: parStatut.find((l) => l.statut === StatutSuspicionPlagiat.ACQUITTE)?._count._all ?? 0,
        confirmees: parStatut.find((l) => l.statut === StatutSuspicionPlagiat.CONFIRME)?._count._all ?? 0,
      },
      topDix,
    };
  }

  async detail(id: string) {
    const suspicion = await this.prisma.suspicionPlagiat.findUnique({
      where: { id },
      include: {
        documentA: {
          include: {
            departement: true,
            deposePar: { select: { id: true, nom: true, prenom: true } },
          },
        },
        documentB: {
          include: {
            departement: true,
            deposePar: { select: { id: true, nom: true, prenom: true } },
          },
        },
        acquittePar: { select: { id: true, nom: true, prenom: true, role: true } },
      },
    });
    if (!suspicion) throw new NotFoundException('Suspicion introuvable');
    // Le payload FTS (contenuTexte) et le data-url (fichier) sont trop lourds
    // pour figurer dans la réponse d'un détail : on les retire à la source.
    const copie = JSON.parse(JSON.stringify(suspicion)) as Record<string, unknown>;
    const a = copie.documentA as Record<string, unknown> | undefined;
    const b = copie.documentB as Record<string, unknown> | undefined;
    if (a) {
      delete a.fichier;
      delete a.contenuTexte;
    }
    if (b) {
      delete b.fichier;
      delete b.contenuTexte;
    }
    return copie;
  }

  /**
   * Acquittement humain : l'admin (ou la direction) tranche. Le couple
   * « ACQUITTE » + commentaire alimente le journal d'audit pour qu'on
   * retrouve plus tard la justification.
   */
  async acquitter(
    id: string,
    decision: 'ACQUITTE' | 'CONFIRME',
    utilisateur: AuthUser,
    commentaire?: string,
  ): Promise<SuspicionPlagiat> {
    const existante = await this.prisma.suspicionPlagiat.findUnique({ where: { id } });
    if (!existante) throw new NotFoundException('Suspicion introuvable');
    if (
      decision !== StatutSuspicionPlagiat.ACQUITTE &&
      decision !== StatutSuspicionPlagiat.CONFIRME
    ) {
      throw new BadRequestException('Décision de plagiat invalide');
    }
    const miseAJour = await this.prisma.suspicionPlagiat.update({
      where: { id },
      data: {
        statut: decision,
        acquitteParId: utilisateur.id,
        acquitteLe: new Date(),
        commentaire: commentaire ?? existante.commentaire,
      },
      include: {
        documentA: { select: { id: true, titre: true } },
        documentB: { select: { id: true, titre: true } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: utilisateur.id,
        action: `PLAGIAT_${decision}`,
        entite: 'SuspicionPlagiat',
        entiteId: id,
        details: commentaire
          ? `${miseAJour.documentA.titre} ↔ ${miseAJour.documentB.titre} : ${commentaire}`
          : `${miseAJour.documentA.titre} ↔ ${miseAJour.documentB.titre}`,
      },
    });
    return miseAJour;
  }

  /**
   * Recalcul complet : balaye toutes les paires du dépôt et crée/met à jour
   * les suspicions. Coûteux (O(n²) en mémoire) — c'est pour ça qu'il est
   * gardé derrière un endpoint ADMIN. Les paires déjà tranchées ne sont pas
   * écrasées.
   */
  async recalculerComplet(): Promise<{ creees: number; misesAJour: number; ignorees: number }> {
    const docs = await this.prisma.documentDepot.findMany({
      select: {
        id: true,
        titre: true,
        contenuTexte: true,
        resume: true,
        motsClefs: true,
        empreinteHash: true,
      },
    });
    const tokensParDoc = new Map<string, Set<string>>();
    for (const d of docs) tokensParDoc.set(d.id, tokeniser(texteDeComparaison(d)));

    let creees = 0;
    let misesAJour = 0;
    let ignorees = 0;

    for (let i = 0; i < docs.length; i++) {
      const a = docs[i];
      const ta = tokensParDoc.get(a.id) ?? new Set<string>();
      for (let j = i + 1; j < docs.length; j++) {
        const b = docs[j];
        let score = 0;
        if (a.empreinteHash && a.empreinteHash === b.empreinteHash) {
          score = 100;
        } else {
          const tb = tokensParDoc.get(b.id) ?? new Set<string>();
          const ratio = jaccard(ta, tb);
          if (ratio >= SEUIL_JACCARD) score = Math.round(ratio * 100);
        }
        if (score === 0) continue;
        const [aId, bId] = [a.id, b.id].sort();
        const existante = await this.prisma.suspicionPlagiat.findFirst({
          where: {
            OR: [
              { documentAId: aId, documentBId: bId },
              { documentAId: bId, documentBId: aId },
            ],
          },
        });
        if (existante) {
          if (existante.statut === StatutSuspicionPlagiat.EN_ATTENTE && existante.score < score) {
            await this.prisma.suspicionPlagiat.update({
              where: { id: existante.id },
              data: { score },
            });
            misesAJour += 1;
          } else {
            ignorees += 1;
          }
          continue;
        }
        await this.prisma.suspicionPlagiat.create({
          data: {
            documentAId: aId,
            documentBId: bId,
            score,
            statut: StatutSuspicionPlagiat.EN_ATTENTE,
          },
        });
        creees += 1;
      }
    }

    // Met à jour l'indicePlagiat agrégé par document (le max des suspicions
    // où il apparaît, hors ACQUITTE).
    const lignes = await this.prisma.suspicionPlagiat.findMany({
      where: { statut: { not: StatutSuspicionPlagiat.ACQUITTE } },
      select: { documentAId: true, documentBId: true, score: true },
    });
    const maxParDoc = new Map<string, number>();
    for (const l of lignes) {
      maxParDoc.set(l.documentAId, Math.max(maxParDoc.get(l.documentAId) ?? 0, l.score));
      maxParDoc.set(l.documentBId, Math.max(maxParDoc.get(l.documentBId) ?? 0, l.score));
    }
    for (const [docId, score] of maxParDoc) {
      await this.prisma.documentDepot.update({
        where: { id: docId },
        data: { indicePlagiat: score },
      });
    }

    this.logger.log(
      `Recalcul complet : ${creees} créées, ${misesAJour} mises à jour, ${ignorees} ignorées.`,
    );
    return { creees, misesAJour, ignorees };
  }
}
