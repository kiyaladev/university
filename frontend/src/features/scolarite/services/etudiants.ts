/** Registre étudiants : liste, fiche, création et mise à jour. */

import { creer, lire, lister, modifier, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from './collections';
import type { Etudiant } from '@/types';

export const etudiantsService = {
  /** Liste paginée du registre. */
  liste(params: ParametresListe = {}) {
    return lister<Etudiant>('/etudiants', params);
  },

  /** Liste complète (tableaux de choix, recherche d'un étudiant). */
  tous(params: ParametresListe = {}) {
    return lire<Collection<Etudiant>>('/etudiants', params).then(elements);
  },

  /** Fiche d'un étudiant. */
  lire(id: string) {
    return lire<Etudiant>(`/etudiants/${id}`);
  },

  /** Ouvre un dossier étudiant. */
  creer(payload: unknown) {
    return creer<Etudiant>('/etudiants', payload);
  },

  /** Met à jour la fiche d'un étudiant (dont son activation). */
  modifier(id: string, payload: unknown) {
    return modifier<Etudiant>(`/etudiants/${id}`, payload);
  },
};
