import { api } from '../boot/axios';
import type { Election, ResultatElection, StatutElection, TypeElection } from '../types';

export interface MonVote {
  aVote: boolean;
  scrutinId: string | null;
  dateVote: string | null;
}

export interface PageElections {
  data: Election[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ParametresListeElections {
  page?: number;
  pageSize?: number;
  statut?: StatutElection;
  type?: TypeElection;
  search?: string;
}

/**
 * Libellés et couleurs du domaine « élections ». Ils ne vivent pas dans
 * utils/libelles.ts (module commun figé) : on les tient ici pour que la page
 * de gestion et la page de vote parlent exactement la même langue.
 */
export const LIBELLE_STATUT_ELECTION: Record<StatutElection, string> = {
  BROUILLON: 'Brouillon',
  OUVERTE: 'Ouverte',
  CLOSE: 'Close',
  PROCLAMEE: 'Proclamée',
  ANNULEE: 'Annulée',
};

/** Classes de champ peint, communes aux deux écrans (voir css/app.scss). */
export const CLASSE_STATUT_ELECTION: Record<StatutElection, string> = {
  BROUILLON: 'badge--neutre',
  OUVERTE: 'badge--ok',
  CLOSE: 'badge--attention',
  PROCLAMEE: 'badge--primaire',
  ANNULEE: 'badge--ko',
};

export const OPTIONS_TYPE_ELECTION: Array<{ value: TypeElection; label: string }> = [
  { value: 'DELEGUE_PROMOTION', label: 'Délégué de promotion' },
  { value: 'DELEGUE_DEPARTEMENT', label: 'Délégué de département' },
  { value: 'PRESIDENT_UNIVERSITE', label: "Président d'université" },
  { value: 'SYNDICAT', label: 'Syndicat' },
  { value: 'CLUB', label: 'Club' },
];

export const LIBELLE_TYPE_ELECTION: Record<string, string> = Object.fromEntries(
  OPTIONS_TYPE_ELECTION.map((o) => [o.value, o.label]),
);

/** « 12 août 2026 » — date d'un scrutin, sans l'heure. */
export function dateElection(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** « 12 août, 14:30 » — ouverture / clôture d'un scrutin. */
export function dateHeureElection(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Message d'erreur exploitable : le back renvoie parfois un tableau. */
export function messageErreurElection(e: unknown, defaut: string): string {
  const message = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message ?? defaut;
}

export const electionsService = {
  liste: (params: ParametresListeElections) => api.get<PageElections>('/elections', { params }),
  actives: () => api.get<Election[]>('/elections/actives'),
  trouver: (id: string) => api.get<Election>(`/elections/${id}`),
  monVote: (electionId: string) => api.get<MonVote>(`/elections/${electionId}/mon-vote`),
  resultats: (id: string) => api.get<ResultatElection>(`/elections/${id}/resultats`),
  voter: (payload: { electionId: string; bulletin: Array<{ candidatId: string }> }) =>
    api.post<{ scrutinId: string; nbVotes: number }>('/elections/vote', payload),
  transition: (id: string, action: 'ouvrir' | 'clore' | 'proclamer') =>
    api.post<Election>(`/elections/${id}/${action}`),
  supprimerCandidat: (electionId: string, candidatId: string) =>
    api.delete(`/elections/${electionId}/candidats/${candidatId}`),
};
