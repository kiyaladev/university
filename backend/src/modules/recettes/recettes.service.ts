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
import { I18nContext } from 'nestjs-i18n';
import { ModePaiement, Prisma, StatutPaiement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { toDateOnly } from '../../common/utils';
import { prochainNumeroTx } from '../../common/numero';
import {
  CreateRecetteDto,
  EncaisserRecetteDto,
  RecetteQueryDto,
  UpdateRecetteDto,
} from './recettes.dto';

/** Préfixe des références de paiement des recettes externes ("PAY-X-2026-00001"). */
export const PREFIXE_PAIEMENT_RECETTE = 'PAY-X-';

const RECETTE_INCLUDE = {
  paiement: { select: { id: true, reference: true, montant: true, devise: true, statut: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.RecetteExterneInclude;

@Injectable()
export class RecettesService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------- lecture

  async liste(query: RecetteQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));

    const where: Prisma.RecetteExterneWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.client ? { client: { contains: query.client, mode: 'insensitive' } } : {}),
      ...(query.search?.trim() ? {
        OR: [
          { numero: { contains: query.search.trim(), mode: 'insensitive' } },
          { libelle: { contains: query.search.trim(), mode: 'insensitive' } },
          { client: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      } : {}),
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
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.recetteExterne.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouver(id: string) {
    const recette = await this.prisma.recetteExterne.findUnique({
      where: { id },
      include: RECETTE_INCLUDE,
    });
    if (!recette) throw new NotFoundException(I18nContext.current()!.t('recettes.recette_introuvable'));
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
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'RECETTE_CREEE',
          entite: 'RecetteExterne',
          entiteId: recette.id,
          details: JSON.stringify({ avant: null, apres: this.instantaneAudit(recette) }),
        },
      });
      return recette;
    });
  }

  async modifier(id: string, dto: UpdateRecetteDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const actuel = await tx.recetteExterne.findUnique({ where: { id }, include: RECETTE_INCLUDE });
      if (!actuel) throw new NotFoundException(I18nContext.current()!.t('recettes.recette_introuvable'));
      const dateCible = dto.date !== undefined ? toDateOnly(dto.date) : actuel.date;
      const modifieMontantComptable = (
        (dto.montant !== undefined && dto.montant !== actuel.montant) ||
        (dto.devise !== undefined && dto.devise !== actuel.devise) ||
        (dto.type !== undefined && dto.type !== actuel.type) ||
        dateCible.getTime() !== actuel.date.getTime()
      );
      if (actuel.paiementId && modifieMontantComptable) {
        throw new ConflictException(I18nContext.current()!.t('recettes.modification_comptable_apres_encaissement_interdite'));
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
          throw new ConflictException(I18nContext.current()!.t('recettes.modification_comptable_apres_encaissement_interdite'));
        }
        where.paiementId = null;
        // La lecture et le changement de montant sont liés par comparaison de
        // la version observée : un encaissement ou un autre éditeur ne peut
        // valider une somme différente de celle qu'il a lue.
      }
      const modifiee = await tx.recetteExterne.updateMany({ where, data });
      if (modifiee.count !== 1) {
        const courante = await tx.recetteExterne.findUnique({ where: { id }, select: { paiementId: true } });
        if (!courante) throw new NotFoundException(I18nContext.current()!.t('recettes.recette_introuvable'));
        if (courante.paiementId && modifieMontantComptable) {
          throw new ConflictException(I18nContext.current()!.t('recettes.modification_comptable_apres_encaissement_interdite'));
        }
        throw new ConflictException(I18nContext.current()!.t('recettes.modification_concurrente'));
      }
      const maj = await tx.recetteExterne.findUniqueOrThrow({ where: { id }, include: RECETTE_INCLUDE });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'RECETTE_MODIFIEE',
          entite: 'RecetteExterne',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(actuel),
            apres: this.instantaneAudit(maj),
            champsModifies: Object.keys(data),
          }),
        },
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
    const modeEnum: ModePaiement =
      (dto.mode as ModePaiement | undefined) ?? ModePaiement.ESPECES;

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const recette = await tx.recetteExterne.findUnique({ where: { id }, include: RECETTE_INCLUDE });
          if (!recette) throw new NotFoundException(I18nContext.current()!.t('recettes.recette_introuvable'));
          if (recette.paiementId) {
            throw new ConflictException(I18nContext.current()!.t('recettes.cette_recette_a_deja_ete_encaissee_paiement_deja_rattache'));
          }
          const avant = this.instantaneAudit(recette);
          const annee = String(recette.date.getUTCFullYear());
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
            if (!courante) throw new NotFoundException(I18nContext.current()!.t('recettes.recette_introuvable'));
            if (courante.paiementId) {
              throw new ConflictException(I18nContext.current()!.t('recettes.cette_recette_a_deja_ete_encaissee_paiement_deja_rattache'));
            }
            throw new ConflictException(I18nContext.current()!.t('recettes.modification_concurrente'));
          }
          const miseAJour = await tx.recetteExterne.findUniqueOrThrow({
            where: { id },
            include: RECETTE_INCLUDE,
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: 'RECETTE_ENCAISSEE',
              entite: 'RecetteExterne',
              entiteId: id,
              details: JSON.stringify({ avant, apres: this.instantaneAudit(miseAJour), paiementReference: cree.reference }),
            },
          });
          return miseAJour;
        });
      } catch (erreur: any) {
        const cible = erreur?.meta?.target;
        const cibleTexte = Array.isArray(cible) ? cible.join(',') : String(cible ?? '');
        if (erreur?.code === 'P2002' && cibleTexte.toLowerCase().includes('reference')) continue;
        throw erreur;
      }
    }
    throw new ConflictException(I18nContext.current()!.t('recettes.reference_paiement_temporairement_indisponible'));
  }

  private instantaneAudit(recette: any) {
    return {
      id: recette.id,
      numero: recette.numero,
      type: recette.type,
      libelle: recette.libelle,
      montant: recette.montant,
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
      moisCourants[m].total += r.montant ?? 0;
    }

    return {
      annee,
      totalMois: moisCourants[mois].total,
      totalAnnee: moisCourants.reduce((total, ligne) => total + ligne.total, 0),
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

  /**
   * "PAY-X-2026-00001" — préfixe propre aux recettes externes, distinct du
   * resto ("PAY-R-") et des inscriptions ("PAY-"). Les encaissements
   * antérieurs gardent leur référence "PAY-R-…" : elle reste valide, seule la
   * séquence des nouveaux encaissements repart sous "PAY-X-".
   */
  private async prochainNumeroPaiement(
    tx: Prisma.TransactionClient,
    annee: string,
  ): Promise<string> {
    return prochainNumeroTx(tx, 'paiement', 'reference', `${PREFIXE_PAIEMENT_RECETTE}${annee}-`, 5);
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
