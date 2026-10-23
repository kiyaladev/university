/**
 * Calculs de finances d'un dossier : ce qui est encaissé et ce qui reste dû.
 *
 * Les écrans d'inscription et de paiement делаient chacun leur copie de ces
 * deux calculs : ils sont ici, une fois.
 */

import type { StatutPaiement } from '@/types';

/**
 * Ce qu'il faut d'un dossier d'inscription pour connaître l'état de ses
 * paiements : le montant des frais et les paiements qui les concernent.
 */
export interface DossierFacture {
  /** Montant des frais d'inscription du dossier. */
  montantFrais: number;
  /** Paiements rattachés au dossier, quand l'API les joint à la liste. */
  paiements?: { statut: StatutPaiement; montant: number }[] | null;
}

/**
 * Somme réellement encaissée sur le dossier : seuls les paiements réussis
 * comptent. Un paiement en attente ou annulé ne solde rien.
 */
export function montantPaye(dossier: DossierFacture): number {
  return (dossier.paiements ?? [])
    .filter((paiement) => paiement.statut === 'REUSSI')
    .reduce((total, paiement) => total + paiement.montant, 0);
}

/** Reste dû sur les frais d'inscription : jamais négatif. */
export function resteAPayer(dossier: DossierFacture): number {
  return Math.max(0, dossier.montantFrais - montantPaye(dossier));
}
