/**
 * Plateforme VOD des cours magistraux.
 *
 * Une ressource VOD est une URL (Mux, S3, CDN, chemin local) étiquetée par
 * un cours (matière), un enseignant, éventuellement une séance manquée. Le
 * circuit BROUILLON → EN_LIGNE → HORS_LIGNE → ARCHIVE reflète son cycle de
 * vie : créé par l'enseignant, publié en vitrine par lui ou la scolarité,
 * retiré de la vitrine puis archivé pour l'historique.
 *
 * Les vues restent dans leur table dédiée, avec les éléments de progression
 * nécessaires à la reprise du cours. Elles ne sont pas reprises dans AuditLog.
 *
 * Les mutations de métadonnées (création, modification, publication,
 * archivage) écrivent leur entrée de journal d'audit dans la transaction qui
 * porte l'écriture, avec un instantané projeté minimal : statut,
 * identifiants techniques, dates et présence des contenus — jamais le titre,
 * la description, l'URL du média, le nom de l'enseignant, ni qui a regardé.
 */
import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatutVOD, TypeRessourceVOD } from '@prisma/client';
import { t } from '../../common/i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import {
  ArchiverVODDto,
  CreateCoursVODDto,
  EnregistrerVueDto,
  UpdateCoursVODDto,
  VodQueryDto,
} from './vod.dto';
import { paginer, pagine } from '../../common/pagination';
import { avantApres, journaliser } from '../../common/audit';

const VOD_INCLUDE = {
  matiere: { select: { id: true, code: true, intitule: true } },
  enseignant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
    },
  },
  creePar: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { vues: true } },
} as const;

const SEUIL_COMPLET = 0.9;

