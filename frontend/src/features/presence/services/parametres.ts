import { lire } from '@/shared/services/http';

/**
 * Règles de pointage (`/parametres`).
 *
 * Les paramètres sont des couples `{ cle, valeur }` : l'écran qui pose une
 * question au serveur n'a pas à connaître la forme de la réponse.
 */

/** Un paramètre de l'établissement. */
export interface Parametre {
  cle: string;
  valeur: string;
}

/** Règles lues avant un pointage. */
export const parametresService = {
  /** Règles de pointage (attestation obligatoire ou facultative…). */
  reglesPointage: () => lire<Parametre[]>('/parametres/pointage'),
};

/**
 * Valeur d'un paramètre, ou `defaut` si la clé est absente.
 *
 * Une règle lue par l'écran est une question fermée : « l'attestation est-elle
 * obligatoire ? ». La valeur par défaut est celle de l'établissement quand le
 * serveur ne répond pas.
 */
export function valeurParametre(parametres: Parametre[] | undefined, cle: string, defaut = ''): string {
  return parametres?.find((p) => p.cle === cle)?.valeur ?? defaut;
}
