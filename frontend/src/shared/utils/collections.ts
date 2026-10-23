/**
 * Forme des collections renvoyées par l'API.
 *
 * Selon la route et les paramètres (`all=1`, pagination), le back renvoie
 * soit un tableau nu, soit l'enveloppe `{ data, total, page, pageSize }` —
 * dont la pagination n'est pas systématique. Les écrans consomment toujours
 * un tableau : la conversion vit ici.
 */

import type { Liste } from '@/types';

/** Forme acceptée pour une collection renvoyée par l'API. */
export type Collection<T> = T[] | Liste<T>;

/** Normalise une collection en tableau, quelle que soit sa forme. */
export function elements<T>(donnees: Collection<T> | null | undefined): T[] {
  if (Array.isArray(donnees)) return donnees;
  return donnees?.data ?? [];
}
