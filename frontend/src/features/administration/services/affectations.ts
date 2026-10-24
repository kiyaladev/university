import { creer, lister, modifier } from '@/shared/services/http';
import type { Affectation, AnneeAcademique } from '@/types';

/**
 * Charges d'enseignement : une matière portée par un enseignant pour une
 * promotion et une année académique.
 *
 * - `GET /affectations` : liste paginée, filtrable par recherche, enseignant,
 *   matière, promotion et année.
 * - `POST /affectations` et `PUT /affectations/:id` : création et modification.
 */

/** Le backend joint l'année académique ; le type partagé ne la déclare pas. */
export interface Charge extends Affectation {
  annee?: AnneeAcademique | null;
}

/** Corps accepté par la création et la modification d'une charge. */
export interface AffectationSaisie {
  enseignantId: string;
  matiereId: string;
  promotionId: string;
  anneeId: string;
  volumeHorairePrevu?: number;
}

/** Filtres acceptés par la liste des charges. */
export interface AffectationsParams {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  enseignantId?: string;
  matiereId?: string;
  promotionId?: string;
  anneeId?: string;
}

export const affectationsService = {
  /** Charges, paginées par le serveur. */
  liste: (params: AffectationsParams = {}) => lister<Charge>('/affectations', params),

  /** Création d'une charge. */
  creer: (corps: AffectationSaisie) => creer<Charge>('/affectations', corps),

  /** Modification d'une charge. */
  modifier: (id: string, corps: Partial<AffectationSaisie>) => modifier<Charge>(`/affectations/${id}`, corps),
};
