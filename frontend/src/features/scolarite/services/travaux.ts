/** Travaux encadrés (stages) : suivi, transitions de statut et rapport. */

import { creer, lire, modifier, supprimer, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from './collections';
import type { TravailEncadre } from '@/types';

/** Statuts d'un travail encadré, dans l'ordre du workflow. */
export type StatutEncadrement = TravailEncadre['statut'];

export const travauxService = {
  /** Liste des travaux encadrés (tous, ou filtrés). */
  liste(params: ParametresListe = {}) {
    return lire<Collection<TravailEncadre>>('/travaux-encadres', params).then(elements);
  },

  /** Fiche d'un travail encadré. */
  lire(id: string) {
    return lire<TravailEncadre>(`/travaux-encadres/${id}`);
  },

  /** Déclare un travail encadré. */
  creer(payload: unknown) {
    return creer<TravailEncadre>('/travaux-encadres', payload);
  },

  /** Modifie un travail encadré. */
  modifier(id: string, payload: unknown) {
    return modifier<TravailEncadre>(`/travaux-encadres/${id}`, payload);
  },

  /** Fait avancer le workflow du travail (`PROPOSE` → `VALIDE` → …). */
  transition(id: string, statut: StatutEncadrement) {
    return creer<TravailEncadre>(`/travaux-encadres/${id}/transition`, { statut });
  },

  /** Supprime un travail encadré. */
  supprimer(id: string) {
    return supprimer(`/travaux-encadres/${id}`);
  },
};
