/** Délibérations de jury : sessions, calcul et validation. */

import { creer, lire, lister, type ParametresListe } from '@/shared/services/http';
import type { Deliberation } from '@/types';

/** Actions de workflow d'une délibération. */
export type ActionDeliberation = 'calculer' | 'valider';

export const deliberationsService = {
  /** Liste des délibérations (toutes, ou paginées). */
  liste(params: ParametresListe = {}) {
    return lister<Deliberation>('/deliberations', params);
  },

  /** Fiche détaillée d'une délibération, avec ses lignes de jury. */
  lire(id: string) {
    return lire<Deliberation>(`/deliberations/${id}`);
  },

  /** Ouvre une session de délibération. */
  creer(payload: unknown) {
    return creer<Deliberation>('/deliberations', payload);
  },

  /** Action de workflow (`calculer`, `valider`). */
  action(id: string, action: ActionDeliberation) {
    return creer<Deliberation>(`/deliberations/${id}/${action}`);
  },
};
