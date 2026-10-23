import { creer, lister, modifier } from '@/shared/services/http';
import type { Justificatif, StatutJustificatif } from '@/types';

/**
 * Justificatifs d'absence (`/justificatifs`).
 *
 * Un enseignant dépose un justificatif pour une séance non assurée ; la
 * scolarité l'arbitre ensuite (validation ou rejet).
 */

/** Filtres acceptés par la liste des justificatifs. */
export interface ParametresJustificatifs {
  statut?: StatutJustificatif | string | null;
  type?: string | null;
  enseignantId?: string | null;
  departementId?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  page?: number;
  pageSize?: number;
  /** `1` : tous les justificatifs, sans pagination. */
  all?: string;
}

/** Justificatif déposé par un enseignant. */
export interface DepotJustificatif {
  seanceId: string;
  type: string;
  motif: string;
  /** Pièce jointe encodée (data-url) : certificat médical, ordre de mission… */
  piece?: string;
  /** Enseignant concerné ; à défaut, celui de la séance. */
  enseignantId?: string;
}

export const justificatifsService = {
  /** Justificatifs filtrés par statut, type, enseignant et période. */
  liste: (params: ParametresJustificatifs = {}) => lister<Justificatif>('/justificatifs', { ...params }),

  /** Dépose un justificatif pour une séance. */
  deposer: (corps: DepotJustificatif) => creer<Justificatif>('/justificatifs', corps),

  /** Arbitre un justificatif : validation ou rejet, avec un commentaire. */
  traiter: (id: string, statut: 'VALIDE' | 'REJETE', commentaire?: string) =>
    modifier<Justificatif>(`/justificatifs/${id}/traiter`, { statut, commentaire }),
};
