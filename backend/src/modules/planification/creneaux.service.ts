import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role, StatutInscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { CrudService } from '../../common/crud.service';
import { t } from '../../common/i18n';
import { exigerAnneeOuverte } from '../../common/annee';
import { dureeMinutes, toMinutes, toDateOnly, isoDate, JOURS } from '../../common/utils';
import { CreateCreneauDto, CreneauQueryDto, UpdateCreneauDto } from './planification.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';
import { estChefDeDepartement } from '../../common/perimetre';

export const CRENEAU_INCLUDE = {
  affectation: {
    include: {
      enseignant: {
        select: {
          id: true,
          matricule: true,
          nom: true,
          prenom: true,
          grade: true,
          statut: true,
          actif: true,
          departementId: true,
          departement: { select: { id: true, nom: true } },
        },
      },
      matiere: true,
      promotion: { include: { filiere: true } },
    },
  },
  salle: { select: { id: true, code: true, nom: true } },
};

const CRENEAU_INCLUDE_ETUDIANT = {
  affectation: {
    select: {
      id: true,
      enseignant: { select: { id: true, nom: true, prenom: true } },
      matiere: { select: { id: true, code: true, intitule: true } },
      promotion: { select: { id: true, nom: true } },
    },
  },
  salle: { select: { id: true, code: true } },
};

type Periode = { dateDebut: Date | null; dateFin: Date | null };

/** Deux périodes ouvertes d'un côté ou de l'autre se croisent-elles ? */
function periodesSeCroisent(a: Periode, b: Periode) {
  const aDebut = a.dateDebut?.getTime() ?? -Infinity;
  const aFin = a.dateFin?.getTime() ?? Infinity;
  const bDebut = b.dateDebut?.getTime() ?? -Infinity;
  const bFin = b.dateFin?.getTime() ?? Infinity;
  return aDebut <= bFin && bDebut <= aFin;
}

/** Un créneau vaut-il ce jour-là ? Sans période, il vaut toute l'année. */
export function creneauVaut(creneau: Periode, jour: Date) {
  return periodesSeCroisent(creneau, { dateDebut: jour, dateFin: jour });
}

