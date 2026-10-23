import { lister } from '@/shared/services/http';
import type { Affectation } from '@/types';

/**
 * Affectations d'enseignement (`/affectations`).
 *
 * Une affectation relie un enseignant, une matière et une promotion : c'est la
 * ligne de l'emploi du temps d'un cours. Les écrans de présence la consultent
 * pour proposer au contrôleur le cours qu'il va pointer.
 */

/** Filtres acceptés par la liste des affectations. */
export interface ParametresAffectations {
  enseignantId?: string;
  promotionId?: string;
  matiereId?: string;
  anneeId?: string;
  page?: number;
  pageSize?: number;
  /** `1` : toutes les affectations, sans pagination. */
  all?: string;
}

export const affectationsService = {
  /** Affectations filtrées, avec leurs enseignants, matières et promotions. */
  liste: (params: ParametresAffectations = {}) => lister<Affectation>('/affectations', { ...params }),

  /**
   * Toutes les affectations, en un seul appel.
   *
   * La tournée et la saisie d'une séance hors ligne ont besoin de la liste
   * entière : la regarder par pages obligerait àgressive le serveur.
   */
  toutes: () => lister<Affectation>('/affectations', { all: '1' }),
};

/** Libellé lisible d'une affectation : enseignant · matière · promotion. */
export function libelleAffectation(affectation: Affectation): string {
  return `${affectation.enseignant?.nom} ${affectation.enseignant?.prenom} · ${affectation.matiere?.code} · ${affectation.promotion?.nom}`;
}
