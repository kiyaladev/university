import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Role, StatutSeance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CrudService } from '../../common/crud.service';
import { AuthUser } from '../../common/decorators';
import { isoDate, jourSemaine, toDateOnly, dureeMinutes } from '../../common/utils';
import {
  CreateSeanceDto,
  GenerationDto,
  SeanceQueryDto,
  UpdateSeanceDto,
} from './planification.dto';

/** Un créneau vaut-il à cette date ? Sans période, il vaut toute l'année. */
function vaut(creneau: { dateDebut: Date | null; dateFin: Date | null }, jour: Date) {
  if (creneau.dateDebut && jour < toDateOnly(isoDate(creneau.dateDebut))) return false;
  if (creneau.dateFin && jour > toDateOnly(isoDate(creneau.dateFin))) return false;
  return true;
}

export const SEANCE_INCLUDE = {
  affectation: {
    include: {
      enseignant: { include: { departement: true } },
      matiere: true,
      promotion: { include: { filiere: { include: { departement: true } } } },
    },
  },
  salle: true,
  controle: {
    include: {
      controleur: { select: { id: true, nom: true, prenom: true, role: true } },
      enseignantRemplacant: { select: { id: true, nom: true, prenom: true } },
    },
  },
  justificatif: true,
};

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

  /** Filtre Prisma dérivé des paramètres d'URL + du périmètre de l'utilisateur. */
  where(query: SeanceQueryDto, user?: AuthUser): Prisma.SeanceWhereInput {
    const affectation: Record<string, any> = {};
    if (query.anneeId) affectation.anneeId = query.anneeId;
    if (query.enseignantId) affectation.enseignantId = query.enseignantId;
    if (query.promotionId) affectation.promotionId = query.promotionId;
    if (query.matiereId) affectation.matiereId = query.matiereId;
    if (query.departementId) {
      affectation.enseignant = { departementId: query.departementId };
    }

    // Un enseignant ne voit que ses propres séances ; un chef de département
    // ne voit que celles de son département.
    if (user?.role === Role.ENSEIGNANT) {
      affectation.enseignantId = user.enseignantId ?? '—';
    } else if (user?.role === Role.CHEF_DEPARTEMENT && user.departementId) {
      affectation.enseignant = { departementId: user.departementId };
    }

    const date: Prisma.DateTimeFilter = {};
    if (query.date) {
      date.equals = toDateOnly(query.date);
    } else {
      if (query.dateDebut) date.gte = toDateOnly(query.dateDebut);
      if (query.dateFin) date.lte = toDateOnly(query.dateFin);
    }

    return {
      ...(Object.keys(affectation).length ? { affectation } : {}),
      ...(Object.keys(date).length ? { date } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(query.statut ? { statut: query.statut as StatutSeance } : {}),
      ...(query.nonControlees === '1' || query.nonControlees === 'true'
        ? { controle: { is: null } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { thematique: { contains: query.search, mode: 'insensitive' } },
              {
                affectation: {
                  matiere: { intitule: { contains: query.search, mode: 'insensitive' } },
                },
              },
              {
                affectation: {
                  enseignant: { nom: { contains: query.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
  }

  liste(query: SeanceQueryDto, user?: AuthUser) {
    return this.findAll(
      { ...query, search: undefined, sort: query.sort ?? undefined },
      this.where(query, user),
    );
  }

  /** Feuille de route du contrôleur : les séances d'une journée, par heure. */
  async journee(date: string | undefined, query: SeanceQueryDto, user?: AuthUser) {
    const jour = date ?? isoDate(new Date());
    const seances = await this.prisma.seance.findMany({
      where: this.where({ ...query, date: jour }, user),
      include: SEANCE_INCLUDE,
      orderBy: [{ heureDebut: 'asc' }],
    });

    return {
      date: jour,
      total: seances.length,
      controlees: seances.filter((s) => s.controle).length,
      enAttente: seances.filter((s) => !s.controle && s.statut !== StatutSeance.ANNULEE).length,
      seances,
    };
  }

  private async payload(dto: CreateSeanceDto | UpdateSeanceDto, anneeId?: string) {
    const { affectationId, date, ...rest } = dto as CreateSeanceDto;
    let annee = anneeId;
    if (affectationId && !annee) {
      const aff = await this.prisma.affectation.findUnique({ where: { id: affectationId } });
      if (!aff) throw new BadRequestException('Affectation introuvable');
      annee = aff.anneeId;
    }
    if (dto.heureDebut && dto.heureFin && dureeMinutes(dto.heureDebut, dto.heureFin) <= 0) {
      throw new BadRequestException("L'heure de fin doit suivre l'heure de début");
    }
    return {
      ...rest,
      ...(affectationId ? { affectationId } : {}),
      ...(date ? { date: toDateOnly(date) } : {}),
      ...(annee ? { anneeId: annee } : {}),
    };
  }

  async creer(dto: CreateSeanceDto) {
    return this.create(await this.payload(dto));
  }

  async modifier(id: string, dto: UpdateSeanceDto) {
    return this.update(id, await this.payload(dto));
  }

  async annuler(id: string, motif?: string) {
    const seance: any = await this.findOne(id);
    if (seance.controle) {
      throw new BadRequestException('Une séance déjà contrôlée ne peut pas être annulée');
    }
    return this.update(id, {
      statut: StatutSeance.ANNULEE,
      thematique: motif ? `[Annulée] ${motif}` : seance.thematique,
    });
  }

  /**
   * Génère les séances d'une période à partir des créneaux récurrents.
   * Les séances déjà existantes (même affectation, date, heure) sont ignorées.
   *
   * Un créneau peut ne valoir que sur une partie de l'année — « chaque lundi
   * 08h-12h, du 1er au 31 janvier » : hors de sa période, il ne produit rien.
   */
  async generer(dto: GenerationDto) {
    const debut = toDateOnly(dto.dateDebut);
    const fin = toDateOnly(dto.dateFin);
    if (fin < debut) throw new BadRequestException('Période invalide');
    if ((fin.getTime() - debut.getTime()) / 86400000 > 400) {
      throw new BadRequestException('Période trop longue (maximum 400 jours)');
    }

    const creneaux = await this.prisma.creneau.findMany({
      where: {
        actif: true,
        affectation: { anneeId: dto.anneeId },
        ...(dto.creneauIds?.length ? { id: { in: dto.creneauIds } } : {}),
      },
    });
    if (!creneaux.length) {
      throw new BadRequestException('Aucun créneau actif à générer pour cette année');
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

    const res = await this.prisma.seance.createMany({ data: lignes, skipDuplicates: true });
    return {
      creneaux: creneaux.length,
      candidates: lignes.length,
      creees: res.count,
      ignorees: lignes.length - res.count,
      periode: { debut: isoDate(debut), fin: isoDate(fin) },
    };
  }

  /**
   * Chaque nuit : les séances passées jamais contrôlées passent en NON_TENUE.
   * C'est ce qui alimente la liste « séances sans contrôle » des rapports.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cloturerSeancesPassees() {
    const hier = toDateOnly(new Date());
    hier.setUTCDate(hier.getUTCDate() - 1);

    const res = await this.prisma.seance.updateMany({
      where: { date: { lte: hier }, statut: StatutSeance.PLANIFIEE, controle: { is: null } },
      data: { statut: StatutSeance.NON_TENUE },
    });
    if (res.count) {
      this.logger.log(`${res.count} séance(s) passée(s) sans contrôle marquée(s) NON_TENUE`);
    }
    return res;
  }
}
