import { creer, lister, modifier } from '@/shared/services/http';
import type { Matiere } from '@/types';

/**
 * Matières (unités d'enseignement) : code, intitulé, volume horaire et
 * crédits, rattachées à un département.
 *
 * - `GET /matieres` : liste paginée, filtrable par recherche et département.
 * - `POST /matieres` et `PUT /matieres/:id` : création et modification.
 */

/** Corps accepté par la création et la modification d'une matière. */
export interface MatiereSaisie {
  code: string;
  intitule: string;
  volumeHoraireTotal?: number;
  credits?: number;
  departementId?: string;
}

/** Filtres acceptés par la liste des matières. */
export interface MatieresParams {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  departementId?: string;
}

export const matieresService = {
  /** Matières, paginées par le serveur. */
  liste: (params: MatieresParams = {}) => lister<Matiere>('/matieres', { ...params }),

  /** Création d'une matière. */
  creer: (corps: MatiereSaisie) => creer<Matiere>('/matieres', corps),

  /** Modification d'une matière. */
  modifier: (id: string, corps: Partial<MatiereSaisie>) => modifier<Matiere>(`/matieres/${id}`, corps),
};
