import { creer, lister, modifier } from '@/shared/services/http';
import type { BadgeAcces } from '@/types';

/**
 * Badges d'accès : la liste, la fiche (création / modification) et les deux
 * gestes de vie — annulation et prolongation.
 */

/** Filtres acceptés par la liste des badges. */
export interface ParametresBadges {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  statut?: string;
}

/** Champs acceptés à la création ou à la modification d'un badge. */
export interface CorpsBadge {
  type: string;
  nom: string;
  prenom?: string | null;
  fonction?: string | null;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
  pieceIdentite?: string | null;
  numeroPiece?: string | null;
  dateValidite?: string | null;
  zonesAccess?: string | null;
  photoUrl?: string | null;
  motif?: string | null;
}

export const badgesService = {
  /** Badges filtrés et paginés par le serveur. */
  liste: (params: ParametresBadges = {}) => lister<BadgeAcces>('/badges', { ...params }),

  creer: (corps: CorpsBadge) => creer<BadgeAcces>('/badges', corps),

  modifier: (id: string, corps: Partial<CorpsBadge>) => modifier<BadgeAcces>(`/badges/${id}`, corps),

  /** Annule un badge (le motif est conservé côté serveur). */
  annuler: (id: string, motif: string) => creer<void>(`/badges/${id}/annuler`, { motif }),

  /** Prolonge la validité d'un badge. */
  rallonger: (id: string, dateValidite: string) => creer<void>(`/badges/${id}/rallonger`, { dateValidite }),
};
