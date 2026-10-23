/**
 * Module Tirage — tirage et distribution sécurisée des épreuves.
 *
 * Cycle de vie : PROGRAMME → IMPRIME → MIS_SOUS_PLI → DISTRIBUE → RECUPERE (ou ANNULE).
 *
 * Chaque transition est gardée par le service :
 *   - `PROGRAMME → IMPRIME` exige que l'empreinte fournie dans la requête
 *     corresponde à l'empreinte source enregistrée ;
 *   - les transitions ultérieures rejettent toute étape sautée.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { t } from '../../../common/i18n';
import { Prisma, StadeTirage } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { Paginated } from '../../../common/dto';
import { chargerEtablissement, echapper, pageA4, PALETTE_IMPRESSION as P } from '../../../common/impression/index';
import { exigerAnneeOuverte } from '../../../common/annee';
import { CreateTirageDto, ImprimerTirageDto, TirageQueryDto, UpdateStadeTirageDto } from './tirage.dto';
import { paginer, pagine } from '../../../common/pagination';
import { journaliser } from '../../../common/audit';

const TIRAGE_INCLUDE = {
  examen: {
    include: {
      matiere: true,
      promotion: true,
      annee: true,
      salle: { select: { id: true, code: true, nom: true } },
      surveillant: { select: { id: true, nom: true, prenom: true } },
    },
  },
  imprimeur: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.TirageInclude;

/** Transitions autorisées (source → cible). Pas de saut. */
const TRANSITIONS: Record<StadeTirage, StadeTirage | null> = {
  PROGRAMME: StadeTirage.IMPRIME,
  IMPRIME: StadeTirage.MIS_SOUS_PLI,
  MIS_SOUS_PLI: StadeTirage.DISTRIBUE,
  DISTRIBUE: StadeTirage.RECUPERE,
  RECUPERE: null,
  ANNULE: null,
};

