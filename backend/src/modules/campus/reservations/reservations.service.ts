import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatutReservationSalle } from '@prisma/client';
import { t } from '../../../common/i18n';
import { CrudService } from '../../../common/crud.service';
import { AuthUser } from '../../../common/decorators';
import { PrismaService } from '../../../prisma/prisma.service';
import { dureeMinutes, isoDate, toDateOnly, toMinutes } from '../../../common/utils';
import { joursEntre } from './calendrier';
import {
  CalendrierQueryDto,
  CreateReservationDto,
  DeciderReservationDto,
  ReservationQueryDto,
  UpdateReservationDto,
} from './reservations.dto';
import { journaliser } from '../../../common/audit';
import { estChefDeDepartement } from '../../../common/perimetre';

const MAX_JOURS_CALENDRIER = 93;

/**
 * Journal d'audit : le vocabulaire des actions est une convention propre,
 * écrite en base et lue par les rapports. Il ne suit pas le renommage des
 * statuts : une action inscrite avant la migration reste lisible après.
 */
const ACTION_STATUT: Record<StatutReservationSalle, string> = {
  EN_ATTENTE: 'RESERVATION_EN_ATTENTE',
  CONFIRME: 'RESERVATION_CONFIRMEE',
  REFUSE: 'RESERVATION_REFUSEE',
  ANNULE: 'RESERVATION_ANNULEE',
};

export const RESERVATION_INCLUDE = {
  salle: { select: { id: true, code: true, nom: true } },
  demandeur: { select: { id: true, nom: true, prenom: true } },
  refusePar: { select: { id: true, nom: true, prenom: true } },
};

/** Seules les demandes encore vives occupent la salle : une réservation
 *  refusée ou annulée rend le créneau disponible aussitôt. */
const STATUTS_OCCUPANTS = [StatutReservationSalle.EN_ATTENTE, StatutReservationSalle.CONFIRME];

/** Séances de l'emploi du temps, allégées pour la grille de la semaine. */
const SEANCE_CALENDRIER = {
  select: {
    id: true,
    date: true,
    heureDebut: true,
    heureFin: true,
    type: true,
    statut: true,
    salleId: true,
    affectation: {
      select: {
        matiere: { select: { intitule: true } },
        promotion: { select: { nom: true } },
        enseignant: { select: { nom: true, prenom: true } },
      },
    },
  },
};

const SALLE_CALENDRIER_SELECT = {
  id: true,
  code: true,
  nom: true,
  batiment: true,
  capacite: true,
  actif: true,
};

@Injectable()
export class ReservationsService extends CrudService<
  Prisma.ReservationSalleGetPayload<{ include: typeof RESERVATION_INCLUDE }>
