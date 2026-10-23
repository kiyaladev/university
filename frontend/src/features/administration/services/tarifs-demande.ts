import { creer, lire, modifier } from '@/shared/services/http';
import type { TarifDemande, TypeDemandeDocument } from '@/types';

/**
 * Tarifs des demandes de documents (`/documents-demande/tarifs`).
 *
 * - `GET /documents-demande/tarifs` : la grille des tarifs.
 * - `POST /documents-demande/tarifs` : création d'un tarif.
 * - `PUT /documents-demande/tarifs/:id` : modification d'un tarif.
 */

/** Corps de création d'un tarif. */
export interface TarifSaisie {
  type: TypeDemandeDocument;
  montant: number;
  delaiHeures: number;
}

/** Corps de modification d'un tarif : le type ne change pas. */
export interface TarifModification {
  montant: number;
  delaiHeures: number;
}

/**
 * La grille est un tableau ; certaines versions de l'API l'enveloppent dans
 * `{ data }`. On accepte les deux écritures.
 */
export function tarifsDepuis(data: unknown): TarifDemande[] {
  if (Array.isArray(data)) return data as TarifDemande[];
  if (data && typeof data === 'object') {
    const enveloppe = (data as { data?: unknown }).data;
    if (Array.isArray(enveloppe)) return enveloppe as TarifDemande[];
  }
  return [];
}

export const tarifsDemandeService = {
  /** Grille des tarifs. */
  liste: async (): Promise<TarifDemande[]> =>
    tarifsDepuis(await lire<TarifDemande[] | { data: TarifDemande[] }>('/documents-demande/tarifs')),

  /** Création d'un tarif. */
  creer: (corps: TarifSaisie) => creer<TarifDemande>('/documents-demande/tarifs', corps),

  /** Modification d'un tarif. */
  modifier: (id: string, corps: TarifModification) =>
    modifier<TarifDemande>(`/documents-demande/tarifs/${id}`, corps),
};
