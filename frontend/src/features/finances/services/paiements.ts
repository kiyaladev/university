import { creer, lister, lire } from '@/shared/services/http';
import { paiementsApi } from '@/shared/services/paiements';
import type { Etudiant, Paiement } from '@/types';

/**
 * Registre des paiements (`/paiements`).
 *
 * - `GET /paiements` : registre paginé, filtrable par recherche, statut,
 *   mode, inscription et étudiant.
 * - `POST /paiements/:id/simuler` : on tranche un paiement en attente (le
 *   back ne parle pas à un prestataire de paiement).
 * - `POST /paiements/:id/annuler` : on annule un paiement, avec son motif.
 * - `GET /inscriptions?all=1` et `GET /etudiants/:id` : lectures de contexte
 *   qui servent au bandeau de ciblage (arrivée depuis un dossier ou une fiche).
 */

/** Portefeuille d'origine du paiement. */
export type SourcePaiement = 'INSCRIPTION' | 'FORMATION' | 'RESTO' | 'RECETTE' | 'DOCUMENT';

/** Écran de gestion de chaque portefeuille autre que les inscriptions. */
export const ROUTE_SOURCE: Record<Exclude<SourcePaiement, 'INSCRIPTION'>, string> = {
  FORMATION: '/formations-admin',
  RESTO: '/resto',
  RECETTE: '/recettes',
  DOCUMENT: '/demandes-docs',
};

/** Paramètres acceptés par le registre. */
export interface ParametresPaiements {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  statut?: string;
  mode?: string;
  inscriptionId?: string;
  etudiantId?: string;
}

export const paiementsService = {
  /** Registre paginé des paiements. */
  liste: (params: ParametresPaiements = {}) => lister<Paiement>('/paiements', params),

  /** Tranche un paiement en attente : réussi ou échoué. */
  simuler: (id: string, statut: 'REUSSI' | 'ECHOUE') => paiementsApi.simuler(id, statut),

  /** Annule un paiement, avec le motif donné. */
  annuler: (id: string, motif: string) => creer<Paiement>(`/paiements/${id}/annuler`, { motif }),

  /** Toutes les inscriptions : le bandeau de ciblage y cherche son dossier. */
  inscriptions: () => paiementsApi.dossiers(),

  /** Fiche d'un étudiant : le bandeau de ciblage y cherche son nom. */
  etudiant: (id: string) => lire<Etudiant>(`/etudiants/${id}`),
};

/** Le portefeuille d'origine du paiement ; les inscriptions par défaut. */
export function sourceDe(paiement: Paiement): SourcePaiement {
  return (paiement as Paiement & { source?: SourcePaiement }).source ?? 'INSCRIPTION';
}

/** Seuls les paiements d'inscription se confirment ou s'annulent ici. */
export function estInscription(paiement: Paiement): boolean {
  return sourceDe(paiement) === 'INSCRIPTION';
}

/**
 * Lien vers le module qui gère le paiement, si l'utilisateur peut l'ouvrir.
 * `modulesOuverts` dit, pour chaque portefeuille, si l'écran est accessible
 * au rôle courant.
 */
export function routeModule(paiement: Paiement, modulesOuverts: Record<string, boolean>): string | null {
  const source = sourceDe(paiement);
  if (source === 'INSCRIPTION') return null;
  if (!modulesOuverts[source]) return null;
  return ROUTE_SOURCE[source];
}

/** Un paiement d'inscription en attente peut être simulé. */
export function peutSimulerPaiement(paiement: Paiement, autorise: boolean): boolean {
  return autorise && estInscription(paiement) && paiement.statut === 'EN_ATTENTE';
}

/** Un paiement d'inscription non réglé peut être annulé. */
export function peutAnnulerPaiement(paiement: Paiement, autorise: boolean): boolean {
  return autorise && estInscription(paiement) && !['REUSSI', 'ANNULE', 'REMBOURSE'].includes(paiement.statut);
}
