import { creer, lister, modifier } from '@/shared/services/http';
import type { Role, Utilisateur } from '@/types';

/**
 * Comptes utilisateurs : identité, rôle et rattachement à un département ou à
 * une fiche enseignant.
 *
 * - `GET /utilisateurs` : liste paginée, filtrable par recherche, rôle et
 *   département.
 * - `POST /utilisateurs` et `PUT /utilisateurs/:id` : création et modification.
 *
 * Le mot de passe n'est envoyé que lorsqu'il est saisi : un compte existant
 * garde ainsi son mot de passe quand l'écran ne le renseigne pas.
 */

/** Corps accepté par la création et la modification d'un compte. */
export interface UtilisateurSaisie {
  nom: string;
  prenom: string;
  email: string;
  password?: string;
  role: Role;
  telephone?: string;
  departementId?: string;
  enseignantId?: string;
  actif?: boolean;
}

/** Filtres acceptés par la liste des comptes. */
export interface UtilisateursParams {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  role?: string;
  departementId?: string;
}

export const utilisateursService = {
  /** Comptes, paginés par le serveur. */
  liste: (params: UtilisateursParams = {}) => lister<Utilisateur>('/utilisateurs', { ...params }),

  /** Création d'un compte. */
  creer: (corps: UtilisateurSaisie) => creer<Utilisateur>('/utilisateurs', corps),

  /** Modification d'un compte. */
  modifier: (id: string, corps: Partial<UtilisateurSaisie>) => modifier<Utilisateur>(`/utilisateurs/${id}`, corps),
};
