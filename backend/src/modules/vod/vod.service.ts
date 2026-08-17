/**
 * Plateforme VOD des cours magistraux.
 *
 * Une ressource VOD est une URL (Mux, S3, CDN, chemin local) étiquetée par
 * un cours (matière), un enseignant, éventuellement une séance manquée. Le
 * circuit BROUILLON → EN_LIGNE → HORS_LIGNE → ARCHIVE reflète son cycle de
 * vie : créé par l'enseignant, publié en vitrine par lui ou la scolarité,
 * retiré de la vitrine puis archivé pour l'historique.
 *
 * Les vues sont journalisées par étudiant : on sait qui a regardé quoi,
 * jusqu'où, et si la lecture a été menée à terme (≥ 90 % de la durée).
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutVOD, TypeRessourceVOD } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import {
  ArchiverVODDto,
  CreateCoursVODDto,
  EnregistrerVueDto,
  UpdateCoursVODDto,
  VodQueryDto,
} from './vod.dto';

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

@Injectable()
export class VodService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------- consultation

  async liste(query: VodQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.CoursVODWhereInput = {
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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.coursVOD.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const vod = await this.prisma.coursVOD.findUnique({
      where: { id },
      include: VOD_INCLUDE,
    });
    if (!vod) throw new NotFoundException('Ressource VOD introuvable');
    return vod;
  }

  /** Vues & statistiques agrégées (ADMIN/ENSEIGNANT). */
  async statistiques(id: string) {
    const vod = await this.trouver(id);
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
      throw new BadRequestException("Aucun profil étudiant n'est lié à votre compte.");
    }
    const inscriptions = await this.prisma.inscription.findMany({
      where: { etudiantId: user.etudiantId },
      select: { id: true },
    });
    if (!inscriptions.length) return [];

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
  async recherche(texte: string) {
    return this.prisma.coursVOD.findMany({
      where: {
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
    const vod = await this.prisma.coursVOD.create({
      data: {
        titre: dto.titre,
        description: dto.description ?? null,
        matiereId: dto.matiereId ?? null,
        seanceId: dto.seanceId ?? null,
        enseignantId: dto.enseignantId ?? null,
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
    await this.journal(user.id, 'VOD_CREE', vod.id);
    return vod;
  }

  async modifier(id: string, dto: UpdateCoursVODDto, user: AuthUser) {
    await this.trouver(id);
    const vod = await this.prisma.coursVOD.update({
      where: { id },
      data: {
        ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.matiereId !== undefined ? { matiereId: dto.matiereId } : {}),
        ...(dto.seanceId !== undefined ? { seanceId: dto.seanceId } : {}),
        ...(dto.enseignantId !== undefined ? { enseignantId: dto.enseignantId } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.thumbnailUrl !== undefined ? { thumbnailUrl: dto.thumbnailUrl } : {}),
        ...(dto.dureeSecondes !== undefined ? { dureeSecondes: dto.dureeSecondes } : {}),
        ...(dto.tailleKo !== undefined ? { tailleKo: dto.tailleKo } : {}),
        ...(dto.transcription !== undefined ? { transcription: dto.transcription } : {}),
        ...(dto.public !== undefined ? { public: dto.public } : {}),
        ...(dto.inscriptionId !== undefined ? { inscriptionId: dto.inscriptionId } : {}),
      },
      include: VOD_INCLUDE,
    });
    await this.journal(user.id, 'VOD_MODIFIE', id);
    return vod;
  }

  async publier(id: string, user: AuthUser) {
    const vod = await this.trouver(id);
    if (vod.statut !== StatutVOD.BROUILLON && vod.statut !== StatutVOD.HORS_LIGNE) {
      throw new BadRequestException(
        `Cette ressource est déjà ${vod.statut} : seul un BROUILLON ou un HORS_LIGNE peut être remis en ligne.`,
      );
    }
    const miseAJour = await this.prisma.coursVOD.update({
      where: { id },
      data: {
        statut: StatutVOD.EN_LIGNE,
        dateMiseEnLigne: new Date(),
      },
      include: VOD_INCLUDE,
    });
    await this.journal(user.id, 'VOD_PUBLIE', id);
    return miseAJour;
  }

  async archiver(id: string, _dto: ArchiverVODDto, user: AuthUser) {
    const vod = await this.trouver(id);
    if (vod.statut === StatutVOD.ARCHIVE) {
      throw new BadRequestException('Cette ressource est déjà archivée.');
    }
    const miseAJour = await this.prisma.coursVOD.update({
      where: { id },
      data: { statut: StatutVOD.ARCHIVE },
      include: VOD_INCLUDE,
    });
    await this.journal(user.id, 'VOD_ARCHIVE', id);
    return miseAJour;
  }

  // ---------------------------------------------------------------- journal

  /**
   * Enregistrement d'une vue. Les compteurs agrégés (nbVues, nbComplets)
   * sont mis à jour à chaque appel : un nouveau visionnage = +1 vue ;
   * `termine` devient vrai quand la position couvre ≥ 90 % de la durée.
   */
  async enregistrerVue(id: string, dto: EnregistrerVueDto, user: AuthUser, ip?: string) {
    const vod = await this.trouver(id);
    const dureeSignalee = Math.max(0, Math.floor(dto.dureeSecondes || 0));
    const positionSignalee = Math.max(0, Math.floor(dto.positionSecondes || 0));
    const termineAuto =
      dureeSignalee > 0 && positionSignalee / dureeSignalee >= SEUIL_COMPLET;
    const termine = dto.termine ?? termineAuto;

    // Si l'utilisateur est connu etudiantId, on persiste une ligne VueVOD ;
    // sinon (visiteur public) on ne garde que les compteurs agrégés.
    if (user.etudiantId) {
      await this.prisma.vueVOD.create({
        data: {
          vodId: id,
          etudiantId: user.etudiantId,
          positionSecondes: positionSignalee,
          dureeSecondes: dureeSignalee,
          termine,
          ipAppareil: ip ?? null,
          dateFin: termine ? new Date() : null,
        },
      });
    } else {
      await this.prisma.vueVOD.create({
        data: {
          vodId: id,
          positionSecondes: positionSignalee,
          dureeSecondes: dureeSignalee,
          termine,
          ipAppareil: ip ?? null,
          dateFin: termine ? new Date() : null,
        },
      });
    }

    const agregats = await this.prisma.vueVOD.aggregate({
      where: { vodId: id },
      _count: { _all: true },
    });
    const complests = await this.prisma.vueVOD.count({
      where: { vodId: id, termine: true },
    });

    await this.prisma.coursVOD.update({
      where: { id },
      data: {
        nbVues: agregats._count._all,
        nbComplets: complests,
      },
    });

    return { ok: true, termine, nbVues: agregats._count._all };
  }

  private async journal(userId: string, action: string, entiteId: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entite: 'CoursVOD',
        entiteId,
      },
    });
  }
}