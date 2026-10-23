import { lister, lire, modifier, supprimer } from '@/shared/services/http';
import type { Controle, StatutPresence } from '@/types';

/**
 * Consultation et correction des pointages (`/controles`).
 *
 * Rôles, tels qu'écrits dans les `@Roles` du contrôleur :
 *
 * - `GET /controles` : administration, direction, scolarité, chef de
 *   département, contrôleur et enseignant (l'enseignant ne voit que les
 *   siens) ;
 * - `GET /controles/salle/:token` : contrôleur, administration, direction, chef
 *   de département et scolarité ;
 * - `PUT /controles/:id` : contrôleur, administration, direction et chef de
 *   département — et, dans les faits, l'agent qui a fait le pointage, ou
 *   l'administration et la direction ;
 * - `DELETE /controles/:id` : administration et direction.
 */

/** Filtres acceptés par la liste des pointages. */
export interface ParametresPointages {
  dateDebut?: string | null;
  dateFin?: string | null;
  statut?: StatutPresence | null;
  methode?: string | null;
  controleurId?: string | null;
  enseignantId?: string | null;
  departementId?: string | null;
  salleId?: string | null;
  page?: number;
  pageSize?: number;
  all?: string;
}

/**
 * Champs qu'une correction peut modifier. Les preuves (QR, position,
 * signature, code personnel, empreinte) ne se rejouent pas : elles valent pour
 * le pointage d'origine.
 */
export interface CorrectionPointage {
  statut?: StatutPresence;
  heureArrivee?: string;
  heureFinReelle?: string;
  effectifPresent?: number;
  thematiqueTraitee?: string;
  observation?: string;
  enseignantRemplacantId?: string;
}

/** Rôles autorisés à corriger un pointage (`PUT /controles/:id`). */
export const ROLES_CORRECTION_POINTAGES = ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'] as const;

/** Rôles autorisés à supprimer un pointage (`DELETE /controles/:id`). */
export const ROLES_SUPPRESSION_POINTAGES = ['ADMIN', 'DIRECTION'] as const;

export const pointagesService = {
  /** Pointages filtrés par date, statut, méthode, enseignant, salle… */
  liste: (params: ParametresPointages = {}) => lister<Controle>('/controles', params),

  /** Pointage détaillé. */
  lire: (id: string) => lire<Controle>(`/controles/${id}`),

  /** Corrige un pointage : seuls les champs transmis changent. */
  modifier: (id: string, corps: CorrectionPointage) => modifier<Controle>(`/controles/${id}`, corps),

  /** Supprime un pointage. */
  supprimer: (id: string) => supprimer(`/controles/${id}`),

  /** Séances du jour de la salle portant ce QR. */
  parSalle: (token: string) =>
    lire<{ salle: { id: string; code: string; nom: string }; seances: unknown[] }>(`/controles/salle/${token}`),
};

/**
 * Un pointage est modifiable par l'agent qui l'a fait, et par l'administration
 * et la direction. L'API tranche de la même façon, et seuls les rôles autorisés
 * à corriger peuvent le faire.
 */
export function peutCorriger(controle: Controle, roles: string[], agentId?: string | null): boolean {
  const autorises = roles.filter((role) => (ROLES_CORRECTION_POINTAGES as readonly string[]).includes(role));
  if (!autorises.length) return false;
  if (autorises.includes('ADMIN') || autorises.includes('DIRECTION')) return true;
  return !!agentId && controle.controleurId === agentId;
}
