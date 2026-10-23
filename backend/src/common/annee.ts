import { BadRequestException } from '@nestjs/common';
import { t } from './i18n';

/** Signal distinctif pour les traitements par lot qui peuvent ignorer une année close. */
export class AnneeAcademiqueClotureeException extends BadRequestException {}

interface DepotAnnee {
  anneeAcademique: {
    findUnique(args: { where: { id: string }; select: { cloturee: true } }): Promise<{ cloturee: boolean } | null>;
  };
  /**
   * Présent sur le client Prisma et ses transactions, absent sur les doublures
   * de test : la vérification se fait alors par le delegate typé.
   */
  $queryRaw?: (requete: TemplateStringsArray, ...valeurs: unknown[]) => Promise<unknown>;
}

/** Empêche une nouvelle écriture rattachée à une année déjà clôturée. */
export async function exigerAnneeOuverte(db: DepotAnnee, anneeId?: string | null): Promise<void> {
  if (!anneeId) return;
  if (typeof db.$queryRaw === 'function') {
    const lignes =
      (await db.$queryRaw`SELECT "cloturee" FROM "AnneeAcademique" WHERE "id" = ${anneeId} FOR SHARE`) as Array<{
        cloturee: boolean;
      }>;
    const annee = lignes[0];
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
  db: {
    promotion: { findUnique(args: unknown): Promise<{ anneeId: string } | null> };
    $queryRaw?: (requete: TemplateStringsArray, ...valeurs: unknown[]) => Promise<unknown>;
  },
  promotionId: string,
  anneeId: string,
): Promise<void> {
  const promotion =
    typeof db.$queryRaw === 'function'
      ? (
          (await db.$queryRaw`SELECT "anneeId" FROM "Promotion" WHERE "id" = ${promotionId} FOR SHARE`) as Array<{
            anneeId: string;
          }>
        )[0]
      : await db.promotion.findUnique({ where: { id: promotionId }, select: { anneeId: true } });
  if (!promotion) throw new BadRequestException(t('common.academicPromotionNotFound'));
  if (promotion.anneeId !== anneeId) {
    throw new BadRequestException(t('common.academicPromotionMismatch'));
  }
}