@Injectable()
export class TirageService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------- lecture

  async liste(query: TirageQueryDto): Promise<Paginated<any>> {
    const pagination = paginer(query);

    const where: Prisma.TirageWhereInput = {
      ...(query.stade ? { stade: query.stade } : {}),
      ...(query.examenId ? { examenId: query.examenId } : {}),
      ...(query.imprimeurId ? { imprimeurId: query.imprimeurId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.tirage.findMany({
        where,
        include: TIRAGE_INCLUDE,
        orderBy: { dateTirage: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.tirage.count({ where }),
    ]);
    return pagine(data.map(masquerEmpreinte), total, pagination);
  }

  async trouver(id: string) {
    return masquerEmpreinte(await this.charger(id));
  }

  /** Lecture interne, empreinte complète (bordereau). */
  private async charger(id: string) {
    const tirage = await this.prisma.tirage.findUnique({
      where: { id },
      include: TIRAGE_INCLUDE,
    });
    if (!tirage) throw new NotFoundException(t('tirage.tirage_introuvable'));
    return tirage;
  }

  // ---------------------------------------------------- création

  async creer(dto: CreateTirageDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const examen = await tx.examen.findUnique({
        where: { id: dto.examenId },
        select: { id: true, codeExamen: true, anneeId: true },
      });
      if (!examen) throw new BadRequestException(t('tirage.examen_introuvable'));
      await exigerAnneeOuverte(tx, examen.anneeId);

      const tirage = await tx.tirage.create({
        data: {
          examenId: dto.examenId,
          dateTirage: new Date(dto.dateTirage),
          nbExemplaires: dto.nbExemplaires,
          empreinteSource: dto.empreinteSource.toLowerCase(),
          circuitImpression: dto.circuitImpression ?? null,
          notes: dto.notes ?? null,
          stade: StadeTirage.PROGRAMME,
        },
        include: TIRAGE_INCLUDE,
      });

      await journaliser(
        tx,
        user,
        'TIRAGE_CREE',
        'Tirage',
        tirage.id,
        `Examen ${examen.codeExamen} — ${tirage.nbExemplaires} ex. — empreinte ${tirage.empreinteSource.slice(0, 12)}…`,
      );
      return masquerEmpreinte(tirage);
    });
  }

  // ------------------------------------------------ transitions

  /**
   * PROGRAMME → IMPRIME.
   * L'empreinte du fichier à imprimer doit impérativement correspondre à
   * celle qui a été déclarée à la création : c'est la garantie qu'aucune
   * version corrompue ou substituée n'a glissé dans le circuit. L'imprimeur
   * est consigné.
   */
  async imprimer(id: string, dto: ImprimerTirageDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const tirage = await this.trouverDans(tx, id);
      await exigerAnneeOuverte(tx, tirage.examen.anneeId);
      if (tirage.stade !== StadeTirage.PROGRAMME) {
        throw new BadRequestException(
          t('tirage.impression_possible_uniquement_depuis_programme', { stade: tirage.stade }),
        );
      }
      if (!empreintesEgales(dto.empreinteSource, tirage.empreinteSource)) {
        throw new BadRequestException(t('tirage.empreinte_source_fournie_ne_correspond_pas_a_celle_enregistr'));
      }

      const maj = await tx.tirage.update({
        where: { id },
        data: {
          stade: StadeTirage.IMPRIME,
          imprimeurId: user.id,
          empreinteExemplaires: dto.empreinteExemplaires ?? null,
        },
        include: TIRAGE_INCLUDE,
      });

      await journaliser(
        tx,
        user,
        'TIRAGE_IMPRIME',
        'Tirage',
        id,
        `${tirage.nbExemplaires} ex. — empreinte ${tirage.empreinteSource.slice(0, 12)}…`,
      );
      return maj;
    });
  }

  /** Transition générique avec garde de séquence. */
  private async transition(
    id: string,
    dto: UpdateStadeTirageDto,
    user: AuthUser,
    actionAudit: string,
    stadeAttendu: StadeTirage,
  ) {
    if (dto.stade !== stadeAttendu) {
      throw new BadRequestException(
        t('tirage.transition_impossible_depuis_tirage_stade_vers_dto_stade', {
          'tirage.stade': stadeAttendu,
          'dto.stade': dto.stade,
        }),
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const tirage = await this.trouverDans(tx, id);
      await exigerAnneeOuverte(tx, tirage.examen.anneeId);
      const cible = TRANSITIONS[tirage.stade];
      if (!cible || cible !== dto.stade) {
        throw new BadRequestException(
          t('tirage.transition_impossible_depuis_tirage_stade_vers_dto_stade', {
            'tirage.stade': tirage.stade,
            'dto.stade': dto.stade,
          }),
        );
      }
      const maj = await tx.tirage.update({
        where: { id },
        data: {
          stade: dto.stade,
          ...(dto.notes ? { notes: dto.notes } : {}),
        },
        include: TIRAGE_INCLUDE,
      });
      await journaliser(tx, user, actionAudit, 'Tirage', id, `${tirage.stade} → ${maj.stade}`);
      return maj;
    });
  }

  private async trouverDans(db: Prisma.TransactionClient, id: string) {
    const initial = await db.tirage.findUnique({ where: { id }, include: TIRAGE_INCLUDE });
    if (!initial) throw new NotFoundException(t('tirage.tirage_introuvable'));
    // Année puis tirage : même ordre que les autres écritures académiques.
    await exigerAnneeOuverte(db, initial.examen.anneeId);
    await db.$queryRaw`SELECT id FROM "Tirage" WHERE id = ${id} FOR UPDATE`;
    const tirage = await db.tirage.findUnique({ where: { id }, include: TIRAGE_INCLUDE });
    if (!tirage) throw new NotFoundException(t('tirage.tirage_introuvable'));
    return tirage;
  }

  mettreSousPli(id: string, dto: UpdateStadeTirageDto, user: AuthUser) {
    return this.transition(id, dto, user, 'TIRAGE_MIS_SOUS_PLI', StadeTirage.MIS_SOUS_PLI);
  }

  distribuer(id: string, dto: UpdateStadeTirageDto, user: AuthUser) {
    return this.transition(id, dto, user, 'TIRAGE_DISTRIBUE', StadeTirage.DISTRIBUE);
  }

  recuperer(id: string, dto: UpdateStadeTirageDto, user: AuthUser) {
    return this.transition(id, dto, user, 'TIRAGE_RECUPERE', StadeTirage.RECUPERE);
  }

  /**
   * Annulation possible seulement tant que rien n'a été imprimé. Au-delà, on
   * garde la trace mais aucune impression supplémentaire ne partira : il
   * faut créer un nouveau tirage.
   */
  async annuler(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const tirage = await this.trouverDans(tx, id);
      await exigerAnneeOuverte(tx, tirage.examen.anneeId);
      if (tirage.stade !== StadeTirage.PROGRAMME) {
        throw new BadRequestException(
          t('tirage.tirage_tirage_stade_annulation_possible_uniquement_depuis_program', { stade: tirage.stade }),
        );
      }
      const maj = await tx.tirage.update({
        where: { id },
        data: { stade: StadeTirage.ANNULE },
        include: TIRAGE_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'TIRAGE_ANNULE',
        'Tirage',
        id,
        `Annulation du tirage de l'examen ${tirage.examen.codeExamen}`,
      );
      return maj;
    });
  }

  // ----------------------------------------------------- bordereau

  /**
   * Bordereau A4 (remis au destinataire des épreuves). Ouvert dans un
   * nouvel onglet : pas d'en-tête Authorization, jeton vérifié côté
   * contrôleur avant l'appel.
   */
  async imprimerBordereau(id: string): Promise<string> {
    // Avant impression, le bordereau ne révèle pas non plus l'empreinte attendue.
    const t = masquerEmpreinte(await this.charger(id));
    const empreinteCourte = (h: string | null | undefined) => (h ? `${h.slice(0, 16)}…` : '—');

    const etablissement = await chargerEtablissement(this.prisma);

    return pageA4({
      titre: `Bordereau tirage — ${t.examen.codeExamen}`,
      lang: 'fr',
      etablissement,
      styles: STYLE_BORDEREAU,
      entete: `<div class="titre">Bordereau de tirage — ${echapper(t.examen.codeExamen)}</div>
    <div>${echapper(t.examen.intitule)}</div>`,
      corps: `<div class="meta">
    <div><b>Mention :</b> ${echapper(t.examen.promotion.nom)}</div>
    <div><b>Matière :</b> ${echapper(t.examen.matiere.intitule)}</div>
    <div><b>Année :</b> ${echapper(t.examen.annee.libelle)}</div>
    <div><b>Salle :</b> ${echapper(t.examen.salle?.code ?? '—')}</div>
    <div><b>Date examen :</b> ${echapper(new Date(t.examen.dateExamen).toLocaleString('fr-FR'))}</div>
    <div><b>Date tirage :</b> ${echapper(new Date(t.dateTirage).toLocaleString('fr-FR'))}</div>
    <div><b>Exemplaires :</b> ${t.nbExemplaires}</div>
    <div><b>Stade :</b> <span class="badge ${t.stade}">${t.stade}</span></div>
    <div style="grid-column: span 2;"><b>Empreinte source (SHA-256) :</b> <code>${echapper(t.empreinteSource)}</code></div>
    ${t.empreinteExemplaires ? `<div style="grid-column: span 2;"><b>Empreintes exemplaires :</b> <code>${echapper(empreinteCourte(t.empreinteExemplaires))}</code></div>` : ''}
  </div>
  <div class="signatures">
    <div class="signature">L'imprimeur<br /><small>${t.imprimeur ? `${echapper(t.imprimeur.prenom)} ${echapper(t.imprimeur.nom)}` : ''}</small></div>
    <div class="signature">Le surveillant<br /><small>${t.examen.surveillant ? `${echapper(t.examen.surveillant.prenom)} ${echapper(t.examen.surveillant.nom)}` : ''}</small></div>
    <div class="signature">Le Chef de département</div>
  </div>`,
      piedDePage: `<span>University — sécurité des épreuves</span><span>Édité le ${new Date().toLocaleString('fr-FR')}</span>`,
    });
  }
}

