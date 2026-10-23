/** Examens : planification, suivi, scans et cycle de vie. */

import { creer, lire, lister, modifier, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from './collections';
import type { Examen } from '@/types';

/** Un scan d'(examen) enregistré au poste de scan. */
export interface ScanExamen {
  id?: string;
  code?: string;
  matricule?: string;
  nom?: string;
  prenom?: string;
  present?: boolean;
  scannedAt?: string;
  createdAt?: string;
}

/** Statistiques de présence d'un examen. */
export interface StatsExamen {
  inscrits?: number;
  presents?: number;
  absents?: number;
  [cle: string]: unknown;
}

/** Charge utile de l'enregistrement d'un scan. */
export interface ScanExamenEntree {
  examenId: string;
  code?: string;
  matricule?: string;
  [cle: string]: unknown;
}

export const examensService = {
  /** Liste paginée des examens. */
  liste(params: ParametresListe = {}) {
    return lister<Examen>('/examens', params);
  },

  /** Examens d'un poste de scan (liste courte). */
  tous(params: ParametresListe = {}) {
    return lire<Collection<Examen>>('/examens', params).then(elements);
  },

  /** Fiche d'un examen. */
  lire(id: string) {
    return lire<Examen>(`/examens/${id}`);
  },

  /** Planifie un examen. */
  creer(payload: unknown) {
    return creer<Examen>('/examens', payload);
  },

  /** Journal des scans d'un examen. */
  scans(id: string) {
    return lire<Collection<ScanExamen>>(`/examens/${id}/scans`).then(elements);
  },

  /** Statistiques de présence d'un examen. */
  stats(id: string) {
    return lire<StatsExamen>(`/examens/${id}/stats`);
  },

  /** Change le statut d'un examen (`PLANIFIE`, `EN_COURS`, `TERMINE`, `ANNULE`…). */
  changerStatut(id: string, statut: string) {
    return modifier<Examen>(`/examens/${id}/statut`, { statut });
  },

  /** Action de cycle de vie (`demarrer`, `terminer`). */
  action(id: string, action: string) {
    return creer<Examen>(`/examens/${id}/${action}`);
  },

  /** Enregistre un scan de présence. */
  scanner(payload: ScanExamenEntree) {
    return creer<ScanExamen>('/examens/scan', payload);
  },
};
