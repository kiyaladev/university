import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { t } from '../../common/i18n';
import { PDFParse } from 'pdf-parse';
import { StatutSuspicionPlagiat, SuspicionPlagiat } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { journaliser } from '../../common/audit';

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
/**
 * Clé d'une paire de documents, indépendante de l'ordre : le schéma autorise
 * (A, B) comme (B, A), et la comparaison doit retrouver la même ligne.
 */
function clePaire(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

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

/**
 * Suspicion projetée pour le journal : la vie du dossier d'arbitrage —
 * la paire de documents comparés, le statut, l'horodatage de détection, qui a
 * tranché et quand.
 *
 * Le score est conservé : c'est la mesure sur laquelle le dossier a été
 * arbitré, et un pourcentage de similarité ne dit rien du texte. En revanche
 * le commentaire d'arbitrage reste hors journal — il est écrit librement par
 * l'agent et peut citer le document ou l'étudiant — et le titre, les auteurs et
 * l'empreinte des documents ne sont jamais recopiés : c'est le contenu du
 * dépôt qui doit rester absent du journal.
 */
function instantaneSuspicion(suspicion: {
  id: string;
  documentAId?: string;
  documentBId?: string;
  score?: number | null;
  statut?: StatutSuspicionPlagiat | null;
  detecteLe?: Date | string | null;
  acquitteParId?: string | null;
  acquitteLe?: Date | string | null;
  commentaire?: string | null;
}) {
  return {
    id: suspicion.id,
    documentAId: suspicion.documentAId ?? null,
    documentBId: suspicion.documentBId ?? null,
    statut: suspicion.statut ?? null,
    score: suspicion.score ?? null,
    detecteLe: suspicion.detecteLe ?? null,
    acquitteParId: suspicion.acquitteParId ?? null,
    acquitteLe: suspicion.acquitteLe ?? null,
    // Présence seule du motif d'arbitrage, jamais son texte.
    commentaireFourni: Boolean(suspicion.commentaire),
  };
}

/**
 * Document projeté pour le journal : on ne note que l'indice de plagiat
 * affiché au dépôt et la *présence* de ce qui a servi à le calculer. Le titre,
 * les auteurs, le résumé, le texte extrait, le fichier et l'empreinte — donc
 * l'identité de l'auteur du document déposé — restent hors journal.
 */
function instantaneDocumentDepot(document: {
  id: string;
  type?: string | null;
  indicePlagiat?: number | null;
  contenuTexte?: string | null;
  empreinteHash?: string | null;
}) {
  return {
    id: document.id,
    type: document.type ?? null,
    indicePlagiat: document.indicePlagiat ?? null,
    texteExtrait: Boolean(document.contenuTexte),
    empreintePresente: Boolean(document.empreinteHash),
  };
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
   *
   * La lecture (comparaison, appariement) précède les écritures : les
   * écritures et leurs traces partagent ensuite une seule transaction, comme
   * les décisions d'arbitrage. Chaque nouvelle suspicion et chaque indice
   * réellement modifié au dépôt produit une entrée ; la mise à jour d'un score
   * d'un dossier déjà ouvert est journalisée, mais le balayage complet
   * (`recalculerComplet`) ne l'est pas : il produirait une entrée par
   * document du dépôt alors qu'une seule trace de synthèse suffit.
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
        type: true,
        indicePlagiat: true,
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
    // Suspicion à écrire : création si elle est inconnue, mise à jour du score
    // si elle est encore en attente et que la mesure progresse.
    const aEcrire: Array<{
      aId: string;
      bId: string;
      score: number;
      existante: {
        id: string;
        documentAId: string;
        documentBId: string;
        score: number;
        statut: StatutSuspicionPlagiat;
        detecteLe: Date;
        acquitteParId: string | null;
        acquitteLe: Date | null;
        commentaire: string | null;
      } | null;
    }> = [];

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
          aEcrire.push({ aId, bId, score, existante });
          creees += 1;
        } else {
          ignorees += 1;
        }
        continue;
      }
      aEcrire.push({ aId, bId, score, existante: null });
      creees += 1;
    }

    // Écrire la valeur déjà appliquée ne change rien : l'écriture reste (elle
    // porte aussi le `updatedAt` du document), mais elle ne mérite pas de trace.
    const indiceChange = nouvelIndice > 0 && cible.indicePlagiat !== nouvelIndice;
    const instantaneAvant = instantaneDocumentDepot(cible);

    if (aEcrire.length || indiceChange) {
      await this.prisma.$transaction(async (tx) => {
        for (const p of aEcrire) {
          if (p.existante) {
            const avant = instantaneSuspicion(p.existante);
            const apres = { ...avant, score: p.score };
            await tx.suspicionPlagiat.update({ where: { id: p.existante.id }, data: { score: p.score } });
            await journaliser(tx, null, 'PLAGIAT_SUSPICION_REEVALUEE', 'SuspicionPlagiat', p.existante.id, {
              avant,
              apres,
              champsModifies: ['score'],
            });
            continue;
          }
          const creee = await tx.suspicionPlagiat.create({
            data: {
              documentAId: p.aId,
              documentBId: p.bId,
              score: p.score,
              statut: StatutSuspicionPlagiat.EN_ATTENTE,
            },
          });
          await journaliser(tx, null, 'PLAGIAT_SUSPICION_OUVERTE', 'SuspicionPlagiat', creee.id, {
            avant: null,
            apres: instantaneSuspicion(creee),
          });
        }

        if (nouvelIndice > 0) {
          await tx.documentDepot.update({
            where: { id: cible.id },
            data: { indicePlagiat: nouvelIndice },
          });
          if (indiceChange) {
            await journaliser(tx, null, 'PLAGIAT_INDICE_MAJ', 'DocumentDepot', cible.id, {
              avant: instantaneAvant,
              apres: { ...instantaneAvant, indicePlagiat: nouvelIndice },
              champsModifies: ['indicePlagiat'],
              suspicionsCreees: aEcrire.filter((p) => !p.existante).length,
            });
          }
        }
      });
    }
    return { creees, ignorees };
  }

  /**
   * Dashboard admin : liste des suspicions en attente (les plus fortes en
   * tête), KPIs agrégés et top 10 des paires par score. Lecture pure : ni
   * transaction, ni entrée de journal.
   */
  async dashboard() {
    const [suspicions, total, moyenneRow, topDix, parStatut] = await Promise.all([
      this.prisma.suspicionPlagiat.findMany({
        where: { statut: StatutSuspicionPlagiat.EN_ATTENTE },
        orderBy: [{ score: 'desc' }, { detecteLe: 'desc' }],
        take: 100,
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

  /** Fiche d'une suspicion : lecture, jamais journalisée. */
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
    if (!suspicion) throw new NotFoundException(t('bibliotheque.suspicion_introuvable'));
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
   *
   * C'est le seul arbitrage du module, donc la seule décision qu'un compte peut
   * être tenu pour responsable : elle est journalisée avant/après, et dans la
   * transaction qui la porte — une décision tracée alors que la mise à jour a
   * échoué (ou l'inverse) fausserait le journal. Le motif reste hors trace :
   * sa présence seule est notée.
   */
  async acquitter(
    id: string,
    decision: 'ACQUITTE' | 'CONFIRME',
    utilisateur: AuthUser,
    commentaire?: string,
  ): Promise<SuspicionPlagiat> {
    return this.prisma.$transaction(async (tx) => {
      const existante = await tx.suspicionPlagiat.findUnique({ where: { id } });
      if (!existante) throw new NotFoundException(t('bibliotheque.suspicion_introuvable'));
      if (
        decision !== StatutSuspicionPlagiat.ACQUITTE &&
        decision !== StatutSuspicionPlagiat.CONFIRME
      ) {
        throw new BadRequestException(t('bibliotheque.decision_de_plagiat_invalide'));
      }
      const avant = instantaneSuspicion(existante);
      const miseAJour = await tx.suspicionPlagiat.update({
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
      await journaliser(tx, utilisateur, `PLAGIAT_${decision}`, 'SuspicionPlagiat', id, {
        avant,
        apres: instantaneSuspicion(miseAJour),
        champsModifies: [
          'statut',
          'acquitteParId',
          'acquitteLe',
          ...(commentaire ? ['commentaire'] : []),
        ],
      });
      return miseAJour;
    });
  }

  /**
   * Recalcul complet : balaye toutes les paires du dépôt et crée/met à jour
   * les suspicions. Coûteux (O(n²) en mémoire) — c'est pour ça qu'il est
   * gardé derrière un endpoint ADMIN. Les paires déjà tranchées ne sont pas
   * écrasées.
   *
   * Ce balayage n'écrit aucune entrée de journal, contrairement à la détection
   * d'un dépôt : il toucherait presque tous les documents du fonds, et une
   * trace par document noierait le journal sans rien apprendre. Qui l'a
   * déclenché, et le bilan Created/updated/ignored, sont déjà portés par la
   * trace unique `PLAGIAT_RECALCUL` du contrôleur.
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

    // Les paires déjà connues sont chargées une seule fois. La version
    // précédente interrogeait `suspicionPlagiat` pour chaque paire scored :
    // O(n²) requêtes dans une même requête HTTP, soit ~500 000 allers-retours
    // pour mille documents.
    const connues = await this.prisma.suspicionPlagiat.findMany({
      select: { id: true, documentAId: true, documentBId: true, score: true, statut: true },
    });
    const parPaire = new Map<string, (typeof connues)[number]>();
    for (const s of connues) parPaire.set(clePaire(s.documentAId, s.documentBId), s);

    let creees = 0;
    let misesAJour = 0;
    let ignorees = 0;
    const aMettreAJour: Array<{ id: string; score: number }> = [];
    const aCreer: Array<{
      documentAId: string;
      documentBId: string;
      score: number;
      statut: StatutSuspicionPlagiat;
    }> = [];

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
        const existante = parPaire.get(clePaire(aId, bId));
        if (existante) {
          if (existante.statut === StatutSuspicionPlagiat.EN_ATTENTE && existante.score < score) {
            aMettreAJour.push({ id: existante.id, score });
            misesAJour += 1;
          } else {
            ignorees += 1;
          }
          continue;
        }
        aCreer.push({ documentAId: aId, documentBId: bId, score, statut: StatutSuspicionPlagiat.EN_ATTENTE });
        creees += 1;
      }
    }

    for (const m of aMettreAJour) {
      await this.prisma.suspicionPlagiat.update({ where: { id: m.id }, data: { score: m.score } });
    }
    if (aCreer.length) {
      await this.prisma.suspicionPlagiat.createMany({ data: aCreer });
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
