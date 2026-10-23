import { lire, modifier } from '@/shared/services/http';

/**
 * Paramètres de l'établissement (`/parametres`).
 *
 * - `GET /parametres` : tous les paramètres, clés et valeurs.
 * - `PUT /parametres` : enregistrement de la liste complète.
 */

/** Un paramètre : sa clé, sa valeur (toujours en texte) et son aide. */
export interface Parametre {
  cle: string;
  valeur: string;
  description?: string | null;
}

export const parametresService = {
  /** Tous les paramètres. */
  liste: () => lire<Parametre[]>('/parametres'),

  /** Enregistrement de la liste complète des paramètres. */
  enregistrer: (parametres: Parametre[]) => modifier<Parametre[]>('/parametres', { parametres }),
};

/**
 * Copie de référence des valeurs chargées : elle sert à repérer les
 * modifications non enregistrées (une valeur qui diffère de la référence).
 */
export function referenceParametres(parametres: Parametre[]): Record<string, string> {
  return Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
}
