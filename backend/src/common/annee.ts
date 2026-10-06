import { BadRequestException } from '@nestjs/common';
import { t } from './i18n';

/** Signal distinctif pour les traitements par lot qui peuvent ignorer une année close. */
export class AnneeAcademiqueClotureeException extends BadRequestException {}

interface DepotAnnee {
  anneeAcademique: {
    findUnique(args: { where: { id: string }; select: { cloturee: true } }): Promise<{ cloturee: boolean } | null>;
  };
}

/** Empêche une nouvelle écriture rattachée à une année déjà clôturée. */
export async function exigerAnneeOuverte(db: DepotAnnee, anneeId?: string | null): Promise<void> {
  if (!anneeId) return;
  if (typeof (db as any).$queryRaw === 'function') {
    const lignes = await (db as any).$queryRaw`SELECT "cloturee" FROM "AnneeAcademique" WHERE "id" = ${anneeId} FOR SHARE`;
    const annee = lignes[0] as { cloturee: boolean } | undefined;
    if (!annee) throw new BadRequestException(t('common.academicYearNotFound'));
    if (annee.cloturee) throw new AnneeAcademiqueClotureeException(t('common.academicYearClosed'));
    return;
  }
  const annee = await db.anneeAcademique.findUnique({
    where: { id: anneeId },
    select: { cloturee: true },
  });
  if (!annee) {
    throw new BadRequestException(t('common.academicYearNotFound'));
  }
  if (annee?.cloturee) {
    throw new AnneeAcademiqueClotureeException(t('common.academicYearClosed'));
  }
}

/** Garde les entités académiques rattachées à une promotion dans la même année. */
export async function exigerPromotionMemeAnnee(
  db: { promotion: { findUnique(args: any): Promise<{ anneeId: string } | null> } },
  promotionId: string,
  anneeId: string,
): Promise<void> {
  const promotion = typeof (db as any).$queryRaw === 'function'
    ? ((await (db as any).$queryRaw`SELECT "anneeId" FROM "Promotion" WHERE "id" = ${promotionId} FOR SHARE`)[0] as { anneeId: string } | undefined)
    : await db.promotion.findUnique({ where: { id: promotionId }, select: { anneeId: true } });
  if (!promotion) throw new BadRequestException(t('common.academicPromotionNotFound'));
  if (promotion.anneeId !== anneeId) {
    throw new BadRequestException(t('common.academicPromotionMismatch'));
  }
}
