/** Promotions : cohortes d’étudiants. */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Promotion } from '@prisma/client';
import { CrudService } from '../../../common/crud.service';
import { exigerAnneeOuverte } from '../../../common/annee';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreatePromotionDto, UpdatePromotionDto } from './promotions.dto';

/** Relations chargées avec une promotion : sa filière (et son département) et son année. */
const PROMOTION_INCLUDE = { filiere: { include: { departement: true } }, annee: true } as const;

/** Colonnes conservées par l'instantané d'audit d'une promotion. */
type InstantanePromotion = Pick<Promotion, 'id' | 'nom' | 'niveau' | 'effectif' | 'filiereId' | 'anneeId'>;

/** Charge utile d'une promotion lue avec ses relations (voir PROMOTION_INCLUDE). */
type PromotionAvecRelations = Prisma.PromotionGetPayload<{ include: typeof PROMOTION_INCLUDE }>;

@Injectable()
export class PromotionsService extends CrudService<PromotionAvecRelations> {
  constructor(prisma: PrismaService) {
    super(prisma, 'promotion', {
      searchFields: ['nom'],
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
      include: PROMOTION_INCLUDE,
      label: 'Promotion',
    });
  }

  async creer(dto: CreatePromotionDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        await exigerAnneeOuverte(tx, dto.anneeId);
        const promotion = await tx.promotion.create({
          data: dto,
          include: PROMOTION_INCLUDE,
        });
        await journaliser(tx, user ?? null, 'PROMOTION_CREEE', 'Promotion', promotion.id, {
          avant: null,
          apres: this.instantaneAudit(promotion),
        });
        return promotion;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async modifier(id: string, dto: UpdatePromotionDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const actuelle = await tx.promotion.findUnique({
          where: { id },
          include: PROMOTION_INCLUDE,
        });
        if (!actuelle) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, actuelle.anneeId);
        if (dto.anneeId !== undefined) await exigerAnneeOuverte(tx, dto.anneeId);
        if (dto.anneeId !== undefined || dto.filiereId !== undefined) {
          const dependances = await tx.promotion.findUnique({
            where: { id },
            select: {
              _count: {
                select: {
                  affectations: true,
                  inscriptions: true,
                  frais: true,
                  evaluations: true,
                  deliberations: true,
                  attestations: true,
                  examens: true,
                  elections: true,
                },
              },
            },
          });
          if (Object.values(dependances?._count ?? {}).some((count) => count > 0)) {
            throw new ConflictException(t('referentiel.promotion_referenced_delete'));
          }
        }
        const apres = await tx.promotion.update({
          where: { id },
          data: dto,
          include: PROMOTION_INCLUDE,
        });
        await journaliser(tx, user ?? null, 'PROMOTION_MODIFIEE', 'Promotion', id, {
          avant: this.instantaneAudit(actuelle),
          apres: this.instantaneAudit(apres),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Une promotion qui porte encore inscriptions, affectations ou frais se garde. */
  async supprimer(id: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const actuelle = await tx.promotion.findUnique({
          where: { id },
          include: PROMOTION_INCLUDE,
        });
        if (!actuelle) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, actuelle.anneeId);
        const dependances = await tx.promotion.findUnique({
          where: { id },
          select: {
            _count: {
              select: {
                affectations: true,
                inscriptions: true,
                frais: true,
                evaluations: true,
                deliberations: true,
                attestations: true,
                examens: true,
                elections: true,
              },
            },
          },
        });
        if (Object.values(dependances?._count ?? {}).some((count) => count > 0)) {
          throw new ConflictException(t('referentiel.promotion_referenced_delete'));
        }
        await tx.promotion.delete({ where: { id } });
        await journaliser(tx, user ?? null, 'PROMOTION_SUPPRIMEE', 'Promotion', id, {
          avant: this.instantaneAudit(actuelle),
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private instantaneAudit(promotion: InstantanePromotion) {
    return {
      id: promotion.id,
      nom: promotion.nom,
      niveau: promotion.niveau,
      effectif: promotion.effectif,
      filiereId: promotion.filiereId,
      anneeId: promotion.anneeId,
    };
  }
}
