/**
 * Module Recettes — régie des recettes externes (ateliers, formations,
 * location d'amphithéâtre, prestations de conseil, etc.).
 *
 * Une recette est émise par la scolarité ou un service ; elle est
 * « encaissée » en créant un Paiement REUSSI rattaché (par `paiementId`) qui
 * passe automatiquement la recette à l'état « payée » : c'est ce que
 * consulte le registre. Le dashboard agrège les recettes émises, encaissées
 * ou non, en GNF par type et par mois de leur date d’émission.
 *
 * Le numéro de recette est fourni à la création et soumis à sa contrainte
 * d’unicité. Les références de paiement sont générées par le service, sous
 * le préfixe "PAY-X-AAAA-NNNNN" (année civile de la date de la recette).
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { ModePaiement, Prisma, RecetteExterne, StatutPaiement } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { Paginated } from '../../../common/dto';
import { pagine, paginer } from '../../../common/pagination';
import { toDateOnly } from '../../../common/utils';
import { SERIES_NUMERO, avecNumeroUnique, prochainNumeroSerie } from '../../../common/numero';
import { creerPaiementTx } from '../../../common/finances/index';
import { toMontant } from '../../../common/finances/montant';
import { CreateRecetteDto, EncaisserRecetteDto, RecetteQueryDto, UpdateRecetteDto } from './recettes.dto';

/** Préfixe des références de paiement des recettes externes ("PAY-X-2026-00001"). */
export const PREFIXE_PAIEMENT_RECETTE = SERIES_NUMERO.PAIEMENT_RECETTE.prefixe;

