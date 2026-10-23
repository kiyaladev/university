import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Role, StatutSeance } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CrudService, supprimerOuConflit } from '../../../common/crud.service';
import { AuthUser } from '../../../common/decorators';
import { isoDate, jourSemaine, toDateOnly, dureeMinutes } from '../../../common/utils';
import {
  CreateSeanceDto,
  GenerationDto,
  SeanceQueryDto,
  SyncSeancesDto,
  UpdateSeanceDto,
  AffecterControleurDto,
  AffecterTourneeDto,
} from './planification.dto';
import { t } from '../../../common/i18n';
import { AnneeAcademiqueClotureeException, exigerAnneeOuverte } from '../../../common/annee';
import { paginer, pagine } from '../../../common/pagination';
import { journaliser } from '../../../common/audit';
import { estChefDeDepartement } from '../../../common/perimetre';

/** Un créneau vaut-il à cette date ? Sans période, il vaut toute l'année. */
function vaut(creneau: { dateDebut: Date | null; dateFin: Date | null }, jour: Date) {
  if (creneau.dateDebut && jour < toDateOnly(isoDate(creneau.dateDebut))) return false;
  if (creneau.dateFin && jour > toDateOnly(isoDate(creneau.dateFin))) return false;
  return true;
}

export const SEANCE_INCLUDE = {
  affectation: {
    include: {
      enseignant: {
        select: { id: true, nom: true, prenom: true, departementId: true },
      },
      matiere: true,
      promotion: { include: { filiere: { include: { departement: true } } } },
    },
  },
  salle: { select: { id: true, code: true, nom: true } },
  controle: {
    include: {
      controleur: { select: { id: true, nom: true, prenom: true, role: true } },
      enseignantRemplacant: { select: { id: true, nom: true, prenom: true } },
    },
  },
  controleurAssigne: { select: { id: true, nom: true, prenom: true } },
  justificatif: {
    select: {
      id: true,
      seanceId: true,
      enseignantId: true,
      type: true,
      motif: true,
      statut: true,
      traiteParId: true,
      commentaire: true,
      traiteLe: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

/** Projection sans pièce médicale, texte libre, géolocalisation ni signature. */
export const SEANCE_INCLUDE_RESTREINT = {
  ...SEANCE_INCLUDE,
  controle: {
    select: {
      id: true,
      statut: true,
      horodatage: true,
      dureeMinutes: true,
      effectifPresent: true,
      methode: true,
      attestation: true,
      attestationValide: true,
      controleur: { select: { id: true, nom: true, prenom: true, role: true } },
      enseignantRemplacant: { select: { id: true, nom: true, prenom: true } },
    },
  },
  justificatif: {
    select: { id: true, type: true, statut: true, traiteLe: true, createdAt: true },
  },
} satisfies Prisma.SeanceInclude;

@Injectable()
export class SeancesService extends CrudService {
  private readonly logger = new Logger(SeancesService.name);

  constructor(prisma: PrismaService) {
    super(prisma, 'seance', {
      orderBy: [{ date: 'desc' }, { heureDebut: 'asc' }],
      include: SEANCE_INCLUDE,
      label: 'Séance',
    });
  }

  private scopeAffectation(user?: AuthUser): Prisma.AffectationWhereInput {
    if (estChefDeDepartement(user) || (user?.role === Role.CONTROLEUR && user.departementId)) {
      return { enseignant: { departementId: user.departementId ?? '__aucun__' } };
    }
    return {};
  }

  private includePour(user?: AuthUser): Prisma.SeanceInclude {
    return user?.role === Role.ENSEIGNANT || estChefDeDepartement(user) || user?.role === Role.CONTROLEUR
      ? SEANCE_INCLUDE_RESTREINT
      : SEANCE_INCLUDE;
  }

  /** Filtre Prisma dérivé des paramètres d'URL + du périmètre de l'utilisateur. */
  where(query: SeanceQueryDto, user?: AuthUser): Prisma.SeanceWhereInput {
    const affectation: Record<string, any> = {};
    const contraintes: Prisma.SeanceWhereInput[] = [];
    if (query.anneeId) affectation.anneeId = query.anneeId;
    if (query.enseignantId) affectation.enseignantId = query.enseignantId;
    if (query.promotionId) affectation.promotionId = query.promotionId;
    if (query.matiereId) affectation.matiereId = query.matiereId;
    if (query.departementId && user?.role !== Role.CONTROLEUR) {
      affectation.enseignant = { departementId: query.departementId };
    }

    // Un enseignant ne voit que ses propres séances ; les rôles de département
    // ne voient que les séances de leur département.
    if (user?.role === Role.ENSEIGNANT) {
      affectation.enseignantId = user.enseignantId ?? '—';
    } else if (estChefDeDepartement(user) || (user?.role === Role.CONTROLEUR && user.departementId)) {
      Object.assign(affectation, this.scopeAffectation(user));
    } else if (user?.role === Role.CONTROLEUR) {
      // Sans département de rattachement, le contrôleur ne voit que les
      // séances qui lui sont attribuées ou qu'il a déjà pointées.
      contraintes.push({
        OR: [{ controleurAssigneId: user.id }, { controle: { is: { controleurId: user.id } } }],
      });
    }

    const date: Prisma.DateTimeFilter = {};
    if (query.date) {
      date.equals = toDateOnly(query.date);
    } else {
      if (query.dateDebut) date.gte = toDateOnly(query.dateDebut);
      if (query.dateFin) date.lte = toDateOnly(query.dateFin);
    }

    if (query.search) {
      contraintes.push({
        OR: [
          { thematique: { contains: query.search, mode: 'insensitive' } },
          { affectation: { matiere: { intitule: { contains: query.search, mode: 'insensitive' } } } },
          { affectation: { enseignant: { nom: { contains: query.search, mode: 'insensitive' } } } },
        ],
      });
    }

    return {
      ...(Object.keys(affectation).length ? { affectation } : {}),
      ...(Object.keys(date).length ? { date } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(query.statut ? { statut: query.statut as StatutSeance } : {}),
      ...(query.nonControlees === '1' || query.nonControlees === 'true' ? { controle: { is: null } } : {}),
      ...(contraintes.length ? { AND: contraintes } : {}),
    };
  }

  liste(query: SeanceQueryDto, user?: AuthUser) {
    const requete = { ...query, search: undefined, sort: query.sort ?? undefined };
    const where = this.where(query, user);
    if (this.includePour(user) === SEANCE_INCLUDE) return this.findAll(requete, where);

    const pagination = paginer(query);
    return Promise.all([
      this.prisma.seance.findMany({
        where,
        include: this.includePour(user),
        orderBy: this.orderByDe(requete),
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.seance.count({ where }),
    ]).then(([data, total]) => pagine(data, total, pagination));
  }

  async consulter(id: string, user: AuthUser) {
    const seance = await this.prisma.seance.findFirst({
      where: { id, ...this.where({}, user) },
      include: this.includePour(user),
    });
    if (!seance) throw new NotFoundException(t('common.notFoundRecord'));
    return seance;
  }

  async affecterControleur(id: string, dto: AffecterControleurDto, user: AuthUser) {
    if (dto.controleurId === undefined) {
      throw new BadRequestException(t('planification.controleurAffectationRequired'));
    }
    const nouveauControleurId = dto.controleurId || null;
    return this.prisma.$transaction(
      async (tx) => {
        const seance: any = await tx.seance.findUnique({
          where: { id },
          select: { id: true, anneeId: true, controleurAssigneId: true },
        });
        if (!seance) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, seance.anneeId);
        if (nouveauControleurId) {
          const controleur = await tx.user.findUnique({
            where: { id: nouveauControleurId },
            select: { id: true, nom: true, prenom: true, role: true, actif: true },
          });
          if (!controleur || !controleur.actif || controleur.role !== Role.CONTROLEUR) {
            throw new BadRequestException(t('planification.controleurAffectationInvalid'));
          }
        }
        const miseAJour = await tx.seance.update({
          where: { id },
          data: { controleurAssigneId: nouveauControleurId },
          include: SEANCE_INCLUDE,
        });
        await journaliser(
          tx,
          user,
          nouveauControleurId ? 'CONTROLEUR_AFFECTE_SEANCE' : 'CONTROLEUR_RETIRE_SEANCE',
          'Seance',
          id,
          {
            avant: { controleurAssigneId: seance.controleurAssigneId },
            apres: { controleurAssigneId: nouveauControleurId },
          },
        );
        return miseAJour;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private plageTournee(dto: AffecterTourneeDto): Prisma.SeanceWhereInput {
    const debut = toDateOnly(dto.dateDebut);
    const fin = toDateOnly(dto.dateFin);
    if (fin < debut) throw new BadRequestException(t('planification.tourneePeriodInvalid'));
    if ((fin.getTime() - debut.getTime()) / 86_400_000 > 400) {
      throw new BadRequestException(t('planification.tourneePeriodTooLong'));
    }
    return {
      date: { gte: debut, lte: fin },
      statut: { not: StatutSeance.ANNULE },
      controleurAssigneId: null,
      ...(dto.departementId ? { affectation: { enseignant: { departementId: dto.departementId } } } : {}),
    };
  }

  private async verifierControleurActif(db: PrismaService, controleurId: string) {
    const controleur = await db.user.findUnique({
      where: { id: controleurId },
      select: { id: true, role: true, actif: true },
    });
    if (!controleur || !controleur.actif || controleur.role !== Role.CONTROLEUR) {
      throw new BadRequestException(t('planification.controleurAffectationInvalid'));
    }
  }

  async apercuTournee(dto: AffecterTourneeDto) {
    await this.verifierControleurActif(this.prisma, dto.controleurId);
    const seances = await this.prisma.seance.findMany({
      where: this.plageTournee(dto),
      select: { id: true, annee: { select: { cloturee: true } } },
    });
    const ignoreesAnneeCloturee = seances.filter((s) => s.annee.cloturee).length;
    return {
      seancesSansAffectation: seances.length,
      seancesAffectables: seances.length - ignoreesAnneeCloturee,
      ignoreesAnneeCloturee,
    };
  }

  async affecterTournee(dto: AffecterTourneeDto, user: AuthUser) {
    const where = this.plageTournee(dto);
    return this.prisma.$transaction(
      async (tx) => {
        await this.verifierControleurActif(tx as PrismaService, dto.controleurId);
        const seances = await tx.seance.findMany({
          where,
          select: { id: true, anneeId: true },
        });
        const anneesOuvertes = new Set<string>();
        for (const anneeId of new Set(seances.map((s) => s.anneeId))) {
          try {
            await exigerAnneeOuverte(tx, anneeId);
            anneesOuvertes.add(anneeId);
          } catch (error) {
            if (!(error instanceof AnneeAcademiqueClotureeException)) throw error;
          }
        }
        const idsOuverts = seances.filter((s) => anneesOuvertes.has(s.anneeId)).map((s) => s.id);
        const ignoreesAnneeCloturee = seances.length - idsOuverts.length;
        const resultat = idsOuverts.length
          ? await tx.seance.updateMany({
              where: { id: { in: idsOuverts }, controleurAssigneId: null, statut: { not: StatutSeance.ANNULE } },
              data: { controleurAssigneId: dto.controleurId },
            })
          : { count: 0 };

        if (resultat.count) {
          await journaliser(
            tx,
            user,
            'TOURNEE_CONTROLEUR_AFFECTEE',
            'TourneeControleur',
            `${dto.dateDebut}_${dto.dateFin}`,
            {
              controleurId: dto.controleurId,
              departementId: dto.departementId ?? null,
              dateDebut: dto.dateDebut,
              dateFin: dto.dateFin,
              seancesAffectees: resultat.count,
              seancesCandidates: idsOuverts,
              controleurApres: dto.controleurId,
              seancesIgnoreesAnneeCloturee: ignoreesAnneeCloturee,
            },
          );
        }
        return {
          seancesAffectees: resultat.count,
          seancesIgnoreesAnneeCloturee: ignoreesAnneeCloturee,
          seancesDejaAffecteesOuAbsentes: seances.length - resultat.count - ignoreesAnneeCloturee,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Feuille de route du contrôleur : les séances d'une journée, par heure. */
  async journee(date: string | undefined, query: SeanceQueryDto, user?: AuthUser) {
    const jour = date ?? isoDate(new Date());
    const seances = await this.prisma.seance.findMany({
      where: this.where({ ...query, date: jour }, user),
      include: this.includePour(user),
      orderBy: [{ heureDebut: 'asc' }],
    });

    return {
      date: jour,
      total: seances.length,
      controlees: seances.filter((s) => s.controle).length,
      enAttente: seances.filter((s) => !s.controle && s.statut !== StatutSeance.ANNULE).length,
      seances,
    };
  }

  controleurs() {
    return this.prisma.user.findMany({
      where: { role: Role.CONTROLEUR, actif: true },
      select: { id: true, nom: true, prenom: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take: 1000,
    });
  }

  private async payload(
    dto: CreateSeanceDto | UpdateSeanceDto,
    anneeId?: string,
    autoriserAnneeFermee = false,
    db: any = this.prisma,
    user?: AuthUser,
  ) {
    const { affectationId, date, ...rest } = dto as CreateSeanceDto;
    let annee = anneeId;
    if (affectationId && (!annee || (dto as UpdateSeanceDto).affectationId !== undefined)) {
      const scope = this.scopeAffectation(user);
      const where: Prisma.AffectationWhereInput = { id: affectationId, ...scope };
      if (user?.role === Role.CONTROLEUR && !user.departementId) {
        where.seances = {
          some: {
            OR: [{ controleurAssigneId: user.id }, { controle: { is: { controleurId: user.id } } }],
          },
        };
      }
      const aff = await db.affectation.findFirst({
        where,
        include: { annee: { select: { cloturee: true } } },
      });
      if (!aff) throw new BadRequestException(t('planification.affectation_introuvable'));
      if (aff.annee.cloturee && !autoriserAnneeFermee) {
        throw new BadRequestException(t('planification.annee_academique_cloturee_ecriture_interdite'));
      }
      annee = aff.anneeId;
    }
    if (dto.heureDebut && dto.heureFin && dureeMinutes(dto.heureDebut, dto.heureFin) <= 0) {
      throw new BadRequestException(t('planification.l_heure_de_fin_doit_suivre_l_heure_de_debut'));
    }
    return {
      ...rest,
      ...(affectationId ? { affectationId } : {}),
      ...(date ? { date: toDateOnly(date) } : {}),
      ...(annee ? { anneeId: annee } : {}),
    };
  }

  async creer(dto: CreateSeanceDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const data = await this.payload(dto, undefined, false, tx, user);
        await exigerAnneeOuverte(tx, data.anneeId);
        const seance = await tx.seance.create({
          data: {
            ...data,
            ...(user?.role === Role.CONTROLEUR ? { controleurAssigneId: user.id } : {}),
          } as Prisma.SeanceUncheckedCreateInput,
          include: SEANCE_INCLUDE,
        });
        await journaliser(tx, user ?? null, 'SEANCE_CREEE', 'Seance', seance.id, {
          avant: null,
          apres: this.instantaneAudit(seance),
        });
        return seance;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async modifier(id: string, dto: UpdateSeanceDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant: any = await tx.seance.findFirst({
          where: { id, ...this.where({}, user) },
          include: SEANCE_INCLUDE,
        });
        if (!avant) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, avant.anneeId);
        const data = await this.payload(dto, avant.anneeId, false, tx, user);
        await exigerAnneeOuverte(tx, data.anneeId);
        const apres = await tx.seance.update({ where: { id }, data, include: SEANCE_INCLUDE });
        await journaliser(tx, user ?? null, 'SEANCE_MODIFIEE', 'Seance', id, {
          avant: this.instantaneAudit(avant),
          apres: this.instantaneAudit(apres),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async annuler(id: string, motif?: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant: any = await tx.seance.findFirst({
          where: { id, ...this.where({}, user) },
          include: { ...SEANCE_INCLUDE, controle: true },
        });
        if (!avant) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, avant.anneeId);
        if (avant.controle)
          throw new BadRequestException(t('planification.une_seance_deja_controlee_ne_peut_pas_etre_annulee'));
        const apres = await tx.seance.update({
          where: { id },
          data: { statut: StatutSeance.ANNULE, thematique: motif ? `[Annulée] ${motif}` : avant.thematique },
          include: SEANCE_INCLUDE,
        });
        await journaliser(tx, user ?? null, 'SEANCE_ANNULEE', 'Seance', id, {
          avant: this.instantaneAudit(avant),
          apres: this.instantaneAudit(apres),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant: any = await tx.seance.findUnique({ where: { id }, include: SEANCE_INCLUDE });
        if (!avant) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, avant.anneeId);
        // Un contrôle ou un justificatif est une preuve (base de la paie) : la
        // séance se garde, elle s'annule. FK en RESTRICT : une preuve posée
        // entre-temps fait échouer le DELETE, traduit en 409.
        const preuves = await tx.seance.findUnique({
          where: { id },
          select: { controle: { select: { id: true } }, justificatif: { select: { id: true } } },
        });
        if (preuves?.controle || preuves?.justificatif) {
          throw new ConflictException(t('planification.seance_pointee_non_supprimable'));
        }
        await supprimerOuConflit(
          () => tx.seance.delete({ where: { id } }),
          'planification.seance_pointee_non_supprimable',
        );
        await journaliser(tx, user ?? null, 'SEANCE_SUPPRIMEE', 'Seance', id, {
          avant: this.instantaneAudit(avant),
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private instantaneAudit(seance: any) {
    return {
      id: seance.id,
      affectationId: seance.affectationId,
      anneeId: seance.anneeId,
      date: seance.date,
      heureDebut: seance.heureDebut,
      heureFin: seance.heureFin,
      statut: seance.statut,
      salleId: seance.salleId,
      controleurAssigneId: seance.controleurAssigneId,
    };
  }

  /**
   * Génère les séances d'une période à partir des créneaux récurrents.
   * Les séances déjà existantes (même affectation, date, heure) sont ignorées.
   *
   * Un créneau peut ne valoir que sur une partie de l'année — « chaque lundi
   * 08h-12h, du 1er au 31 janvier » : hors de sa période, il ne produit rien.
   */
  async generer(dto: GenerationDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        await exigerAnneeOuverte(tx, dto.anneeId);
        const debut = toDateOnly(dto.dateDebut);
        const fin = toDateOnly(dto.dateFin);
        if (fin < debut) throw new BadRequestException(t('planification.periode_invalide'));
        if ((fin.getTime() - debut.getTime()) / 86400000 > 400) {
          throw new BadRequestException(t('planification.periode_trop_longue_maximum_400_jours'));
        }

        const creneaux = await tx.creneau.findMany({
          where: {
            actif: true,
            affectation: { anneeId: dto.anneeId, ...this.scopeAffectation(user) },
            ...(dto.creneauIds?.length ? { id: { in: dto.creneauIds } } : {}),
          },
        });
        if (!creneaux.length) {
          throw new BadRequestException(t('planification.aucun_creneau_actif_a_generer_pour_cette_annee'));
        }

        const exclus = new Set(dto.joursExclus ?? []);
        const lignes: Prisma.SeanceCreateManyInput[] = [];

        for (let d = new Date(debut); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
          const jour = jourSemaine(d);
          const iso = isoDate(d);
          if (exclus.has(iso)) continue;

          for (const c of creneaux.filter((c) => c.jourSemaine === jour && vaut(c, d))) {
            lignes.push({
              affectationId: c.affectationId,
              creneauId: c.id,
              anneeId: dto.anneeId,
              date: toDateOnly(iso),
              heureDebut: c.heureDebut,
              heureFin: c.heureFin,
              type: c.type,
              salleId: c.salleId,
            });
          }
        }

        const res = await tx.seance.createMany({ data: lignes, skipDuplicates: true });
        if (res.count > 0) {
          await journaliser(tx, user ?? null, 'SEANCES_GENEREES', 'AnneeAcademique', dto.anneeId, {
            periode: { debut: isoDate(debut), fin: isoDate(fin) },
            candidates: lignes.length,
            creees: res.count,
            ignorees: lignes.length - res.count,
          });
        }
        return {
          creneaux: creneaux.length,
          candidates: lignes.length,
          creees: res.count,
          ignorees: lignes.length - res.count,
          periode: { debut: isoDate(debut), fin: isoDate(fin) },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Rejoue des séances créées sans réseau. L’UUID client est aussi l’identifiant
   * de la séance : un nouvel envoi après une réponse perdue devient un no-op,
   * ce qui permet aux pointages hors ligne de référencer la séance à l’avance.
   * Chaque élément est indépendant afin qu’une entrée invalide ne bloque pas
   * les autres.
   */
  async synchroniser(dto: SyncSeancesDto, user?: AuthUser) {
    const resultats: Array<{ idClient: string; ok: boolean; id?: string; dejaCreee?: boolean; erreur?: string }> = [];

    for (const entree of dto.seances) {
      try {
        const { idClient, ...creation } = entree;
        const resultat = await this.prisma.$transaction(
          async (tx) => {
            const existante = await tx.seance.findUnique({ where: { id: idClient } });
            const payload = await this.payload(creation, existante?.anneeId, Boolean(existante), tx, user);
            if (existante) {
              if (!this.memeSeance(existante, payload)) {
                throw new ConflictException(t('planification.cle_seance_hors_ligne_deja_utilisee'));
              }
              return { seance: existante, dejaCreee: true };
            }
            await exigerAnneeOuverte(tx, payload.anneeId);
            const creee = await tx.seance.create({
              data: {
                id: idClient,
                ...payload,
                ...(user?.role === Role.CONTROLEUR ? { controleurAssigneId: user.id } : {}),
              } as Prisma.SeanceUncheckedCreateInput,
              include: SEANCE_INCLUDE,
            });
            await journaliser(tx, user ?? null, 'SEANCE_SYNCHRONISEE_HORS_LIGNE', 'Seance', creee.id, {
              avant: null,
              apres: this.instantaneAudit(creee),
              idClient,
            });
            return { seance: creee, dejaCreee: false };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        resultats.push({ idClient, ok: true, id: resultat.seance.id, dejaCreee: resultat.dejaCreee });
      } catch (e: any) {
        // Deux tentatives concurrentes peuvent gagner la création avec la même
        // clé. On relit et compare avant de reconnaître le rejeu.
        if (e?.code === 'P2002') {
          try {
            const { idClient, ...creation } = entree;
            const payload = await this.payload(creation, undefined, false, this.prisma, user);
            const existante = await this.prisma.seance.findUnique({ where: { id: idClient } });
            if (existante && this.memeSeance(existante, payload)) {
              resultats.push({ idClient, ok: true, id: existante.id, dejaCreee: true });
              continue;
            }
          } catch {
            /* La réponse individuelle ci-dessous garde l’échec. */
          }
        }
        resultats.push({
          idClient: entree.idClient,
          ok: false,
          erreur: e?.response?.message ?? e?.message ?? t('common.internalError'),
        });
      }
    }

    return {
      recus: dto.seances.length,
      synchronisees: resultats.filter((r) => r.ok).length,
      echecs: resultats.filter((r) => !r.ok),
      resultats,
    };
  }

  private memeSeance(existante: any, payload: Record<string, any>) {
    const date = toDateOnly(isoDate(existante.date));
    return (
      existante.affectationId === payload.affectationId &&
      date.getTime() === payload.date.getTime() &&
      existante.heureDebut === payload.heureDebut &&
      existante.heureFin === payload.heureFin &&
      existante.type === (payload.type ?? 'CM') &&
      (existante.salleId ?? null) === (payload.salleId ?? null) &&
      (existante.thematique ?? null) === (payload.thematique ?? null)
    );
  }

  /**
   * Chaque nuit : les séances passées jamais contrôlées passent en NON_TENUE.
   * C'est ce qui alimente la liste « séances sans contrôle » des rapports.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cloturerSeancesPassees() {
    const hier = toDateOnly(new Date());
    hier.setUTCDate(hier.getUTCDate() - 1);

    const res = await this.prisma.$transaction(
      async (tx) => {
        const candidats = await tx.seance.findMany({
          where: {
            date: { lte: hier },
            statut: StatutSeance.PLANIFIE,
            controle: { is: null },
            annee: { cloturee: false },
          },
          select: { anneeId: true },
          distinct: ['anneeId'],
        });
        const anneesVerrouilleesOuvertes = new Set<string>();
        for (const { anneeId } of candidats) {
          try {
            await exigerAnneeOuverte(tx, anneeId);
            anneesVerrouilleesOuvertes.add(anneeId);
          } catch (error) {
            if (!(error instanceof AnneeAcademiqueClotureeException)) throw error;
          }
        }
        const resultat = await tx.seance.updateMany({
          where: {
            date: { lte: hier },
            statut: StatutSeance.PLANIFIE,
            controle: { is: null },
            anneeId: { in: [...anneesVerrouilleesOuvertes] },
            annee: { cloturee: false },
          },
          data: { statut: StatutSeance.NON_TENUE },
        });
        if (resultat.count) {
          await journaliser(tx, null, 'SEANCES_PASSEES_CLOTUREES_AUTOMATIQUEMENT', 'Seance', isoDate(hier), {
            statutAvant: StatutSeance.PLANIFIE,
            statutApres: StatutSeance.NON_TENUE,
            nombre: resultat.count,
          });
        }
        return resultat;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (res.count) {
      this.logger.log(`${res.count} séance(s) passée(s) sans contrôle marquée(s) NON_TENUE`);
    }
    return res;
  }
}
