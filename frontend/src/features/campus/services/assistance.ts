import { creer, lire, lister, modifier, supprimer } from '@/shared/services/http';
import type { EquipementCampus, TicketSupport } from '@/types';

/**
 * Assistance : le parc d'équipements du campus (les cartes QR que l'on scanne)
 * et les tickets d'incident qui leur sont rattachés.
 */

/** Filtres acceptés par la liste des équipements. */
export interface ParametresEquipements {
  all?: string;
  search?: string;
  actif?: string;
}

/** Filtres acceptés par la liste des tickets. */
export interface ParametresTickets {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  statut?: string;
  categorie?: string;
  priorite?: string;
  equipementId?: string;
}

/** Champs acceptés à la création ou à la modification d'un équipement. */
export interface CorpsEquipement {
  libelle: string;
  emplacement?: string | null;
  actif?: boolean;
}

/** Champs acceptés à l'ouverture d'un ticket d'incident. */
export interface CorpsTicket {
  equipementId?: string | null;
  categorie: string;
  description: string;
  priorite?: string;
}

/** Compteurs du tableau de bord de l'assistance. */
export interface StatsTickets {
  total?: number;
  ouverts?: number;
  enCours?: number;
  resolus?: number;
  clotures?: number;
  [cle: string]: number | undefined;
}

export const equipementsService = {
  /** Parc des équipements : l'API filtre mais ne pagine pas cette ressource. */
  liste: (params: ParametresEquipements = {}) => lister<EquipementCampus>('/equipements', { ...params }),

  creer: (corps: CorpsEquipement) => creer<EquipementCampus>('/equipements', corps),

  modifier: (id: string, corps: Partial<CorpsEquipement>) => modifier<EquipementCampus>(`/equipements/${id}`, corps),

  supprimer: (id: string) => supprimer(`/equipements/${id}`),

  /** Équipement désigné par son code QR (scan d'une carte). */
  parCode: (code: string) => lire<EquipementCampus>(`/equipements/par-code/${encodeURIComponent(code)}`),
};

export const ticketsService = {
  /** Tickets de support : la liste est paginée côté serveur. */
  liste: (params: ParametresTickets = {}) => lister<TicketSupport>('/tickets', { ...params }),

  /** Ouvre un ticket d'incident. */
  creer: (corps: CorpsTicket) => creer<TicketSupport>('/tickets', corps),

  /** Compteurs du tableau de bord (tous les tickets). */
  stats: () => lire<StatsTickets>('/tickets/stats'),

  /** Change le statut d'un ticket (ouvert, en cours, résolu…). */
  changerStatut: (id: string, statut: string) => creer<void>(`/tickets/${id}/statut`, { statut }),
};
