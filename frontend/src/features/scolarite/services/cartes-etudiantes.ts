/** Cartes étudiantes : émission, NIP, révocation. */

import { creer, lire, lister, modifier, type ParametresListe } from '@/shared/services/http';
import type { CarteEtudiante } from '@/types';

export const cartesEtudiantesService = {
  /** Registre paginé des cartes. */
  liste(params: ParametresListe = {}) {
    return lister<CarteEtudiante>('/cartes-etudiantes', params);
  },

  /** Émet une carte étudiante. */
  creer(payload: unknown) {
    return creer<CarteEtudiante>('/cartes-etudiantes', payload);
  },

  /** Modifie une carte étudiante (validité, photo…). */
  modifier(id: string, payload: unknown) {
    return modifier<CarteEtudiante>(`/cartes-etudiantes/${id}`, payload);
  },

  /** Carte de l'étudiant connecté. */
  maCarte() {
    return lire<CarteEtudiante>('/cartes-etudiantes/me');
  },

  /** Définit (ou change) le NIP de la carte. */
  definirNip(id: string, nip: string) {
    return creer<CarteEtudiante>(`/cartes-etudiantes/${id}/nip`, { nip });
  },

  /** Révoque une carte (motif obligatoire côté API). */
  revoquer(id: string, motif: string) {
    return creer<CarteEtudiante>(`/cartes-etudiantes/${id}/revoquer`, { motif });
  },
};
