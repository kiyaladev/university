import { creer, lister, modifier } from '@/shared/services/http';
import type { Salle } from '@/types';

/**
 * Salles de cours : code, capacité, repère GPS et jeton QR affiché à l'entrée.
 *
 * - `GET /salles` : liste paginée des salles.
 * - `POST /salles` et `PUT /salles/:id` : création et modification.
 * - `POST /salles/:id/qr` : régénération du jeton QR de la salle.
 *
 * Les suppressions passent par `useConfirmation`, qui appelle l'API
 * elle-même à partir de l'URL.
 */

/** Corps accepté par la création et la modification d'une salle. */
export interface SalleSaisie {
  code: string;
  nom: string;
  batiment?: string;
  capacite?: number;
  latitude?: number;
  longitude?: number;
  rayonMetres?: number;
  actif?: boolean;
}

/** Filtres acceptés par la liste des salles. */
export interface SallesParams {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
}

export const sallesService = {
  /** Salles, paginées par le serveur. */
  liste: (params: SallesParams = {}) => lister<Salle>('/salles', params),

  /** Création d'une salle. */
  creer: (corps: SalleSaisie) => creer<Salle>('/salles', corps),

  /** Modification d'une salle. */
  modifier: (id: string, corps: Partial<SalleSaisie>) => modifier<Salle>(`/salles/${id}`, corps),

  /** Régénère le jeton QR affiché à l'entrée de la salle. */
  regenererQr: (id: string) => creer<Salle>(`/salles/${id}/qr`),
};
