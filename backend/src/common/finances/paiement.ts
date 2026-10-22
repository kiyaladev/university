/**
 * Socle commun des paiements : la table Paiement est partagée par cinq
 * portefeuilles (inscriptions, formations, resto, recettes externes, demandes
 * de documents). Chacun garde sa numérotation et ses règles de confirmation ;
 * ce fichier ne rassemble que ce qui était recopié d'un module à l'autre.
 *
 * Choix : des fonctions, pas un module Nest. Rien ici n'a d'état propre ; les
 * dépendances (client Prisma ou transaction, MobileMoneyService, logger) sont
 * passées par l'appelant. Aucun provider nouveau n'est donc à déclarer dans
 * les modules, et les services gardent leurs constructeurs.
 */
import type { Prisma } from '@prisma/client';

/** Opérateurs Mobile Money acceptés (inscriptions, cantine). */
export const OPERATEURS_MOBILE_MONEY = ['ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE'] as const;

/** Portefeuille d'origine d'un paiement, déduit de ses relations. */
export type SourcePaiement = 'INSCRIPTION' | 'FORMATION' | 'RESTO' | 'RECETTE' | 'DOCUMENT';

/**
 * Relations à charger pour appeler `sourcePaiement`. À fusionner AVANT un
 * include plus riche (`{ ...PAIEMENT_SOURCE_INCLUDE, ...AUTRE_INCLUDE }`) pour
 * que la sélection la plus complète l'emporte.
 */
export const PAIEMENT_SOURCE_INCLUDE = {
  inscriptionFormation: { select: { id: true } },
  recharges: { select: { id: true }, take: 1 },
  rechargesRecette: { select: { id: true } },
  demandeDocument: { select: { id: true } },
} satisfies Prisma.PaiementInclude;

export interface RelationsSourcePaiement {
  inscriptionFormation?: unknown;
  recharges?: unknown[] | null;
  rechargesRecette?: unknown;
  demandeDocument?: unknown;
}

/**
 * Source d'un paiement. Un paiement sans lien vers un autre portefeuille
 * (scolarité ou paiement libre du guichet) relève de /paiements : INSCRIPTION.
 * L'ordre des tests est celui du garde-fou historique de la confirmation.
 */
export function sourcePaiement(paiement: RelationsSourcePaiement): SourcePaiement {
  if (paiement.inscriptionFormation) return 'FORMATION';
  if (paiement.recharges?.length) return 'RESTO';
  if (paiement.rechargesRecette) return 'RECETTE';
  if (paiement.demandeDocument) return 'DOCUMENT';
  return 'INSCRIPTION';
}

/** Journal de création, écrit dans la même transaction que le paiement. */
export interface JournalCreationPaiement<P> {
  userId: string | null;
  /** `PAIEMENT_CREE` par défaut. */
  action?: string;
  /** Instantané d'audit : jamais le téléphone, le motif ni le jeton opérateur. */
  instantane: (paiement: P) => unknown;
}

/**
 * Crée un paiement dans la transaction fournie (la référence est calculée par
 * l'appelant : chaque portefeuille garde sa numérotation) et, si demandé,
 * journalise sa création dans cette même transaction.
 */
export async function creerPaiementTx<A extends Prisma.PaiementCreateArgs>(
  tx: Pick<Prisma.TransactionClient, 'paiement' | 'auditLog'>,
  args: Prisma.SelectSubset<A, Prisma.PaiementCreateArgs>,
  journal?: JournalCreationPaiement<Prisma.PaiementGetPayload<A>>,
): Promise<Prisma.PaiementGetPayload<A>> {
  const cree = (await tx.paiement.create(args)) as Prisma.PaiementGetPayload<A>;
  if (journal) {
    await tx.auditLog.create({
      data: {
        userId: journal.userId,
        action: journal.action ?? 'PAIEMENT_CREE',
        entite: 'Paiement',
        entiteId: (cree as { id: string }).id,
        details: JSON.stringify({ avant: null, apres: journal.instantane(cree) }),
      },
    });
  }
  return cree;
}
