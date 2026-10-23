import { creer, lister, supprimer } from '@/shared/services/http';
import type { FeuillePaie } from '@/types';

/**
 * Feuilles de paie des enseignants (`/feuilles-paie`).
 *
 * - `GET /feuilles-paie` : feuilles paginées, filtrables par statut et année.
 * - `POST /feuilles-paie` : création d'une feuille (mois + année).
 * - `POST /feuilles-paie/:id/<action>` : cycle de vie de la feuille
 *   (`calculer`, `valider`, `payer`).
 * - `DELETE /feuilles-paie/:id` : suppression d'une feuille encore brouillon.
 */

/** Action du cycle de vie d'une feuille de paie. */
export type ActionFeuillePaie = 'calculer' | 'valider' | 'payer';

/** Paramètres acceptés par le registre des feuilles. */
export interface ParametresFeuillesPaie {
  page?: number;
  pageSize?: number;
  all?: string;
  statut?: string;
  annee?: number;
}

export const paieService = {
  /** Feuilles paginées. */
  liste: (params: ParametresFeuillesPaie = {}) => lister<FeuillePaie>('/feuilles-paie', params),

  /** Crée une feuille pour un mois et une année. */
  creer: (corps: { mois: number | null; annee: number | null }) =>
    creer<FeuillePaie>('/feuilles-paie', corps),

  /** Action du cycle de vie : recalcul, validation ou paiement. */
  action: (id: string, action: ActionFeuillePaie) =>
    creer<FeuillePaie>(`/feuilles-paie/${id}/${action}`),

  /** Supprime une feuille. */
  supprimer: (id: string) => supprimer(`/feuilles-paie/${id}`),
};

/** Une feuille encore brouillon peut être recalculée. */
export function peutCalculerFeuille(feuille: FeuillePaie, autorise: boolean): boolean {
  return autorise && feuille.statut === 'BROUILLON';
}

/** Une feuille encore brouillon peut être validée. */
export function peutValiderFeuille(feuille: FeuillePaie, autorise: boolean): boolean {
  return autorise && feuille.statut === 'BROUILLON';
}

/** Une feuille validée peut être payée. */
export function peutPayerFeuille(feuille: FeuillePaie, autorise: boolean): boolean {
  return autorise && feuille.statut === 'VALIDE';
}

/** Une feuille encore brouillon peut être supprimée. */
export function peutSupprimerFeuille(feuille: FeuillePaie, autorise: boolean): boolean {
  return autorise && feuille.statut === 'BROUILLON';
}