@Injectable()
export class CreneauxService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'creneau', {
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
      include: CRENEAU_INCLUDE,
      label: 'Créneau',
    });
  }

  private where(query: CreneauQueryDto, user?: AuthUser) {
    const affectation: Record<string, any> = {};
    if (query.anneeId) affectation.anneeId = query.anneeId;
    if (query.enseignantId) affectation.enseignantId = query.enseignantId;
    if (query.promotionId) affectation.promotionId = query.promotionId;

    if (user?.role === Role.ENSEIGNANT) {
      affectation.enseignantId = user.enseignantId ?? '__aucun_enseignant__';
    } else if (estChefDeDepartement(user) || user?.role === Role.CONTROLEUR) {
      affectation.enseignant = { departementId: user.departementId ?? '__aucun_departement__' };
    } else if (user?.role === Role.ETUDIANT) {
      const etudiantId = user.etudiantId ?? '__aucun_etudiant__';
      affectation.annee = { active: true, cloturee: false };
      affectation.promotion = {
        inscriptions: {
          some: {
            etudiantId,
            statut: StatutInscription.VALIDEE,
            annee: { active: true, cloturee: false },
          },
        },
      };
    }

    return {
      ...(Object.keys(affectation).length ? { affectation } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(query.jourSemaine ? { jourSemaine: Number(query.jourSemaine) } : {}),
    };
  }

  liste(query: CreneauQueryDto, user: AuthUser) {
    if (user.role !== Role.ETUDIANT) return this.findAll(query, this.where(query, user));

    const where = this.where(query, user);
    const pagination = paginer(query);
    return Promise.all([
      this.prisma.creneau.findMany({
        where,
        include: CRENEAU_INCLUDE_ETUDIANT,
        orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.creneau.count({ where }),
    ]).then(([data, total]) => pagine(data, total, pagination));
  }

  /** Emploi du temps hebdomadaire regroupé par jour. */
  async emploiDuTemps(query: CreneauQueryDto, user: AuthUser) {
    const reference = query.semaineDu ? toDateOnly(query.semaineDu) : toDateOnly(isoDate(new Date()));
    const lundi = new Date(reference);
    lundi.setUTCDate(lundi.getUTCDate() - ((lundi.getUTCDay() + 6) % 7));
    const dimanche = new Date(lundi.getTime() + 6 * 86400000);
    const base = this.where(query, user) as Prisma.CreneauWhereInput;
    const filtresExistants = base.AND ? (Array.isArray(base.AND) ? base.AND : [base.AND]) : [];
    const where: Prisma.CreneauWhereInput = {
      actif: true,
      ...base,
      AND: [
        ...filtresExistants,
        { OR: [{ dateDebut: null }, { dateDebut: { lte: dimanche } }] },
        { OR: [{ dateFin: null }, { dateFin: { gte: lundi } }] },
      ],
    };
    const creneaux = await this.prisma.creneau.findMany({
      where,
      include: user.role === Role.ETUDIANT ? CRENEAU_INCLUDE_ETUDIANT : CRENEAU_INCLUDE,
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
      take: 2000,
    });

    // Le filtre SQL borne déjà les créneaux à la semaine de référence ; ce
    // contrôle garde la règle métier des périodes date-only côté serveur.
    const retenus = creneaux.filter((c) => periodesSeCroisent(c, { dateDebut: lundi, dateFin: dimanche }));

    return [1, 2, 3, 4, 5, 6, 7].map((jour) => ({
      jour,
      libelle: JOURS[jour],
      creneaux: retenus.filter((c) => c.jourSemaine === jour),
    }));
  }

  async findOne(id: string, user?: AuthUser) {
    if (!user) throw new UnauthorizedException(t('common.unauthorized'));
    const creneau = await this.prisma.creneau.findFirst({
      where: { id, ...this.where({}, user) },
      include: user.role === Role.ETUDIANT ? CRENEAU_INCLUDE_ETUDIANT : CRENEAU_INCLUDE,
    });
    if (!creneau) throw new NotFoundException(t('common.notFoundRecord'));
    return creneau;
  }

  /** Refuse un créneau incohérent ou en collision (même salle / même enseignant). */
  private async valider(dto: CreateCreneauDto | UpdateCreneauDto, id?: string, db: any = this.prisma, user?: AuthUser) {
    const base = id ? await db.creneau.findUnique({ where: { id }, include: { affectation: true } }) : null;
    const debut = dto.heureDebut ?? base?.heureDebut;
    const fin = dto.heureFin ?? base?.heureFin;
    const dateDebut =
      dto.dateDebut !== undefined
        ? dto.dateDebut
          ? toDateOnly(dto.dateDebut)
          : null
        : base?.dateDebut
          ? toDateOnly(base.dateDebut)
          : null;
    const dateFin =
      dto.dateFin !== undefined
        ? dto.dateFin
          ? toDateOnly(dto.dateFin)
          : null
        : base?.dateFin
          ? toDateOnly(base.dateFin)
          : null;

    if (debut && fin && dureeMinutes(debut, fin) <= 0) {
      throw new BadRequestException(t('planification.l_heure_de_fin_doit_suivre_l_heure_de_debut'));
    }
    if (dateDebut && dateFin && dateFin < dateDebut) {
      throw new BadRequestException(t('planification.la_fin_de_la_periode_doit_suivre_son_debut'));
    }

    const jour = dto.jourSemaine ?? base?.jourSemaine;
    const salleId = dto.salleId ?? base?.salleId;
    const affectationId = dto.affectationId ?? base?.affectationId;
    const periode = {
      dateDebut,
      dateFin,
    };
    if (!jour || !debut || !fin || !affectationId) return;

    const scope = this.where({}, user).affectation;
    const affectation = await db.affectation.findFirst({
      where: { id: affectationId, ...(scope ?? {}) },
      include: { annee: { select: { cloturee: true } } },
    });
    if (!affectation) throw new BadRequestException(t('planification.affectation_introuvable'));
    await exigerAnneeOuverte(db, affectation.anneeId);

    const memeJour = await db.creneau.findMany({
      where: {
        jourSemaine: jour,
        actif: true,
        ...(id ? { NOT: { id } } : {}),
        OR: [
          ...(salleId ? [{ salleId }] : []),
          { affectation: { enseignantId: affectation.enseignantId } },
          { affectation: { promotionId: affectation.promotionId } },
        ],
      },
      include: CRENEAU_INCLUDE,
    });

    const d = toMinutes(debut)!;
    const f = toMinutes(fin)!;
    const collision = memeJour.find((c) => {
      const cd = toMinutes(c.heureDebut)!;
      const cf = toMinutes(c.heureFin)!;
      // Deux créneaux à la même heure dans la même salle ne se gênent pas si
      // leurs périodes ne se croisent pas : « janvier avec M. Bah, février
      // avec Mme Diallo » est un emploi du temps parfaitement valide.
      return d < cf && cd < f && periodesSeCroisent(periode, c);
    });

    if (collision) {
      throw new BadRequestException(
        t('planification.conflit_d_emploi_du_temps_jour_collision_heuredebut_collision', {
          jour: JOURS[jour],
          debut: collision.heureDebut,
          fin: collision.heureFin,
        }),
      );
    }
  }

  /** Les dates arrivent en ISO ; la base attend des dates sans heure. */
  private payload<T extends CreateCreneauDto | UpdateCreneauDto>(dto: T) {
    const { dateDebut, dateFin, ...reste } = dto;
    return {
      ...reste,
      ...(dateDebut !== undefined ? { dateDebut: dateDebut ? toDateOnly(dateDebut) : null } : {}),
      ...(dateFin !== undefined ? { dateFin: dateFin ? toDateOnly(dateFin) : null } : {}),
    };
  }

  async creer(dto: CreateCreneauDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.valider(dto, undefined, tx, user);
        const creneau = await tx.creneau.create({ data: this.payload(dto), include: CRENEAU_INCLUDE });
        await journaliser(tx, user ?? null, 'CRENEAU_CREE', 'Creneau', creneau.id, {
          avant: null,
          apres: this.instantaneAudit(creneau),
        });
        return creneau;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Même contrôle de collision lors de la prévisualisation d'un import. */
  async verifierImport(dto: CreateCreneauDto) {
    await this.valider(dto);
  }

  async modifier(id: string, dto: UpdateCreneauDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant: any = await tx.creneau.findFirst({
          where: { id, ...this.where({}, user) },
          include: CRENEAU_INCLUDE,
        });
        if (!avant) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, avant.affectation.anneeId);
        await this.valider(dto, id, tx, user);
        const cible: any = dto.affectationId
          ? await tx.affectation.findFirst({
              where: { id: dto.affectationId, ...(this.where({}, user).affectation ?? {}) },
              select: { anneeId: true },
            })
          : { anneeId: avant.affectation.anneeId };
        if (!cible) throw new NotFoundException(t('common.notFound'));
        if (cible) await exigerAnneeOuverte(tx, cible.anneeId);
        const apres = await tx.creneau.update({ where: { id }, data: this.payload(dto), include: CRENEAU_INCLUDE });
        await journaliser(tx, user ?? null, 'CRENEAU_MODIFIE', 'Creneau', id, {
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
        const creneau: any = await tx.creneau.findFirst({
          where: { id, ...this.where({}, user) },
          include: CRENEAU_INCLUDE,
        });
        if (!creneau) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, creneau.affectation.anneeId);
        await tx.creneau.delete({ where: { id } });
        await journaliser(tx, user ?? null, 'CRENEAU_SUPPRIME', 'Creneau', id, {
          avant: this.instantaneAudit(creneau),
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private instantaneAudit(creneau: any) {
    return {
      id: creneau.id,
      affectationId: creneau.affectationId,
      jourSemaine: creneau.jourSemaine,
      heureDebut: creneau.heureDebut,
      heureFin: creneau.heureFin,
      salleId: creneau.salleId,
      dateDebut: creneau.dateDebut,
      dateFin: creneau.dateFin,
      actif: creneau.actif,
    };
  }
}
