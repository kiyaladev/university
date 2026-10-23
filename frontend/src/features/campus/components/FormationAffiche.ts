import { dateLisible } from '@/shared/utils/format';
import type { Formation } from '@/types';

/**
 * Aides d'affichage des formations, partagées par la vue tableau et la vue
 * cartes.
 */

/** Période d'une formation : « 12/08/2026 → 20/08/2026 », ou la seule date de début. */
export function datesLisible(f: Formation): string {
  if (!f.dateDebut) return '';
  if (!f.dateFin) return dateLisible(f.dateDebut);
  return `${dateLisible(f.dateDebut)} → ${dateLisible(f.dateFin)}`;
}
