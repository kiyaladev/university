/**
 * Tarifs d'inscription (table Frais) : un tarif par promotion et par année.
 * Changer un tarif recopie le nouveau montant sur les dossiers en attente.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutInscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { CrudService } from '../../common/crud.service';
import { t } from '../../common/i18n';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from '../../common/annee';
import { CreateFraisDto, FraisQueryDto, UpdateFraisDto } from './inscription.dto';

export const FRAIS_INCLUDE = {
  annee: { select: { id: true, libelle: true } },
  promotion: { include: { filiere: true } },
} satisfies Prisma.FraisInclude;

/** Tarifs : changer un tarif recopie le nouveau montant sur les dossiers en attente. */
@Injectable()
export class FraisService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'frais', {
      include: FRAIS_INCLUDE,
      label: "Tarif d'inscription",
    });
  }

  /** Tarif public : renvoie uniquement ce qu’exigent les formulaires d’inscription. */
  async tarifsPublics(query: FraisQueryDto, filtres: Prisma.FraisWhereInput = {}) {
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));
    const where: Prisma.FraisWhereInput = {
      AND: [{ annee: { cloturee: false } }, filtres],
    };
    const [data, total] = await Promise.all([
      this.prisma.frais.findMany({
        where,
        select: { id: true, montant: true, devise: true },
        orderBy: [{ anneeId: 'desc' }, { promotionId: 'asc' }],
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.frais.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  private instantane(frais: { id: string; anneeId: string; promotionId: string; montant: number; devise: string }) {
    return {
      id: frais.id,
      anneeId: frais.anneeId,
      promotionId: frais.promotionId,
      montant: frais.montant,
      devise: frais.devise,
    };
  }

  /** Les dossiers EN_ATTENTE_PAIEMENT suivent le tarif officiel (instantané). */
  private async propager(tx: Prisma.TransactionClient, promotionId: string, anneeId: string, montant: number) {
    await tx.inscription.updateMany({
      where: { promotionId, anneeId, statut: StatutInscription.EN_ATTENTE_PAIEMENT },
      data: { montantFrais: montant },
    });
  }

  async creerFrais(dto: CreateFraisDto, user: AuthUser) {
    await exigerAnneeOuverte(this.prisma, dto.anneeId);
    const existant = await this.prisma.frais.findUnique({
      where: { anneeId_promotionId: { anneeId: dto.anneeId, promotionId: dto.promotionId } },
      select: { id: true },
    });
    if (existant) {
      throw new ConflictException(t('inscription.un_tarif_existe_deja_pour_cette_promotion_et_cette_annee_mod'));
    }
    const frais = await this.prisma.$transaction(
      async (tx) => {
        await exigerAnneeOuverte(tx, dto.anneeId);
        await exigerPromotionMemeAnnee(tx, dto.promotionId, dto.anneeId);
        const f = await tx.frais.create({
          data: {
            anneeId: dto.anneeId,
            promotionId: dto.promotionId,
            montant: dto.montant,
            devise: dto.devise ?? 'GNF',
          },
          include: FRAIS_INCLUDE,
        });
        await this.propager(tx, f.promotionId, f.anneeId, f.montant);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'FRAIS_CREE',
            entite: 'Frais',
            entiteId: f.id,
            details: JSON.stringify({ avant: null, apres: this.instantane(f) }),
          },
        });
        return f;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return frais;
  }

  async modifierFrais(id: string, dto: UpdateFraisDto, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant: any = await tx.frais.findUnique({ where: { id }, include: FRAIS_INCLUDE });
        if (!avant) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, avant.anneeId);
        if (dto.anneeId !== undefined) await exigerAnneeOuverte(tx, dto.anneeId);
        await exigerPromotionMemeAnnee(tx, dto.promotionId ?? avant.promotionId, dto.anneeId ?? avant.anneeId);
        const f = await tx.frais.update({
          where: { id },
          data: { ...dto },
          include: FRAIS_INCLUDE,
        });
        if (dto.montant !== undefined) {
          await this.propager(tx, f.promotionId, f.anneeId, f.montant);
        }
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'FRAIS_MODIFIE',
            entite: 'Frais',
            entiteId: id,
            details: JSON.stringify({ avant: this.instantane(avant), apres: this.instantane(f) }),
          },
        });
        return f;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async supprimerFrais(id: string, user: AuthUser) {
    await this.prisma.$transaction(
      async (tx) => {
        const actuel: any = await tx.frais.findUnique({ where: { id }, include: FRAIS_INCLUDE });
        if (!actuel) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, actuel.anneeId);
        await tx.frais.delete({ where: { id } });
        await this.propager(tx, actuel.promotionId, actuel.anneeId, 0);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'FRAIS_SUPPRIME',
            entite: 'Frais',
            entiteId: id,
            details: JSON.stringify({ avant: this.instantane(actuel), apres: null }),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { id };
  }
}
