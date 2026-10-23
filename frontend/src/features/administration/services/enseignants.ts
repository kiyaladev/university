import { creer, lire, lister, modifier, supprimer } from '@/shared/services/http';
import type { Enseignant, Liste, MoyensAttestation } from '@/types';

/**
 * Enseignants (`/enseignants`) et leurs moyens d'attestation (`/attestation`).
 *
 * - `GET /enseignants` : la liste paginée, filtrée par département et statut.
 * - `POST /enseignants` et `PUT /enseignants/:id` : la fiche de l'enseignant.
 * - `DELETE /enseignants/:id` : la suppression.
 * - `GET /attestation/enseignants/:id/moyens` : les moyens de preuve en vigueur
 *   (code personnel, empreinte enrôlée).
 * - `POST /attestation/enseignants/:id/code-pin/reinitialiser` : un nouveau code
 *   personnel — l'API ne le renvoie qu'ici, une seule fois.
 * - `PUT /attestation/enseignants/:id/empreinte` : l'enregistrement de l'empreinte
 *   lue par le poste de l'administration.
 */

/** Filtres de la liste des enseignants. */
export type ParamsEnseignants = {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  departementId?: string;
  statut?: string;
};

/** Corps de création ou de modification d'un enseignant. */
export interface EnseignantSaisie {
  matricule?: string;
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  grade?: string | null;
  statut?: string;
  tauxHoraire?: number;
  departementId?: string | null;
  actif?: boolean;
}

/** Réponse de la réinitialisation du code personnel. */
export interface ReinitialisationCodePin {
  code: string;
  message?: string;
}

/** Capture d'empreinte lue par le poste, transmise à l'API. */
export interface CaptureEmpreinte {
  template: string;
  doigt?: string;
  horodatage: string;
  signature: string;
  qualite: number;
  consentement?: boolean;
}

export const enseignantsService = {
  /** Liste paginée des enseignants. */
  liste: (params: ParamsEnseignants = {}) => lister<Enseignant>('/enseignants', params),

  /** Création d'un enseignant. */
  creer: (corps: EnseignantSaisie) => creer<Enseignant>('/enseignants', corps),

  /** Modification de la fiche d'un enseignant. */
  modifier: (id: string, corps: Partial<EnseignantSaisie>) => modifier<Enseignant>(`/enseignants/${id}`, corps),

  /** Suppression d'un enseignant. */
  supprimer: (id: string) => supprimer(`/enseignants/${id}`),

  /** Moyens de preuve en vigueur pour un enseignant. */
  moyens: (id: string) => lire<MoyensAttestation>(`/attestation/enseignants/${id}/moyens`),

  /** Génère un nouveau code personnel : l'API ne le rend qu'ici, une fois. */
  reinitialiserCodePin: (id: string) =>
    creer<ReinitialisationCodePin>(`/attestation/enseignants/${id}/code-pin/reinitialiser`),

  /** Enregistre l'empreinte lue par le poste. */
  enregistrerEmpreinte: (id: string, capture: CaptureEmpreinte) =>
    modifier<{ message: string }>(`/attestation/enseignants/${id}/empreinte`, {
      ...capture,
      consentement: capture.consentement ?? true,
    }),
};

/** Une page d'enseignants. */
export type PageEnseignants = Liste<Enseignant>;
