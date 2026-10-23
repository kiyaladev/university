import { lister } from '@/shared/services/http';

/**
 * Journal des contrôles (`/controles/audit`).
 *
 * La requête est silencieuse : l'écran d'audit affiche l'échec dans son
 * propre bandeau, la notification de l'intercepteur y ferait doublon.
 */

/** Une ligne du journal. */
export interface AuditRow {
  id: string;
  action: string;
  entite: string;
  entiteId?: string;
  createdAt: string;
  details?: string;
  user?: { nom: string; prenom: string; role: string };
}

/** Saisie du formulaire de recherche de l'écran d'audit. */
export interface FiltresAudit {
  entite: string;
  action: string;
  acteur: string;
  dateDebut: string;
  dateFin: string;
}

/** Paramètres acceptés par `GET /controles/audit`. */
export interface ParametresAudit {
  page?: number;
  pageSize?: number;
  acteur?: string;
  entite?: string;
  action?: string;
  dateDebut?: string;
  dateFin?: string;
}

/**
 * Bornes de la période : le formulaire saisit un jour, l'API attend un
 * horodatage — début de journée pour la borne basse, fin de journée pour la
 * borne haute.
 */
export function bornesAudit(filtres: FiltresAudit): { dateDebut?: string; dateFin?: string } {
  return {
    dateDebut: filtres.dateDebut ? new Date(`${filtres.dateDebut}T00:00:00`).toISOString() : undefined,
    dateFin: filtres.dateFin ? new Date(`${filtres.dateFin}T23:59:59.999`).toISOString() : undefined,
  };
}

export const auditService = {
  /** Journal paginé et filtré. */
  liste: (params: ParametresAudit) => lister<AuditRow>('/controles/audit', { ...params }, { silencieux: true }),
};
