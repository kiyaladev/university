import { creer, lire, lister, modifier, supprimer } from '@/shared/services/http';
import type { CandidatElection, Election, Liste, ResultatElection, StatutElection, TypeElection } from '@/types';
import { dateCourteLisible, dateHeureLisible } from '@/shared/utils/format';

export interface MonVote {
  aVote: boolean;
  scrutinId: string | null;
  dateVote: string | null;
}

export interface ParametresListeElections {
  page?: number;
  pageSize?: number;
  statut?: StatutElection;
  type?: TypeElection;
  search?: string;
}

/** Champs acceptés à la création ou à la modification d'un scrutin. */
export interface CorpsElection {
  titre: string;
  type: TypeElection;
  dateOuverture?: string | null;
  dateCloture?: string | null;
  nbSieges?: number;
  bulletin?: string | null;
  description?: string | null;
  promotionId?: string | null;
  departementId?: string | null;
}

/** Champs acceptés à la déclaration d'un candidat. */
export interface CorpsCandidat {
  nom: string;
  prenom: string;
  ordre?: number;
  etudiantId?: string | null;
  enseignantId?: string | null;
  photoUrl?: string | null;
  programme?: string | null;
}

/**
 * Le libellé d'un statut d'élection vit désormais avec les autres dans
 * shared/utils/libelles (et sa couleur dans shared/utils/statuts) : réexporté ici pour les
 * écrans qui l'importaient depuis le service.
 */
export { LIBELLE_STATUT_ELECTION } from '@/shared/utils/libelles';

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
  return dateCourteLisible(v);
}

/** « 12 août, 14:30 » — ouverture / clôture d'un scrutin. */
export function dateHeureElection(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return dateHeureLisible(v, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Message d'erreur exploitable : le back renvoie parfois un tableau. */
export function messageErreurElection(e: unknown, defaut: string): string {
  const message = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message ?? defaut;
}

/**
 * `silencieux` : l'intercepteur ne notifie pas l'erreur, la page l'affiche
 * elle-même (bandeau de l'isoloir) ou l'ignore volontairement.
 */
export const electionsService = {
  liste: (params: ParametresListeElections, silencieux = false) =>
    lister<Election>('/elections', { ...params }, { silencieux }),

  actives: (silencieux = false) => lire<Election[]>('/elections/actives', undefined, { silencieux }),

  trouver: (id: string, silencieux = false) => lire<Election>(`/elections/${id}`, undefined, { silencieux }),

  /** Crée un scrutin. */
  creer: (corps: CorpsElection) => creer<Election>('/elections', corps),

  /** Modifie un scrutin. */
  modifier: (id: string, corps: Partial<CorpsElection>) => modifier<Election>(`/elections/${id}`, corps),

  /** Déclare un candidat à un scrutin. */
  creerCandidat: (electionId: string, corps: CorpsCandidat) =>
    creer<CandidatElection>(`/elections/${electionId}/candidats`, corps),

  monVote: (electionId: string, silencieux = false) =>
    lire<MonVote>(`/elections/${electionId}/mon-vote`, undefined, { silencieux }),

  resultats: (id: string, silencieux = false) =>
    lire<ResultatElection>(`/elections/${id}/resultats`, undefined, { silencieux }),

  voter: (payload: { electionId: string; bulletin: Array<{ candidatId: string }> }, silencieux = false) =>
    creer<{ scrutinId: string; nbVotes: number }>('/elections/vote', payload, { silencieux }),

  transition: (id: string, action: 'ouvrir' | 'clore' | 'proclamer') =>
    creer<Election>(`/elections/${id}/${action}`),

  supprimerCandidat: (electionId: string, candidatId: string) =>
    supprimer(`/elections/${electionId}/candidats/${candidatId}`),
};

/** Liste des élections : la page consomme `{ data, total }`. */
export type ListeElections = Liste<Election>;
