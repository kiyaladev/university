/** Promotions : cohortes d’étudiants. */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CrudService } from '../../../common/crud.service';
import { exigerAnneeOuverte } from '../../../common/annee';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { CreatePromotionDto, UpdatePromotionDto } from './promotions.dto';

@Injectable()
export class PromotionsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'promotion', {
      searchFields: ['nom'],
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
      include: { filiere: { include: { departement: true } }, annee: true },
      label: 'Promotion',
    });
  }

  async creer(dto: CreatePromotionDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        await exigerAnneeOuverte(tx, dto.anneeId);
        const promotion = await tx.promotion.create({
          data: dto,
          include: { filiere: { include: { departement: true } }, annee: true },
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
        const actuelle: any = await tx.promotion.findUnique({
          where: { id },
          include: { filiere: { include: { departement: true } }, annee: true },
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
          include: { filiere: { include: { departement: true } }, annee: true },
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
        const actuelle: any = await tx.promotion.findUnique({
          where: { id },
          include: { filiere: { include: { departement: true } }, annee: true },
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

  private instantaneAudit(promotion: any) {
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
