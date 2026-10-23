/** Inscriptions : dossiers d'inscription, validation et annulation. */

import { creer, lire, lister, modifier, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from '@/shared/utils/collections';
import type { Inscription } from '@/types';

export const inscriptionsService = {
  /** Liste paginée des dossiers d'inscription. */
  liste(params: ParametresListe = {}) {
    return lister<Inscription>('/inscriptions', params);
  },

  /** Liste complète (dossiers d'un étudiant, promotions…). */
  tous(params: ParametresListe = {}) {
    return lire<Collection<Inscription>>('/inscriptions', params).then(elements);
  },

  /** Ouvre un dossier d'inscription. */
  creer(payload: unknown) {
    return creer<Inscription>('/inscriptions', payload);
  },

  /** Valide un dossier d'inscription. */
  valider(id: string) {
    return modifier<Inscription>(`/inscriptions/${id}/valider`);
  },

  /** Annule un dossier d'inscription. */
  annuler(id: string) {
    return modifier<Inscription>(`/inscriptions/${id}/annuler`);
  },
};
