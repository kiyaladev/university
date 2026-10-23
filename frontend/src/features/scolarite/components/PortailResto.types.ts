/**
 * Formes brutes de l'API restauration lues par l'espace étudiant.
 *
 * Le service `portailService.resto()` renvoie le corps de `/portail/resto/me`
 * tel quel ; ces interfaces décrivent ce corps avant sa projection en lignes
 * d'affichage (`LigneResto`).
 */

/** Une recharge Mobile Money créditée au portefeuille. */
export interface RechargeRestoPortail {
  id: string;
  rechargeLe: string;
  statut: string;
  montant: number;
}

/** Une consommation de restaurant débité du portefeuille. */
export interface ConsommationRestoPortail {
  id: string;
  consommeLe: string;
  repas: string;
  cantine?: string | null;
  statut: string;
  montant: number;
}

/** Le portefeuille resto de l'étudiant, tel que renvoyé par l'API. */
export interface ReponseRestoPortail {
  solde: number;
  recharges?: RechargeRestoPortail[];
  consommations?: ConsommationRestoPortail[];
}
