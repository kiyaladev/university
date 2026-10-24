/**
 * Transmission d'un paiement Mobile Money à la passerelle opérateur, commune
 * aux inscriptions et aux demandes de documents.
 *
 * L'appel réseau se fait hors de toute transaction : le paiement est déjà
 * enregistré EN_ATTENTE, et un échec de la passerelle le laisse simplement en
 * attente d'une confirmation au guichet. Chaque étape est journalisée (sans
 * téléphone, motif, ni référence opérateur) lorsqu'une passerelle est
 * configurée ; la référence opérateur est rattachée au paiement dans une
 * transaction qui porte aussi son entrée de journal.
 */
import type { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MobileMoneyService } from '../../modules/scolarite/inscription/mobile-money.service';
import { toMontant } from './montant';

/** Champs du paiement nécessaires à la demande opérateur. */
export interface PaiementATransmettre {
  id: string;
  reference: string;
  /** Montant stocké (`numeric(14,2)`) : converti en nombre à l'envoi. */
  montant: Prisma.Decimal | number;
  devise: string;
  operateur: string | null;
  telephone: string | null;
  motif: string | null;
}

export interface OptionsTransmissionMobileMoney<P = Prisma.PaiementGetPayload<Prisma.PaiementDefaultArgs>> {
  prisma: Pick<PrismaService, '$transaction' | 'auditLog'>;
  mobileMoney: Pick<MobileMoneyService, 'demanderPaiement'>;
  /** Acteur inscrit au journal. */
  userId: string;
  /** Logger de l'appelant : les messages gardent leur contexte d'origine. */
  logger: Pick<Logger, 'warn' | 'error'>;
  /** Instantané d'audit avant/après du rattachement de la référence. */
  instantane: (paiement: P) => unknown;
  /** Relations rechargées avec le paiement rattaché (aucune par défaut). */
  include?: Prisma.PaiementInclude;
  /**
   * Sans passerelle configurée, appeler tout de même MobileMoneyService, qui
   * trace alors la simulation pilote en console. Faux par défaut : rien n'est
   * appelé sans `MOBILE_MONEY_URL`.
   */
  appelerSansPasserelle?: boolean;
}

/** Une passerelle est configurée (même normalisation que MobileMoneyService). */
export function passerelleMobileMoneyActive(): boolean {
  return !!process.env.MOBILE_MONEY_URL?.replace(/\/+$/, '');
}

/** Entrée de journal hors transaction ; son échec ne bloque jamais le paiement. */
export async function journaliserMobileMoney(
  prisma: Pick<PrismaService, 'auditLog'>,
  logger: Pick<Logger, 'warn'>,
  userId: string,
  paiementId: string,
  action: string,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entite: 'Paiement',
        entiteId: paiementId,
        details: JSON.stringify({ statut: 'EN_ATTENTE' }),
      },
    });
  } catch {
    logger.warn(`Journal Mobile Money indisponible pour le paiement ${paiementId}.`);
  }
}

/**
 * Envoie la demande à la passerelle, journalise la tentative et son issue,
 * puis rattache le `transactionId` renvoyé par l'opérateur.
 *
 * Renvoie le paiement rattaché (avec `include`), ou `null` si rien n'a été
 * rattaché : pas de téléphone, pas de passerelle, refus, réponse sans
 * référence ou échec de la liaison locale. Ne lève jamais.
 */
export async function transmettreMobileMoney<T = unknown>(
  paiement: PaiementATransmettre,
  options: OptionsTransmissionMobileMoney,
): Promise<T | null> {
  const { prisma, mobileMoney, userId, logger, include } = options;
  if (!paiement.telephone) return null;
  const passerelleActive = passerelleMobileMoneyActive();
  if (!passerelleActive && !options.appelerSansPasserelle) return null;

  const journal = (action: string) => journaliserMobileMoney(prisma, logger, userId, paiement.id, action);

  if (passerelleActive) await journal('PAIEMENT_MOBILE_MONEY_TENTATIVE');
  let demande: Awaited<ReturnType<MobileMoneyService['demanderPaiement']>>;
  try {
    demande = await mobileMoney.demanderPaiement({
      reference: paiement.reference,
      montant: toMontant(paiement.montant),
      devise: paiement.devise,
      operateur: paiement.operateur ?? 'AUTRE',
      telephone: paiement.telephone,
      motif: paiement.motif ?? undefined,
    });
  } catch {
    if (passerelleActive) await journal('PAIEMENT_MOBILE_MONEY_ECHEC');
    logger.warn(`Demande Mobile Money ${paiement.reference} non transmise; le paiement reste en attente.`);
    return null;
  }

  const transactionId = demande?.transactionId;
  if (!transactionId) {
    // En simulation pilote, l'absence de référence est attendue.
    if (passerelleActive && demande?.mode === 'operateur') {
      await journal('PAIEMENT_MOBILE_MONEY_REPONSE_INVALIDE');
    }
    return null;
  }

  const avecInclude: { include?: Prisma.PaiementInclude } = include ? { include } : {};
  try {
    return await prisma.$transaction(async (tx) => {
      const avant = await tx.paiement.findUnique({ where: { id: paiement.id }, ...avecInclude });
      if (!avant) return null;
      const apres = await tx.paiement.update({
        where: { id: paiement.id },
        data: { transactionId },
        ...avecInclude,
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'PAIEMENT_TRANSACTION_LIEE',
          entite: 'Paiement',
          entiteId: paiement.id,
          details: JSON.stringify({
            avant: options.instantane(avant),
            apres: options.instantane(apres),
            champsModifies: ['transactionId'],
          }),
        },
      });
      return apres as T;
    });
  } catch {
    if (passerelleActive) await journal('PAIEMENT_TRANSACTION_LIAISON_ECHEC');
    logger.error(`Mobile Money accepté pour ${paiement.reference}, mais sa référence n'a pas pu être liée localement.`);
    return null;
  }
}
