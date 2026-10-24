/** Soutenances : planification d'une soutenance et constat du jury. */

import { creer, lire, modifier } from '@/shared/services/http';
import { elements, type Collection } from '@/shared/utils/collections';
import type { Soutenance } from '@/types';

export const soutenancesService = {
  /** Calendrier des soutenances. */
  liste() {
    return lire<Collection<Soutenance>>('/soutenances').then(elements);
  },

  /** Planifie une soutenance. */
  creer(payload: unknown) {
    return creer<Soutenance>('/soutenances', payload);
  },

  /** Constat du jury : note et mention de la soutenance. */
  hota(id: string, payload: unknown) {
    return modifier<Soutenance>(`/soutenances/${id}/hota`, payload);
  },
};
