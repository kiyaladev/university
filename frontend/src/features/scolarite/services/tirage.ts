/** Tirages : liste, création, progression du workflow et impression. */

import { creer, lire, lister, type ParametresListe } from '@/shared/services/http';
import type { Tirage } from '@/types';

export const tirageService = {
  /** Liste paginée des tirages. */
  liste(params: ParametresListe = {}) {
    return lister<Tirage>('/tirage', params);
  },

  /** Crée un tirage pour un examen. */
  creer(payload: unknown) {
    return creer<Tirage>('/tirage', payload);
  },

  /** Fiche d'un tirage. */
  lire(id: string) {
    return lire<Tirage>(`/tirage/${id}`);
  },

  /** Avance le tirage d'un cran (route du workflow, avec son stade). */
  avancer(id: string, routeSuivant: string, stade?: string) {
    return creer<Tirage>(`/tirage/${id}/${routeSuivant}`, { stade });
  },

  /** Annule le tirage. */
  annuler(id: string) {
    return creer<Tirage>(`/tirage/${id}/annuler`);
  },

  /** Marque le tirage comme imprimé (empreinte de l'opérateur). */
  imprimer(id: string, empreinteSource: string) {
    return creer<Tirage>(`/tirage/${id}/imprimer`, { empreinteSource });
  },
};
