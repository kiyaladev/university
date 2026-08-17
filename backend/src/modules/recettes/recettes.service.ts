/**
 * Module Recettes — régie des recettes externes (ateliers, formations,
 * location d'amphithéâtre, prestations de conseil, etc.).
 *
 * Une recette est émise par la scolarité ou un service ; elle est
 * « encaissée » en créant un Paiement REUSSI rattaché (par `paiementId`) qui
 * passe automatiquement la recette à l'état « payée » : c'est ce que
 * consulte le dashboard (KPIs par type et par mois).
 *
 * Le numéro suit le pattern "REC-<AAAA>-NNNNN" : généré côté service par
 * lecture séquentielle (même mécanique que les paiements).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ModePaiement, Prisma, StatutPaiement, TypeRecette } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { toDateOnly } from '../../common/utils';
import {
  CreateRecetteDto,
  EncaisserRecetteDto,
  RecetteQueryDto,
  UpdateRecetteDto,
} from './recettes.dto';

const RECETTE_INCLUDE = {
  paiement: true,
  creePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.RecetteExterneInclude;

@Injectable()
export class RecettesService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------- lecture

  async liste(query: RecetteQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.RecetteExterneWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.client ? { client: { contains: query.client, mode: 'insensitive' } } : {}),
    };

    if (query.dateDebut || query.dateFin) {
      where.date = {};
      if (query.dateDebut) where.date.gte = toDateOnly(query.dateDebut);
      if (query.dateFin) where.date.lte = toDateOnly(query.dateFin);
    }

    if (query.paiementStatut) {
      where.paiement = { statut: query.paiementStatut };
    }

    const [data, total] = await Promise.all([
      this.prisma.recetteExterne.findMany({
        where,
        include: RECETTE_INCLUDE,
        orderBy: [{ date: 'desc' }, { numero: 'desc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.recetteExterne.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const recette = await this.prisma.recetteExterne.findUnique({
      where: { id },
      include: RECETTE_INCLUDE,
    });
    if (!recette) throw new NotFoundException('Recette introuvable');
    return recette;
  }

  // ---------------------------------------------------- création

  async creer(dto: CreateRecetteDto, user: AuthUser) {
    const recette = await this.prisma.recetteExterne.create({
      data: {
        numero: dto.numero,
        type: dto.type,
        libelle: dto.libelle,
        description: dto.description ?? null,
        montant: dto.montant,
        devise: dto.devise ?? 'GNF',
        date: toDateOnly(dto.date),
        client: dto.client ?? null,
        factureNum: dto.factureNum ?? null,
        creeParId: user.id,
      },
      include: RECETTE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'RECETTE_CREEE',
        entite: 'RecetteExterne',
        entiteId: recette.id,
        details: `${recette.numero} — ${recette.montant} ${recette.devise} (${recette.type})`,
      },
    });
    return recette;
  }

  async modifier(id: string, dto: UpdateRecetteDto, user: AuthUser) {
    const actuel = await this.trouver(id);
    const maj = await this.prisma.recetteExterne.update({
      where: { id },
      data: {
        type: dto.type ?? actuel.type,
        libelle: dto.libelle ?? actuel.libelle,
        description: dto.description ?? actuel.description,
        montant: dto.montant ?? actuel.montant,
        devise: dto.devise ?? actuel.devise,
        date: dto.date ? toDateOnly(dto.date) : actuel.date,
        client: dto.client ?? actuel.client,
        factureNum: dto.factureNum ?? actuel.factureNum,
      },
      include: RECETTE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'RECETTE_MODIFIEE',
        entite: 'RecetteExterne',
        entiteId: id,
        details: `${maj.numero}`,
      },
    });
    return maj;
  }

  // ---------------------------------------------------- encaissement

  /**
   * Encaissement : crée un Paiement REUSSI (montant, devise = recette) puis
   * rattache `recette.paiementId` à ce paiement. La relation est 1-1.
   * Une recette déjà encaissée ne peut plus l'être à nouveau — refusée.
   */
  async encaisser(id: string, dto: EncaisserRecetteDto, user: AuthUser) {
    const recette = await this.trouver(id);
    if (recette.paiementId) {
      throw new NotFoundException(
        'Cette recette a déjà été encaissée (paiement déjà rattaché)',
      );
    }

    const annee = String(recette.date.getUTCFullYear());
    const modeEnum: ModePaiement =
      (dto.mode as ModePaiement | undefined) ?? ModePaiement.ESPECES;

    const paiement = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.paiement.create({
        data: {
          reference: await this.prochainNumeroPaiement(tx, annee),
          montant: recette.montant,
          devise: recette.devise,
          mode: modeEnum,
          operateur: dto.operateur ?? null,
          telephone: dto.telephone ?? null,
          nomComplet: dto.nomComplet ?? recette.client ?? null,
          motif: `Recette externe ${recette.numero} — ${recette.libelle}`,
          statut: StatutPaiement.REUSSI,
          creeParId: user.id,
        },
        select: { id: true, reference: true },
      });

      return tx.recetteExterne.update({
        where: { id },
        data: { paiementId: cree.id },
        include: RECETTE_INCLUDE,
      });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'RECETTE_ENCAISSEE',
        entite: 'RecetteExterne',
        entiteId: id,
        details: `${recette.numero} — ${recette.montant} ${recette.devise} (${recette.type})`,
      },
    });

    return paiement;
  }

  // ----------------------------------------------------- dashboard

  /**
   * KPIs pour la direction :
   *   - par type, par mois (12 derniers) ;
   *   - top 3 des types par montant cumulé ;
   *   - totaux mois courant et année courante (par défaut devise GNF).
   */
  async dashboard() {
    const maintenant = new Date();
    const annee = maintenant.getUTCFullYear();
    const mois = maintenant.getUTCMonth();
    const debutMois = new Date(Date.UTC(annee, mois, 1));
    const finMois = new Date(Date.UTC(annee, mois + 1, 0));
    const debutAnnee = new Date(Date.UTC(annee, 0, 1));
    const finAnnee = new Date(Date.UTC(annee, 11, 31));

    const [parType, parMois, totaux, top3] = await Promise.all([
      this.prisma.recetteExterne.groupBy({
        by: ['type'],
        _sum: { montant: true },
        _count: { _all: true },
        where: { date: { gte: debutAnnee, lte: finAnnee } },
      }),
      this.prisma.recetteExterne.findMany({
        where: { date: { gte: new Date(Date.UTC(annee, 0, 1)), lte: finAnnee } },
        select: { date: true, montant: true, devise: true },
      }),
      this.prisma.recetteExterne.aggregate({
        _sum: { montant: true },
        where: {
          OR: [
            { date: { gte: debutMois, lte: finMois } },
            { date: { gte: debutAnnee, lte: finAnnee } },
          ],
        },
      }),
      this.prisma.recetteExterne.groupBy({
        by: ['type'],
        _sum: { montant: true },
        orderBy: { _sum: { montant: 'desc' } },
        take: 3,
      }),
    ]);

    // Agrégation mois par mois (mois 1..12 de l'année courante).
    const moisCourants = Array.from({ length: 12 }, (_, i) => ({
      mois: i + 1,
      libelle: MOIS_LIBELLES[i + 1],
      total: 0,
    }));
    for (const r of parMois) {
      const m = r.date.getUTCMonth();
      moisCourants[m].total += r.montant ?? 0;
    }

    return {
      annee,
      totalMois: moisCourants[mois].total,
      totalAnnee: totaux._sum.montant ?? 0,
      parType: parType.map((p) => ({
        type: p.type,
        total: p._sum.montant ?? 0,
        nb: p._count._all,
      })),
      parMois: moisCourants,
      top3: top3.map((t) => ({ type: t.type, total: t._sum.montant ?? 0 })),
    };
  }

  // ------------------------------------------------------- helpers

  private async prochainNumeroPaiement(
    tx: Prisma.TransactionClient,
    annee: string,
  ): Promise<string> {
    const prefixe = `PAY-R-${annee}-`;
    const existantes = await tx.paiement.findMany({
      where: { reference: { startsWith: prefixe } },
      select: { reference: true },
    });
    const max = existantes.reduce((m, p) => {
      const n = Number(p.reference.slice(prefixe.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefixe}${String(max + 1).padStart(5, '0')}`;
  }
}

const MOIS_LIBELLES = [
  '',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;
