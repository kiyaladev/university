import { creer, lire, lister, modifier, supprimer } from '@/shared/services/http';
import type { ReservationSalle } from '@/types';
import type { JourCalendrier, ReservationDetail } from '../types';

/**
 * Réservation de salles : la liste, le calendrier (seule route qui filtre sur
 * une période) et les décisions de confirmation.
 */

/** Filtres acceptés par la liste des réservations. */
export interface ParametresReservations {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  dateJour?: string;
  salleId?: string;
  statut?: string;
}

/** Filtres acceptés par le calendrier : une période, éventuellement une salle. */
export interface ParametresCalendrier {
  dateDebut?: string;
  dateFin?: string;
  salleId?: string;
}

/** Réponse du calendrier : les jours et les salles de la période. */
export interface CalendrierReservations {
  jours?: JourCalendrier[];
  salles?: Array<{ id: string; nom?: string | null; code?: string | null; capacite?: number | null }>;
}

/** Champs acceptés à la création ou à la modification d'une réservation. */
export interface CorpsReservation {
  salleId: string;
  dateJour: string;
  heureDebut: string;
  heureFin: string;
  motif?: string | null;
  organisme?: string | null;
  responsable?: string | null;
}

export const reservationsService = {
  /** Réservations d'une journée, ou d'une période. */
  liste: (params: ParametresReservations = {}) => lister<ReservationSalle>('/reservations', { ...params }),

  /**
   * Calendrier d'une période : renvoie les jours et les salles.
   *
   * Seule route qui filtre vraiment sur une période — la liste `/reservations`
   * n'accepte qu'un `dateJour`.
   */
  calendrier: (params: ParametresCalendrier = {}) =>
    lire<CalendrierReservations>('/reservations/calendrier', { ...params }),

  /** Détail d'une réservation. */
  detail: (id: string) => lire<ReservationDetail>(`/reservations/${id}`),

  /** Dépose une demande de réservation (silencieuse : le dialogue affiche le motif). */
  creer: (corps: CorpsReservation) => creer<ReservationSalle>('/reservations', corps, { silencieux: true }),

  /** Modifie une réservation en attente (silencieuse : idem). */
  modifier: (id: string, corps: Partial<CorpsReservation>) =>
    modifier<ReservationSalle>(`/reservations/${id}`, corps, { silencieux: true }),

  /** Annule une réservation (silencieuse : idem). */
  supprimer: (id: string) => supprimer(`/reservations/${id}`, { silencieux: true }),

  /** Confirme ou refuse une demande de réservation. */
  decider: (id: string, corps: { statut: 'CONFIRME' | 'REFUSE'; motif?: string }) =>
    creer<void>(`/reservations/${id}/decider`, corps, { silencieux: true }),
};
