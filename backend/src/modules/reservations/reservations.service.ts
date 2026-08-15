import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Role, StatutReservationSalle } from '@prisma/client';
import { CrudService } from '../../common/crud.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { dureeMinutes, isoDate, toDateOnly, toMinutes } from '../../common/utils';
import { joursEntre } from './calendrier';
import {
  CalendrierQueryDto,
  CreateReservationDto,
  DeciderReservationDto,
  ReservationQueryDto,
  UpdateReservationDto,
} from './reservations.dto';

export const RESERVATION_INCLUDE = {
  salle: true,
  demandeur: { select: { id: true, nom: true, prenom: true } },
  refusePar: { select: { id: true, nom: true, prenom: true } },
};

/** Seules les demandes encore vives occupent la salle : une réservation
 *  refusée ou annulée rend le créneau disponible aussitôt. */
const STATUTS_OCCUPANTS = [StatutReservationSalle.EN_ATTENTE, StatutReservationSalle.CONFIRMEE];

const LIBELLE_STATUT: Record<StatutReservationSalle, string> = {
  EN_ATTENTE: 'en attente',
  CONFIRMEE: 'confirmée',
  REFUSEE: 'refusée',
  ANNULEE: 'annulée',
};

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

const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

@Injectable()
export class ReservationsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'reservationSalle', {
      orderBy: [{ dateJour: 'asc' }, { heureDebut: 'asc' }],
      include: RESERVATION_INCLUDE,
      label: 'Réservation',
    });
  }

  private where(query: ReservationQueryDto): Prisma.ReservationSalleWhereInput {
    return {
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(query.dateJour ? { dateJour: toDateOnly(query.dateJour) } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
    };
  }

  liste(query: ReservationQueryDto) {
    return this.findAll(query, this.where(query));
  }

  /** Journée universitaire : tout événement tient entre 07:00 et 22:00. */
  private verifierHeures(debut: string, fin: string) {
    if (dureeMinutes(debut, fin) <= 0) {
      throw new BadRequestException("L'heure de fin doit suivre l'heure de début");
    }
    const d = toMinutes(debut)!;
    const f = toMinutes(fin)!;
    if (d < 7 * 60 || f > 22 * 60) {
      throw new BadRequestException('Les réservations sont possibles entre 07h00 et 22h00');
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
  ) {
    this.verifierHeures(heureDebut, heureFin);
    const d = toMinutes(heureDebut)!;
    const f = toMinutes(heureFin)!;

    const concurrentes = await this.prisma.reservationSalle.findMany({
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
        `Cette salle est déjà réservée de ${collision.heureDebut} à ${collision.heureFin} ` +
          `le ${jjmm(isoDate(collision.dateJour))} (${LIBELLE_STATUT[collision.statut]}` +
          `${collision.motif ? ` — ${collision.motif}` : ''})`,
      );
    }
  }

  private trace(user: AuthUser, action: string, id: string, details?: string) {
    return this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        entite: 'ReservationSalle',
        entiteId: id,
        details,
      },
    });
  }

  async creer(dto: CreateReservationDto, user: AuthUser) {
    await this.verifierConflit(dto.salleId, dto.dateJour, dto.heureDebut, dto.heureFin);
    const { dateJour, ...reste } = dto;
    const creee = await this.create({
      ...reste,
      dateJour: toDateOnly(dateJour),
      demandeurId: user.id,
    });
    await this.trace(user, 'RESERVATION_CREEE', creee.id, `${dto.motif} — ${dto.organisme ?? ''}`);
    return creee;
  }

  async modifier(id: string, dto: UpdateReservationDto, user: AuthUser) {
    const existante: any = await this.findOne(id);
    if (existante.demandeurId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Seul le demandeur ou l’administrateur peut modifier');
    }
    if (existante.statut !== StatutReservationSalle.EN_ATTENTE) {
      throw new BadRequestException('Une réservation déjà statuée ne peut plus être modifiée');
    }
    await this.verifierConflit(
      dto.salleId ?? existante.salleId,
      dto.dateJour ?? isoDate(existante.dateJour),
      dto.heureDebut ?? existante.heureDebut,
      dto.heureFin ?? existante.heureFin,
      id,
    );
    const maj = await this.update(id, {
      ...dto,
      ...(dto.dateJour !== undefined ? { dateJour: toDateOnly(dto.dateJour) } : {}),
    });
    await this.trace(user, 'RESERVATION_MODIFIEE', id, dto.motif ?? existante.motif);
    return maj;
  }

  async supprimer(id: string, user: AuthUser) {
    const existante = await this.findOne(id);
    if (existante.demandeurId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Seul le demandeur ou l’administrateur peut annuler');
    }
    const res = await this.remove(id);
    await this.trace(user, 'RESERVATION_SUPPRIMEE', id, existante.motif);
    return res;
  }

  /**
   * Décision de l'administration. Une confirmation re-vérifie les conflits :
   * entre-temps, une autre demande a pu réserver le créneau — 409 alors.
   */
  async decider(id: string, dto: DeciderReservationDto, user: AuthUser) {
    const existante = await this.findOne(id);
    if (existante.statut !== StatutReservationSalle.EN_ATTENTE) {
      throw new BadRequestException('Cette réservation a déjà été statuée');
    }

    const data: Prisma.ReservationSalleUpdateInput = { statut: dto.statut };
    if (dto.statut === 'CONFIRMEE') {
      await this.verifierConflit(
        existante.salleId,
        isoDate(existante.dateJour),
        existante.heureDebut,
        existante.heureFin,
        id,
      );
    } else {
      data.refusePar = { connect: { id: user.id } };
      if (dto.motif) data.refuseMotif = dto.motif;
    }

    const maj = await this.update(id, data);
    await this.trace(user, `RESERVATION_${dto.statut}`, id, dto.motif ?? existante.motif);
    return maj;
  }

  /**
   * Vue semaine : une ligne par jour, avec ses réservations et, sur la même
   * grille, les séances de l'emploi du temps — en lecture seule, pour
   * constater les conflits avant de demander une salle.
   */
  async calendrier(query: CalendrierQueryDto) {
    const debut = toDateOnly(query.dateDebut);
    const fin = toDateOnly(query.dateFin);
    if (fin < debut) throw new BadRequestException('Période invalide');

    const salles = query.salleId
      ? this.prisma.salle.findMany({ where: { id: query.salleId } })
      : this.prisma.salle.findMany({ where: { actif: true }, orderBy: { code: 'asc' } });

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
          statut: { not: 'ANNULEE' },
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
    for (const r of reservations) parDate.get(isoDate(r.dateJour))?.reservations.push(r);
    for (const s of seances) parDate.get(isoDate(s.date))?.seances.push(s);

    return { dateDebut: query.dateDebut, dateFin: query.dateFin, salles: listeSalles, jours };
  }
}