> {
  constructor(prisma: PrismaService) {
    super(prisma, 'reservationSalle', {
      orderBy: [{ dateJour: 'asc' }, { heureDebut: 'asc' }],
      include: RESERVATION_INCLUDE,
      label: 'Réservation',
    });
  }

  /** Une collision de sérialisation est une demande concurrente à rejouer,
   * pas une erreur serveur. Les quatre mutations de réservation partagent
   * cette traduction pour éviter d'exposer l'erreur SQL au client. */
  private async transactionSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e: any) {
      if (e?.code === 'P2034') {
        throw new ConflictException(t('reservations.ecriture_concurrente_reessayez'));
      }
      throw e;
    }
  }

  private where(query: ReservationQueryDto): Prisma.ReservationSalleWhereInput {
    return {
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(query.dateJour ? { dateJour: toDateOnly(query.dateJour) } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
    };
  }

  private gestionnaire(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.DIRECTION || user.role === Role.SCOLARITE;
  }

  lister(query: ReservationQueryDto, user: AuthUser) {
    const where = this.where(query);
    if (!this.gestionnaire(user)) where.demandeurId = user.id;
    return super.lister(query, where);
  }

  async consulter(id: string, user: AuthUser) {
    const reservation = await super.lire(id);
    if (!this.gestionnaire(user) && reservation.demandeurId !== user.id) {
      throw new NotFoundException(t('reservations.reservation_introuvable'));
    }
    return reservation;
  }

  /** Journée universitaire : tout événement tient entre 07:00 et 22:00. */
  private verifierHeures(debut: string, fin: string) {
    if (dureeMinutes(debut, fin) <= 0) {
      throw new BadRequestException(t('reservations.l_heure_de_fin_doit_suivre_l_heure_de_debut'));
    }
    const d = toMinutes(debut)!;
    const f = toMinutes(fin)!;
    if (d < 7 * 60 || f > 22 * 60) {
      throw new BadRequestException(t('reservations.les_reservations_sont_possibles_entre_07h00_et_22h00'));
    }
  }

  /**
   * Règle de concurrence : même salle, même jour, aucun chevauchement entre
   * deux demandes vives — heureDebut < heureFin existant et vice versa.
   */
  private async verifierConflit(
    salleId: string,
    dateJour: string,
    heureDebut: string,
    heureFin: string,
    idExclu?: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    this.verifierHeures(heureDebut, heureFin);
    const d = toMinutes(heureDebut)!;
    const f = toMinutes(heureFin)!;

    const concurrentes = await client.reservationSalle.findMany({
      where: {
        salleId,
        dateJour: toDateOnly(dateJour),
        statut: { in: STATUTS_OCCUPANTS },
        ...(idExclu ? { NOT: { id: idExclu } } : {}),
      },
    });

    const collision = concurrentes.find((r) => {
      const rd = toMinutes(r.heureDebut)!;
      const rf = toMinutes(r.heureFin)!;
      return d < rf && rd < f;
    });

    if (collision) {
      throw new ConflictException(
        t('reservations.cette_salle_est_deja_reservee_de_collision_heuredebut_a_collision_', {
          debut: collision.heureDebut,
          fin: collision.heureFin,
        }),
      );
    }
  }

  /**
   * Projection minimale journalisée avant/après. La réservation ne retient
   * que l'occupation de la salle et sa situation : ni motif, ni organisme, ni
   * responsable, ni motif de refus (textes libres), et jamais la salle elle-même
   * (jeton QR, coordonnées) — seulement son identifiant. La présence d'un
   * texte libre est notée par un booléen, jamais par son contenu.
   */
  private instantaneAudit(reservation: any) {
    return {
      id: reservation.id,
      salleId: reservation.salleId,
      dateJour: reservation.dateJour ?? null,
      heureDebut: reservation.heureDebut,
      heureFin: reservation.heureFin,
      statut: reservation.statut,
      demandeurId: reservation.demandeurId ?? null,
      refuseParId: reservation.refuseParId ?? null,
      motifFourni: Boolean(reservation.motif),
      organismeFourni: Boolean(reservation.organisme),
      responsableFourni: Boolean(reservation.responsable),
      refuseMotifFourni: Boolean(reservation.refuseMotif),
    };
  }

  async creer(dto: CreateReservationDto, user: AuthUser) {
    const { dateJour, ...reste } = dto;
    return this.transactionSerializable(async (tx) => {
      await this.verifierConflit(dto.salleId, dateJour, dto.heureDebut, dto.heureFin, undefined, tx);
      const creee = await tx.reservationSalle.create({
        data: {
          ...reste,
          dateJour: toDateOnly(dateJour),
          demandeurId: user.id,
        },
        include: RESERVATION_INCLUDE,
      });
      await journaliser(tx, user, 'RESERVATION_CREEE', 'ReservationSalle', creee.id, {
        avant: null,
        apres: this.instantaneAudit(creee),
      });
      return creee;
    });
  }

  async modifier(id: string, dto: UpdateReservationDto, user: AuthUser) {
    return this.transactionSerializable(async (tx) => {
      const existante: any = await tx.reservationSalle.findUnique({
        where: { id },
        include: RESERVATION_INCLUDE,
      });
      if (!existante) throw new NotFoundException(t('reservations.reservation_introuvable'));
      if (existante.demandeurId !== user.id && user.role !== Role.ADMIN) {
        throw new ForbiddenException(t('reservations.seul_le_demandeur_ou_l_administrateur_peut_modifier'));
      }
      if (existante.statut !== StatutReservationSalle.EN_ATTENTE) {
        throw new BadRequestException(t('reservations.une_reservation_deja_statuee_ne_peut_plus_etre_modifiee'));
      }
      await this.verifierConflit(
        dto.salleId ?? existante.salleId,
        dto.dateJour ?? isoDate(existante.dateJour),
        dto.heureDebut ?? existante.heureDebut,
        dto.heureFin ?? existante.heureFin,
        id,
        tx,
      );
      const maj = await tx.reservationSalle.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.dateJour !== undefined ? { dateJour: toDateOnly(dto.dateJour) } : {}),
        },
        include: RESERVATION_INCLUDE,
      });
      await journaliser(tx, user, 'RESERVATION_MODIFIEE', 'ReservationSalle', id, {
        avant: this.instantaneAudit(existante),
        apres: this.instantaneAudit(maj),
        champsModifies: Object.keys(dto),
      });
      return maj;
    });
  }

  async supprimer(id: string, user: AuthUser) {
    return this.transactionSerializable(async (tx) => {
      const existante: any = await tx.reservationSalle.findUnique({
        where: { id },
        include: RESERVATION_INCLUDE,
      });
      if (!existante) throw new NotFoundException(t('reservations.reservation_introuvable'));
      if (existante.demandeurId !== user.id && user.role !== Role.ADMIN) {
        throw new ForbiddenException(t('reservations.seul_le_demandeur_ou_l_administrateur_peut_annuler'));
      }
      await tx.reservationSalle.delete({ where: { id } });
      await journaliser(tx, user, 'RESERVATION_SUPPRIMEE', 'ReservationSalle', id, {
        avant: this.instantaneAudit(existante),
        apres: null,
      });
      return { id };
    });
  }

  /**
   * Décision de l'administration. Une confirmation re-vérifie les conflits :
   * entre-temps, une autre demande a pu réserver le créneau — 409 alors.
   */
  async decider(id: string, dto: DeciderReservationDto, user: AuthUser) {
    return this.transactionSerializable(async (tx) => {
      const existante: any = await tx.reservationSalle.findUnique({
        where: { id },
        include: RESERVATION_INCLUDE,
      });
      if (!existante) throw new NotFoundException(t('reservations.reservation_introuvable'));
      if (existante.statut !== StatutReservationSalle.EN_ATTENTE) {
        throw new BadRequestException(t('reservations.cette_reservation_a_deja_ete_statuee'));
      }

      const data: Prisma.ReservationSalleUpdateInput = { statut: dto.statut };
      if (dto.statut === 'CONFIRME') {
        await this.verifierConflit(
          existante.salleId,
          isoDate(existante.dateJour),
          existante.heureDebut,
          existante.heureFin,
          id,
          tx,
        );
      } else {
        data.refusePar = { connect: { id: user.id } };
        if (dto.motif) data.refuseMotif = dto.motif;
      }
      const maj = await tx.reservationSalle.update({
        where: { id },
        data,
        include: RESERVATION_INCLUDE,
      });
      await journaliser(tx, user, ACTION_STATUT[dto.statut], 'ReservationSalle', id, {
        avant: this.instantaneAudit(existante),
        apres: this.instantaneAudit(maj),
        champsModifies: [
          'statut',
          ...(data.refusePar ? ['refuseParId'] : []),
          ...(data.refuseMotif ? ['refuseMotif'] : []),
        ],
        refuseMotifFourni: Boolean(dto.motif),
      });
      return maj;
    });
  }

  /**
   * Vue semaine : une ligne par jour, avec ses réservations et, sur la même
   * grille, les séances de l'emploi du temps — en lecture seule, pour
   * constater les conflits avant de demander une salle.
   */
  async calendrier(query: CalendrierQueryDto, user: AuthUser) {
    const debut = toDateOnly(query.dateDebut);
    const fin = toDateOnly(query.dateFin);
    if (fin < debut) throw new BadRequestException(t('reservations.periode_invalide'));
    const nombreJours = Math.floor((fin.getTime() - debut.getTime()) / 86_400_000) + 1;
    if (nombreJours > MAX_JOURS_CALENDRIER) {
      throw new BadRequestException(t('reservations.periode_trop_longue'));
    }

    const salles = query.salleId
      ? this.prisma.salle.findMany({ where: { id: query.salleId }, select: SALLE_CALENDRIER_SELECT })
      : this.prisma.salle.findMany({
          where: { actif: true },
          select: SALLE_CALENDRIER_SELECT,
          orderBy: { code: 'asc' },
        });

    const perimetreSeances =
      user.role === Role.ENSEIGNANT
        ? { affectation: { enseignantId: user.enseignantId ?? '__aucun_enseignant__' } }
        : estChefDeDepartement(user) || (user.role === Role.CONTROLEUR && user.departementId)
          ? { affectation: { enseignant: { departementId: user.departementId ?? '__aucun_departement__' } } }
          : user.role === Role.CONTROLEUR
            ? { OR: [{ controleurAssigneId: user.id }, { controle: { is: { controleurId: user.id } } }] }
            : {};

    const [reservations, seances, listeSalles] = await Promise.all([
      this.prisma.reservationSalle.findMany({
        where: {
          ...(query.salleId ? { salleId: query.salleId } : {}),
          dateJour: { gte: debut, lte: fin },
        },
        include: RESERVATION_INCLUDE,
        orderBy: { heureDebut: 'asc' },
      }),
      this.prisma.seance.findMany({
        ...SEANCE_CALENDRIER,
        where: {
          ...(query.salleId ? { salleId: query.salleId } : {}),
          salleId: { not: null },
          date: { gte: debut, lte: fin },
          statut: { not: 'ANNULE' },
          ...perimetreSeances,
        },
        orderBy: { heureDebut: 'asc' },
      }),
      salles,
    ]);

    const jours = joursEntre(query.dateDebut, query.dateFin).map((date) => ({
      date,
      reservations: [] as any[],
      seances: [] as any[],
    }));

    const parDate = new Map(jours.map((j) => [j.date, j]));
    for (const r of reservations) {
      const vue =
        this.gestionnaire(user) || r.demandeurId === user.id
          ? r
          : {
              ...r,
              motif: null,
              organisme: null,
              responsable: null,
              demandeurId: null,
              demandeur: null,
              refuseParId: null,
              refusePar: null,
              refuseMotif: null,
            };
      parDate.get(isoDate(r.dateJour))?.reservations.push(vue);
    }
    for (const s of seances) parDate.get(isoDate(s.date))?.seances.push(s);

    return { dateDebut: query.dateDebut, dateFin: query.dateFin, salles: listeSalles, jours };
  }
}