/** Les dates du journal sont des ISO : lisibles dans l'écran Journal, comparables. */
function isoOuNull(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Projection minimale d'une ressource VOD pour le journal d'audit.
 *
 * Elle retient ce qui permet de reconstituer une décision d'édition ou de
 * cycle de vie : le statut, les identifiants techniques (matière, séance,
 * enseignant, inscription, auteur — jamais leur nom), les horodatages, les
 * mesures du média et la *présence* des contenus.
 *
 * Le titre, la description, la transcription, l'URL du média et sa vignette
 * sont du contenu de cours — et l'URL peut porter un jeton de signature :
 * aucun n'est recopié, leur présence seule est notée. Les vues et l'identité
 * de ceux qui regardent n'ont pas leur place ici : elles restent dans leurs
 * propres tables, jamais dans le journal d'audit.
 */
function instantaneVod(vod: any) {
  if (!vod) return null;
  return {
    id: vod.id,
    type: vod.type ?? null,
    statut: vod.statut ?? null,
    public: vod.public ?? null,
    matiereId: vod.matiereId ?? null,
    seanceId: vod.seanceId ?? null,
    enseignantId: vod.enseignantId ?? null,
    inscriptionId: vod.inscriptionId ?? null,
    creeParId: vod.creeParId ?? null,
    dateMiseEnLigne: isoOuNull(vod.dateMiseEnLigne),
    createdAt: isoOuNull(vod.createdAt),
    updatedAt: isoOuNull(vod.updatedAt),
    dureeSecondes: vod.dureeSecondes ?? null,
    tailleKo: vod.tailleKo ?? null,
    titreFourni: Boolean(vod.titre),
    descriptionFournie: Boolean(vod.description),
    transcriptionFournie: Boolean(vod.transcription),
    mediaPresent: Boolean(vod.url),
    vignettePresente: Boolean(vod.thumbnailUrl),
  };
}

@Injectable()
export class VodService {
  constructor(private readonly prisma: PrismaService) {}

  /** Une ressource liée à la fois à une séance et à une inscription doit
   * rester dans la même année académique. Les liens restent facultatifs pour
   * les contenus transversaux ou destinés aux anciens étudiants. */
  private async verifierAnneeLiee(
    tx: Prisma.TransactionClient,
    seanceId: string | null | undefined,
    inscriptionId: string | null | undefined,
  ) {
    if (!seanceId || !inscriptionId) return;
    const [seance, inscription] = await Promise.all([
      tx.seance.findUnique({ where: { id: seanceId }, select: { anneeId: true } }),
      tx.inscription.findUnique({ where: { id: inscriptionId }, select: { anneeId: true } }),
    ]);
    if (!seance || !inscription) throw new NotFoundException(t('common.notFound'));
    if (seance.anneeId !== inscription.anneeId) {
      throw new BadRequestException(t('vod.seance_inscription_annee_incoherente'));
    }
  }

  // ----------------------------------------------------------- consultation

  private lectureWhere(user: AuthUser): Prisma.CoursVODWhereInput {
    if (([Role.ADMIN, Role.SCOLARITE, Role.DIRECTION] as Role[]).includes(user.role)) return {};
    if (user.role === Role.ETUDIANT) return {
      statut: StatutVOD.EN_LIGNE,
      OR: [{ public: true }, { inscription: { etudiantId: user.etudiantId ?? '__aucun__' } }],
    };
    if (user.role === Role.ENSEIGNANT) return { OR: [
      { creeParId: user.id }, { enseignantId: user.enseignantId ?? '__aucun__' },
      { public: true, statut: StatutVOD.EN_LIGNE },
    ] };
    return { public: true, statut: StatutVOD.EN_LIGNE };
  }

  async trouverPour(id: string, user: AuthUser) {
    const vod = await this.prisma.coursVOD.findFirst({ where: { id, AND: [this.lectureWhere(user)] }, include: VOD_INCLUDE });
    if (!vod) throw new NotFoundException(t('common.notFound'));
    return vod;
  }

  private async verifierEdition(id: string, user: AuthUser) {
    const vod = await this.trouver(id);
    if (user.role !== Role.ADMIN && vod.creeParId !== user.id) throw new ForbiddenException(t('common.forbidden'));
    return vod;
  }

  /** Les décisions et leur instantané partent du même état verrouillé. */
  private async verrouiller(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM "CoursVOD" WHERE id = ${id} FOR UPDATE`;
    const vod = await tx.coursVOD.findUnique({ where: { id } });
    if (!vod) throw new NotFoundException(t('common.notFound'));
    return vod;
  }

  private verifierAuteur(vod: { creeParId: string | null }, user: AuthUser) {
    if (user.role !== Role.ADMIN && vod.creeParId !== user.id) throw new ForbiddenException(t('common.forbidden'));
  }

  /** La lecture de statistiques ne doit pas révéler l'existence d'une VOD privée. */
  private async verifierStatistiques(id: string, user: AuthUser) {
    const vod = await this.prisma.coursVOD.findFirst({
      where: { id, ...(user.role === Role.ADMIN ? {} : { creeParId: user.id }) },
      include: VOD_INCLUDE,
    });
    if (!vod) throw new NotFoundException(t('common.notFound'));
    return vod;
  }

  async liste(query: VodQueryDto, user: AuthUser) {
    const pagination = paginer(query);

    const where: Prisma.CoursVODWhereInput = {
      AND: [this.lectureWhere(user)],
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.matiereId ? { matiereId: query.matiereId } : {}),
      ...(query.enseignantId ? { enseignantId: query.enseignantId } : {}),
      ...(query.inscriptionId ? { inscriptionId: query.inscriptionId } : {}),
      ...(query.public !== undefined ? { public: query.public === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { titre: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.coursVOD.findMany({
        where,
        include: VOD_INCLUDE,
        orderBy: { dateMiseEnLigne: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.coursVOD.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  async trouver(id: string) {
    const vod = await this.prisma.coursVOD.findUnique({
      where: { id },
      include: VOD_INCLUDE,
    });
    if (!vod) throw new NotFoundException(t('vod.ressource_vod_introuvable'));
    return vod;
  }

  /** Vues & statistiques agrégées (ADMIN/ENSEIGNANT). */
  async statistiques(id: string, user: AuthUser) {
    const vod = await this.verifierStatistiques(id, user);
    const [nbVues, nbComplets, dernieres] = await Promise.all([
      this.prisma.vueVOD.count({ where: { vodId: id } }),
      this.prisma.vueVOD.count({ where: { vodId: id, termine: true } }),
      this.prisma.vueVOD.findMany({
        where: { vodId: id },
        orderBy: { dateDebut: 'desc' },
        take: 50,
        include: {
          etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
        },
      }),
    ]);
    const dureeMoyenne = await this.prisma.vueVOD.aggregate({
      where: { vodId: id },
      _avg: { dureeSecondes: true },
    });
    return {
      vod: {
        id: vod.id,
        titre: vod.titre,
        type: vod.type,
        dureeSecondes: vod.dureeSecondes,
        nbVues: vod.nbVues,
        nbComplets: vod.nbComplets,
      },
      calcules: {
        nbVues,
        nbComplets,
        tauxComplet: nbVues > 0 ? Math.round((nbComplets / nbVues) * 100) : 0,
        dureeMoyenneSecondes: Math.round(dureeMoyenne._avg.dureeSecondes ?? 0),
      },
      dernieres,
    };
  }

  /** Catalogue des cours regardés par l'étudiant courant (portail). */
  async maCollecte(user: AuthUser) {
    if (!user.etudiantId) {
      throw new BadRequestException(t('vod.aucun_profil_etudiant_n_est_lie_a_votre_compte'));
    }
    const inscriptions = await this.prisma.inscription.findMany({
      where: { etudiantId: user.etudiantId },
      select: { id: true },
    });

    const vods = await this.prisma.coursVOD.findMany({
      where: {
        OR: [
          { public: true },
          { inscriptionId: { in: inscriptions.map((i) => i.id) } },
        ],
        statut: StatutVOD.EN_LIGNE,
      },
      include: {
        ...VOD_INCLUDE,
        vues: {
          where: { etudiantId: user.etudiantId },
          orderBy: { dateDebut: 'desc' },
          take: 1,
        },
      },
      orderBy: { dateMiseEnLigne: 'desc' },
    });

    return vods.map((v) => ({
      id: v.id,
      titre: v.titre,
      description: v.description,
      type: v.type,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      dureeSecondes: v.dureeSecondes,
      matiere: v.matiere,
      enseignant: v.enseignant,
      dernierePosition: v.vues[0]?.positionSecondes ?? 0,
      termine: v.vues[0]?.termine ?? false,
    }));
  }

  /** Recherche plein texte (compatible FTS léger : `contains` sur titre). */
  async recherche(texte: string, user: AuthUser) {
    return this.prisma.coursVOD.findMany({
      where: {
        AND: [this.lectureWhere(user)],
        statut: StatutVOD.EN_LIGNE,
        OR: [
          { titre: { contains: texte, mode: 'insensitive' } },
          { description: { contains: texte, mode: 'insensitive' } },
          { transcription: { contains: texte, mode: 'insensitive' } },
        ],
      },
      include: VOD_INCLUDE,
      orderBy: { nbVues: 'desc' },
      take: 50,
    });
  }

  // ---------------------------------------------------------------- édition

  async creer(dto: CreateCoursVODDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.verifierAnneeLiee(tx, dto.seanceId ?? null, dto.inscriptionId ?? null);
      const vod = await tx.coursVOD.create({
        data: {
          titre: dto.titre,
          description: dto.description ?? null,
          matiereId: dto.matiereId ?? null,
          seanceId: dto.seanceId ?? null,
          enseignantId: user.role === Role.ENSEIGNANT ? user.enseignantId : dto.enseignantId ?? null,
          type: dto.type,
          url: dto.url,
          thumbnailUrl: dto.thumbnailUrl ?? null,
          dureeSecondes: dto.dureeSecondes ?? null,
          tailleKo: dto.tailleKo ?? null,
          transcription: dto.transcription ?? null,
          public: dto.public ?? true,
          inscriptionId: dto.inscriptionId ?? null,
          creeParId: user.id,
          statut: StatutVOD.BROUILLON,
        },
        include: VOD_INCLUDE,
      });
      await journaliser(tx, user, 'VOD_CREE', 'CoursVOD', vod.id, avantApres(null, instantaneVod(vod)));
      return vod;
    });
  }

  async modifier(id: string, dto: UpdateCoursVODDto, user: AuthUser) {
    // Refus rapide, puis contrôle renouvelé sur l'état verrouillé.
    await this.verifierEdition(id, user);
    const donnees = {
      ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.matiereId !== undefined ? { matiereId: dto.matiereId } : {}),
      ...(dto.seanceId !== undefined ? { seanceId: dto.seanceId } : {}),
      ...(dto.enseignantId !== undefined ? { enseignantId: user.role === Role.ENSEIGNANT ? user.enseignantId : dto.enseignantId } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.url !== undefined ? { url: dto.url } : {}),
      ...(dto.thumbnailUrl !== undefined ? { thumbnailUrl: dto.thumbnailUrl } : {}),
      ...(dto.dureeSecondes !== undefined ? { dureeSecondes: dto.dureeSecondes } : {}),
      ...(dto.tailleKo !== undefined ? { tailleKo: dto.tailleKo } : {}),
      ...(dto.transcription !== undefined ? { transcription: dto.transcription } : {}),
      ...(dto.public !== undefined ? { public: dto.public } : {}),
      ...(dto.inscriptionId !== undefined ? { inscriptionId: dto.inscriptionId } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const avant = await this.verrouiller(tx, id);
      this.verifierAuteur(avant, user);
      if (avant.statut === StatutVOD.ARCHIVE) {
        throw new BadRequestException(t('vod.cette_ressource_est_deja_archivee'));
      }
      await this.verifierAnneeLiee(
        tx,
        dto.seanceId !== undefined ? dto.seanceId : avant.seanceId,
        dto.inscriptionId !== undefined ? dto.inscriptionId : avant.inscriptionId,
      );
      const vod = await tx.coursVOD.update({ where: { id }, data: donnees, include: VOD_INCLUDE });
      // Noms des champs touchés seulement : leurs valeurs restent dans
      // l'instantané projeté, jamais recopiées.
      const champsModifies = Object.keys(donnees);
      await journaliser(
        tx,
        user,
        'VOD_MODIFIE',
        'CoursVOD',
        id,
        avantApres(instantaneVod(avant), instantaneVod(vod), champsModifies.length ? { champsModifies } : undefined),
      );
      return vod;
    });
  }

  async publier(id: string, user: AuthUser) {
    await this.verifierEdition(id, user);
    return this.prisma.$transaction(async (tx) => {
      const avant = await this.verrouiller(tx, id);
      this.verifierAuteur(avant, user);
      if (avant.statut !== StatutVOD.BROUILLON && avant.statut !== StatutVOD.HORS_LIGNE) {
        throw new BadRequestException(t('vod.cette_ressource_est_deja_vod_statut_seul_un_brouillon_ou_un_hors', { statut: avant.statut }));
      }
      const miseAJour = await tx.coursVOD.update({
        where: { id },
        data: {
          statut: StatutVOD.EN_LIGNE,
          dateMiseEnLigne: new Date(),
        },
        include: VOD_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'VOD_PUBLIE',
        'CoursVOD',
        id,
        avantApres(instantaneVod(avant), instantaneVod(miseAJour), { champsModifies: ['statut', 'dateMiseEnLigne'] }),
      );
      return miseAJour;
    });
  }

  async archiver(id: string, _dto: ArchiverVODDto, user: AuthUser) {
    await this.verifierEdition(id, user);
    return this.prisma.$transaction(async (tx) => {
      const avant = await this.verrouiller(tx, id);
      this.verifierAuteur(avant, user);
      if (avant.statut === StatutVOD.ARCHIVE) {
        throw new BadRequestException(t('vod.cette_ressource_est_deja_archivee'));
      }
      const miseAJour = await tx.coursVOD.update({
        where: { id },
        data: { statut: StatutVOD.ARCHIVE },
        include: VOD_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'VOD_ARCHIVE',
        'CoursVOD',
        id,
        avantApres(instantaneVod(avant), instantaneVod(miseAJour), { champsModifies: ['statut'] }),
      );
      return miseAJour;
    });
  }

  // ------------------------------------------------------------- visionnage

  /**
   * Enregistrement d'une vue. Les compteurs agrégés (nbVues, nbComplets)
   * sont mis à jour à chaque appel : un nouveau visionnage = +1 vue ;
   * `termine` devient vrai quand la position couvre ≥ 90 % de la durée.
   *
   * Cette méthode n'écrit aucune entrée de journal d'audit, et ce n'est pas
   * un oubli : qui a regardé quoi est une donnée de suivi pédagogique, pas un
   * acte d'administration à tracer. Elle reste dans ses tables dédiées.
   */
  async enregistrerVue(id: string, dto: EnregistrerVueDto, user: AuthUser, ip?: string) {
    await this.trouverPour(id, user);
    const dureeSignalee = Math.max(0, Math.floor(dto.dureeSecondes || 0));
    const positionSignalee = Math.max(0, Math.floor(dto.positionSecondes || 0));
    const termineAuto =
      dureeSignalee > 0 && positionSignalee / dureeSignalee >= SEUIL_COMPLET;
    const termine = dto.termine ?? termineAuto;

    // La ligne et les compteurs évoluent ensemble. Les incréments SQL
    // empêchent deux visionnages simultanés d'écraser leurs compteurs mutuels.
    return this.prisma.$transaction(async (tx) => {
      await this.verrouiller(tx, id);
      const accessible = await tx.coursVOD.findFirst({ where: { id, AND: [this.lectureWhere(user)] } });
      if (!accessible) throw new NotFoundException(t('common.notFound'));
      await tx.vueVOD.create({
        data: {
          vodId: id,
          ...(user.etudiantId ? { etudiantId: user.etudiantId } : {}),
          positionSecondes: positionSignalee,
          dureeSecondes: dureeSignalee,
          termine,
          ipAppareil: ip ?? null,
          dateFin: termine ? new Date() : null,
        },
      });

      const cours = await tx.coursVOD.update({
        where: { id },
        data: {
          nbVues: { increment: 1 },
          ...(termine ? { nbComplets: { increment: 1 } } : {}),
        },
        select: { nbVues: true },
      });

      return { ok: true, termine, nbVues: cours.nbVues };
    });
  }
}