/** Règles propres au bordereau de tirage ; le reste vient de `pageA4`. */
const STYLE_BORDEREAU = `
  body { padding: 16mm 14mm; }
  .titre { margin: 4px 0 6px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 10px 0; font-size: 12px; color: ${P.encre}; }
  .meta b { display: inline-block; min-width: 130px; color: ${P.encreDouce}; }
  th, td { padding: 6px 8px; }
  .badge { padding: 2px 8px; font-weight: 700; text-transform: uppercase; }
  .PROGRAMME { background: ${P.grisInerte}; color: ${P.encre}; }
  .IMPRIME, .MIS_SOUS_PLI { background: ${P.jauneFond}; color: ${P.jauneTexte}; }
  .DISTRIBUE, .RECUPERE { background: ${P.vertFond}; color: ${P.vert}; }
  .ANNULE { background: ${P.rougeFond}; color: ${P.rouge}; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 60px; }
  .signature { width: auto; }
`;

/** Préfixe laissé visible d'une empreinte attendue (identification, pas comparaison). */
const PREFIXE_EMPREINTE = 8;

/**
 * Tant que le tirage est PROGRAMME, l'empreinte source est la valeur que
 * l'imprimeur doit retrouver sur le fichier réellement imprimé : la renvoyer
 * en clair permettrait de la recopier et viderait le contrôle
 * anti-substitution de son sens. Seul un court préfixe est exposé ; la
 * comparaison complète se fait côté serveur dans `imprimer`.
 */
export function masquerEmpreinte<T extends { stade: StadeTirage; empreinteSource: string }>(tirage: T): T {
  if (tirage.stade !== StadeTirage.PROGRAMME) return tirage;
  return { ...tirage, empreinteSource: tirage.empreinteSource.slice(0, PREFIXE_EMPREINTE) };
}

/** Comparaison insensible à la casse et à durée constante des deux empreintes. */
function empreintesEgales(fournie: string, attendue: string): boolean {
  const a = Buffer.from(fournie.trim().toLowerCase());
  const b = Buffer.from(attendue.trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Calcule un SHA-256 stable (hex) à partir d'un contenu ; exporté pour les
 *  seeds / outils de test. La longueur normalisée évite le moindre doute sur
 *  la casse en comparaison. */
export function empreinteSha256(contenu: string | Buffer): string {
  return crypto.createHash('sha256').update(contenu).digest('hex');
}
