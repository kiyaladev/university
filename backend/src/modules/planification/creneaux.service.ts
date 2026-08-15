import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrudService } from '../../common/crud.service';
import { dureeMinutes, toMinutes, toDateOnly, isoDate, JOURS } from '../../common/utils';
import { CreateCreneauDto, CreneauQueryDto, UpdateCreneauDto } from './planification.dto';

export const CRENEAU_INCLUDE = {
  affectation: {
    include: {
      enseignant: true,
      matiere: true,
      promotion: { include: { filiere: true } },
    },
  },
  salle: true,
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

const jjmm = (d: Date) => isoDate(d).slice(8, 10) + '/' + isoDate(d).slice(5, 7);

function libellePeriode(c: Periode) {
  if (c.dateDebut && c.dateFin) return `, du ${jjmm(c.dateDebut)} au ${jjmm(c.dateFin)}`;
  if (c.dateDebut) return `, à partir du ${jjmm(c.dateDebut)}`;
  if (c.dateFin) return `, jusqu'au ${jjmm(c.dateFin)}`;
  return '';
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

  private where(query: CreneauQueryDto) {
    const affectation: Record<string, any> = {};
    if (query.anneeId) affectation.anneeId = query.anneeId;
    if (query.enseignantId) affectation.enseignantId = query.enseignantId;
    if (query.promotionId) affectation.promotionId = query.promotionId;

    return {
      ...(Object.keys(affectation).length ? { affectation } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(query.jourSemaine ? { jourSemaine: Number(query.jourSemaine) } : {}),
    };
  }

  liste(query: CreneauQueryDto) {
    return this.findAll(query, this.where(query));
  }

  /** Emploi du temps hebdomadaire regroupé par jour. */
  async emploiDuTemps(query: CreneauQueryDto) {
    const creneaux = await this.prisma.creneau.findMany({
      where: { actif: true, ...this.where(query) },
      include: CRENEAU_INCLUDE,
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
    });

    // Semaine de référence : on ne montre que ce qui vaut réellement cette
    // semaine-là, sinon la grille mélange janvier et mai.
    const retenus = query.semaineDu
      ? creneaux.filter((c) => {
          const lundi = toDateOnly(query.semaineDu!);
          const dimanche = new Date(lundi.getTime() + 6 * 86400000);
          return periodesSeCroisent(c, { dateDebut: lundi, dateFin: dimanche });
        })
      : creneaux;

    return [1, 2, 3, 4, 5, 6, 7].map((jour) => ({
      jour,
      libelle: JOURS[jour],
      creneaux: retenus.filter((c) => c.jourSemaine === jour),
    }));
  }

  /** Refuse un créneau incohérent ou en collision (même salle / même enseignant). */
  private async valider(dto: CreateCreneauDto | UpdateCreneauDto, id?: string) {
    if (dto.heureDebut && dto.heureFin && dureeMinutes(dto.heureDebut, dto.heureFin) <= 0) {
      throw new BadRequestException("L'heure de fin doit suivre l'heure de début");
    }
    if (dto.dateDebut && dto.dateFin && toDateOnly(dto.dateFin) < toDateOnly(dto.dateDebut)) {
      throw new BadRequestException('La fin de la période doit suivre son début');
    }

    const base = id ? await this.prisma.creneau.findUnique({ where: { id } }) : null;
    const jour = dto.jourSemaine ?? base?.jourSemaine;
    const debut = dto.heureDebut ?? base?.heureDebut;
    const fin = dto.heureFin ?? base?.heureFin;
    const salleId = dto.salleId ?? base?.salleId;
    const affectationId = dto.affectationId ?? base?.affectationId;
    const periode = {
      dateDebut: dto.dateDebut ? toDateOnly(dto.dateDebut) : (base?.dateDebut ?? null),
      dateFin: dto.dateFin ? toDateOnly(dto.dateFin) : (base?.dateFin ?? null),
    };
    if (!jour || !debut || !fin || !affectationId) return;

    const affectation = await this.prisma.affectation.findUnique({
      where: { id: affectationId },
    });
    if (!affectation) throw new BadRequestException('Affectation introuvable');

    const memeJour = await this.prisma.creneau.findMany({
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
        `Conflit d'emploi du temps : ${JOURS[jour]} ${collision.heureDebut}-${collision.heureFin} ` +
          `(${collision.affectation.matiere.intitule} — ${collision.affectation.promotion.nom}` +
          `${collision.salle ? `, salle ${collision.salle.code}` : ''}` +
          `${libellePeriode(collision)})`,
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

  async creer(dto: CreateCreneauDto) {
    await this.valider(dto);
    return this.create(this.payload(dto));
  }

  async modifier(id: string, dto: UpdateCreneauDto) {
    await this.valider(dto, id);
    return this.update(id, this.payload(dto));
  }
}
