/**
 * Frais de scolarité : barèmes publics utilisés par le formulaire d'inscription.
 *
 * Distinct de `features/finances/services/frais.ts` (gestion des tarifs par la
 * direction) : ici on lit le barème public d'une promotion.
 */

import { lire, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from './collections';
import type { Frais } from '@/types';

export const fraisScolariteService = {
  /** Barèmes d'une promotion (et, si connu, d'une année). */
  liste(params: ParametresListe = {}) {
    return lire<Collection<Frais>>('/frais', params).then(elements);
  },
};