const RECETTE_INCLUDE = {
  paiement: { select: { id: true, reference: true, montant: true, devise: true, statut: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.RecetteExterneInclude;

@Injectable()
export class RecettesService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------- lecture

  async lister(query: RecetteQueryDto): Promise<Paginated<Prisma.RecetteExterneGetPayload<{ include: typeof RECETTE_INCLUDE }>>> {
    const pagination = paginer(query);

    const where: Prisma.RecetteExterneWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.client ? { client: { contains: query.client, mode: 'insensitive' } } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { numero: { contains: query.search.trim(), mode: 'insensitive' } },
              { libelle: { contains: query.search.trim(), mode: 'insensitive' } },
              { client: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (query.dateDebut || query.dateFin) {
      where.date = {};
      if (query.dateDebut) where.date.gte = toDateOnly(query.dateDebut);
      if (query.dateFin) where.date.lte = toDateOnly(query.dateFin);
    }

    if (query.paiementStatut === 'A_ENCAISSER') {
      where.paiementId = null;
    } else if (query.paiementStatut) {
      where.paiement = { statut: query.paiementStatut };
    }

    const [data, total] = await Promise.all([
      this.prisma.recetteExterne.findMany({
        where,
        include: RECETTE_INCLUDE,
        orderBy: [{ date: 'desc' }, { numero: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.recetteExterne.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  async trouver(id: string) {
    const recette = await this.prisma.recetteExterne.findUnique({
      where: { id },
      include: RECETTE_INCLUDE,
    });
    if (!recette) throw new NotFoundException(t('recettes.recette_introuvable'));
    return recette;
  }

  // ---------------------------------------------------- création

  async creer(dto: CreateRecetteDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const recette = await tx.recetteExterne.create({
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
      await journaliser(tx, user, 'RECETTE_CREEE', 'RecetteExterne', recette.id, {
        avant: null,
        apres: this.instantaneAudit(recette),
      });
      return recette;
    });
  }

  async modifier(id: string, dto: UpdateRecetteDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const actuel = await tx.recetteExterne.findUnique({ where: { id }, include: RECETTE_INCLUDE });
      if (!actuel) throw new NotFoundException(t('recettes.recette_introuvable'));
      const dateCible = dto.date !== undefined ? toDateOnly(dto.date) : actuel.date;
      const modifieMontantComptable =
        (dto.montant !== undefined && dto.montant !== toMontant(actuel.montant)) ||
        (dto.devise !== undefined && dto.devise !== actuel.devise) ||
        (dto.type !== undefined && dto.type !== actuel.type) ||
        dateCible.getTime() !== actuel.date.getTime();
      if (actuel.paiementId && modifieMontantComptable) {
        throw new ConflictException(t('recettes.modification_comptable_apres_encaissement_interdite'));
      }
      const data: Prisma.RecetteExterneUpdateManyMutationInput = {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.libelle !== undefined ? { libelle: dto.libelle } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.montant !== undefined ? { montant: dto.montant } : {}),
        ...(dto.devise !== undefined ? { devise: dto.devise } : {}),
        ...(dto.date !== undefined ? { date: dateCible } : {}),
        ...(dto.client !== undefined ? { client: dto.client } : {}),
        ...(dto.factureNum !== undefined ? { factureNum: dto.factureNum } : {}),
      };
      const where: Prisma.RecetteExterneWhereInput = { id, paiementId: actuel.paiementId };
      if (dto.type !== undefined) where.type = actuel.type;
      if (dto.libelle !== undefined) where.libelle = actuel.libelle;
      if (dto.description !== undefined) where.description = actuel.description;
      if (dto.montant !== undefined) where.montant = actuel.montant;
      if (dto.devise !== undefined) where.devise = actuel.devise;
      if (dto.date !== undefined) where.date = actuel.date;
      if (dto.client !== undefined) where.client = actuel.client;
      if (dto.factureNum !== undefined) where.factureNum = actuel.factureNum;
      if (modifieMontantComptable) {
        if (actuel.paiementId) {
          throw new ConflictException(t('recettes.modification_comptable_apres_encaissement_interdite'));
        }
        where.paiementId = null;
        // La lecture et le changement de montant sont liés par comparaison de
        // la version observée : un encaissement ou un autre éditeur ne peut
        // valider une somme différente de celle qu'il a lue.
      }
      const modifiee = await tx.recetteExterne.updateMany({ where, data });
      if (modifiee.count !== 1) {
        const courante = await tx.recetteExterne.findUnique({ where: { id }, select: { paiementId: true } });
        if (!courante) throw new NotFoundException(t('recettes.recette_introuvable'));
        if (courante.paiementId && modifieMontantComptable) {
          throw new ConflictException(t('recettes.modification_comptable_apres_encaissement_interdite'));
        }
        throw new ConflictException(t('recettes.modification_concurrente'));
      }
      const maj = await tx.recetteExterne.findUniqueOrThrow({ where: { id }, include: RECETTE_INCLUDE });
      await journaliser(tx, user, 'RECETTE_MODIFIEE', 'RecetteExterne', id, {
        avant: this.instantaneAudit(actuel),
        apres: this.instantaneAudit(maj),
        champsModifies: Object.keys(data),
      });
      return maj;
    });
  }

  // ---------------------------------------------------- encaissement

  /**
   * Encaissement : crée un Paiement REUSSI (montant, devise = recette) puis
   * rattache `recette.paiementId` à ce paiement. La relation est 1-1.
   * Une recette déjà encaissée ne peut plus l'être à nouveau — refusée.
   */
  async encaisser(id: string, dto: EncaisserRecetteDto, user: AuthUser) {
    const modeEnum: ModePaiement = (dto.mode as ModePaiement | undefined) ?? ModePaiement.ESPECES;

    return avecNumeroUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const recette = await tx.recetteExterne.findUnique({ where: { id }, include: RECETTE_INCLUDE });
          if (!recette) throw new NotFoundException(t('recettes.recette_introuvable'));
          if (recette.paiementId) {
            throw new ConflictException(t('recettes.cette_recette_a_deja_ete_encaissee_paiement_deja_rattache'));
          }
          const avant = this.instantaneAudit(recette);
          const annee = String(recette.date.getUTCFullYear());
          const cree = await creerPaiementTx(tx, {
            data: {
              // "PAY-X-2026-00001" — préfixe propre aux recettes externes, distinct du
              // resto ("PAY-R-") et des inscriptions ("PAY-"). Les encaissements
              // antérieurs gardent leur référence "PAY-R-…" : elle reste valide, seule la
              // séquence des nouveaux encaissements repart sous "PAY-X-".
              reference: await prochainNumeroSerie(tx, SERIES_NUMERO.PAIEMENT_RECETTE, annee),
              montant: recette.montant,
              devise: recette.devise,
              mode: modeEnum,
              operateur: dto.operateur ?? null,
              telephone: dto.telephone ?? null,
              nomComplet: dto.nomComplet ?? recette.client ?? null,
              motif: `Recette externe ${recette.numero} — ${recette.libelle}`,
              statut: StatutPaiement.REUSSI,
              completeLe: new Date(),
              creeParId: user.id,
            },
            select: { id: true, reference: true },
          });

          const liee = await tx.recetteExterne.updateMany({
            where: {
              id,
              paiementId: null,
              montant: recette.montant,
              devise: recette.devise,
              date: recette.date,
              type: recette.type,
              libelle: recette.libelle,
            },
            data: { paiementId: cree.id },
          });
          if (liee.count !== 1) {
            const courante = await tx.recetteExterne.findUnique({ where: { id }, select: { paiementId: true } });
            if (!courante) throw new NotFoundException(t('recettes.recette_introuvable'));
            if (courante.paiementId) {
              throw new ConflictException(t('recettes.cette_recette_a_deja_ete_encaissee_paiement_deja_rattache'));
            }
            throw new ConflictException(t('recettes.modification_concurrente'));
          }
          const miseAJour = await tx.recetteExterne.findUniqueOrThrow({
            where: { id },
            include: RECETTE_INCLUDE,
          });
          await journaliser(tx, user, 'RECETTE_ENCAISSEE', 'RecetteExterne', id, {
            avant,
            apres: this.instantaneAudit(miseAJour),
            paiementReference: cree.reference,
          });
          return miseAJour;
        }),
      {
        tentatives: 10,
        colonnes: ['reference'],
        erreur: () => new ConflictException(t('recettes.reference_paiement_temporairement_indisponible')),
      },
    );
  }

  private instantaneAudit(recette: RecetteExterne) {
    return {
      id: recette.id,
      numero: recette.numero,
      type: recette.type,
      libelle: recette.libelle,
      montant: toMontant(recette.montant),
      devise: recette.devise,
      date: recette.date,
      paiementId: recette.paiementId,
    };
  }

  // ----------------------------------------------------- dashboard

  /**
   * KPIs pour la direction :
   *   - par type et par mois de l'année courante ;
   *   - top 3 des types par montant cumulé sur la même période ;
   *   - totaux mois courant et année courante en GNF.
   */
  async dashboard() {
    const maintenant = new Date();
    const annee = maintenant.getUTCFullYear();
    const mois = maintenant.getUTCMonth();
    const debutAnnee = new Date(Date.UTC(annee, 0, 1));
    const finAnnee = new Date(Date.UTC(annee, 11, 31));

    const filtreAnnee = { date: { gte: debutAnnee, lte: finAnnee }, devise: 'GNF' };
    const [parType, parMois, top3] = await Promise.all([
      this.prisma.recetteExterne.groupBy({
        by: ['type'],
        _sum: { montant: true },
        _count: { _all: true },
        where: filtreAnnee,
      }),
      this.prisma.recetteExterne.findMany({
        where: filtreAnnee,
        select: { date: true, montant: true, devise: true },
      }),
      this.prisma.recetteExterne.groupBy({
        by: ['type'],
        _sum: { montant: true },
        orderBy: { _sum: { montant: 'desc' } },
        take: 3,
        where: filtreAnnee,
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
      moisCourants[m].total += toMontant(r.montant);
    }

    return {
      annee,
      totalMois: moisCourants[mois].total,
      totalAnnee: moisCourants.reduce((total, ligne) => total + ligne.total, 0),
      parType: parType.map((p) => ({
        type: p.type,
        total: toMontant(p._sum.montant),
        nb: p._count._all,
      })),
      parMois: moisCourants,
      top3: top3.map((t) => ({ type: t.type, total: toMontant(t._sum.montant) })),
    };
  }

  // ------------------------------------------------------- helpers
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
