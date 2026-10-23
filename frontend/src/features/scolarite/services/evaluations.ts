/** Évaluations : liste des épreuves, saisie des notes et clôture. */

import { creer, lire, lister, modifier, type ParametresListe } from '@/shared/services/http';
import type { Evaluation } from '@/types';

/** Inscrit d'une évaluation, tel que renvoyé par `/evaluations/:id/etudiants`. */
export interface LigneEvaluation {
  inscriptionId?: string;
  id?: string;
  numero?: string;
  matricule?: string;
  nom?: string;
  prenom?: string;
  note?: number | null;
  present?: boolean;
}

/** Réponse de `/evaluations/:id/etudiants` : les inscrits sont dans `lignes`. */
export interface ReponseEtudiantsEvaluation {
  lignes?: LigneEvaluation[];
}

/** Réponse de `/notes/evaluation/:id` : l'épreuve et ses lignes de saisie. */
export interface ReponseNotesEvaluation {
  evaluation?: Evaluation;
  lignes?: Array<LigneEvaluation & { id?: string; saisieLe?: string }>;
}

/** Charge utile de la saisie des notes. */
export interface SaisieNotes {
  evaluationId: string;
  notes: Array<{ inscriptionId: string; note: number | null; present: boolean }>;
}

/** Retour de la saisie : nombre de notes enregistrées et notes ignorées. */
export interface ResultatSaisie {
  n?: number;
  ignorees?: number;
}

export const evaluationsService = {
  /** Liste paginée des évaluations. */
  liste(params: ParametresListe = {}) {
    return lister<Evaluation>('/evaluations', params);
  },

  /** Fiche d'une évaluation. */
  lire(id: string) {
    return lire<Evaluation>(`/evaluations/${id}`);
  },

  /** Crée une évaluation. */
  creer(payload: unknown) {
    return creer<Evaluation>('/evaluations', payload);
  },

  /** Modifie une évaluation. */
  modifier(id: string, payload: unknown) {
    return modifier<Evaluation>(`/evaluations/${id}`, payload);
  },

  /** Clôture une évaluation (fige le registre des notes). */
  cloturer(id: string) {
    return creer<unknown>(`/evaluations/${id}/cloturer`);
  },

  /** Inscrits d'une évaluation, avec leur note lorsqu'elle existe. */
  etudiants(id: string) {
    return lire<ReponseEtudiantsEvaluation | LigneEvaluation[]>(`/evaluations/${id}/etudiants`).then((reponse) =>
      Array.isArray(reponse) ? reponse : (reponse?.lignes ?? []),
    );
  },
};
