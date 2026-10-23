import { creer, lire, modifier, supprimer } from '@/shared/services/http';

/**
 * Moyens de preuve de présence des enseignants (`/attestation`).
 *
 * Rôles, tels qu'écrits dans les `@Roles` du contrôleur :
 *
 * - `GET /attestation/appareils` et `DELETE /attestation/appareils/:id` :
 *   administration et direction ;
 * - `GET /attestation/enseignants/:id/moyens` : administration, scolarité, chef
 *   de département et direction (le contrôleur y accède pour un pointage en
 *   cours) ;
 * - `PUT /attestation/enseignants/:id/code-pin`,
 *   `POST /attestation/enseignants/:id/code-pin/reinitialiser`,
 *   `DELETE /attestation/enseignants/:id/code-pin` et
 *   `DELETE /attestation/enseignants/:id/empreinte` : administration, scolarité,
 *   chef de département (dans son département) et direction.
 */

/** Appareil de contrôle enrôlé : il signe les lectures d'empreinte. */
export interface AppareilAttestation {
  id: string;
  libelle: string;
  actif: boolean;
  createdAt: string;
  dernierUsage?: string | null;
  revoqueLe?: string | null;
  user?: { nom: string; prenom: string } | null;
}

/** Moyens d'attestation en vigueur pour un enseignant. */
export interface MoyensAttestation {
  /** Un code personnel est défini. */
  codePin: boolean;
  /** Une empreinte est enrôlée. */
  empreinte: boolean;
  /** Doigt ayant servi à l'enrôlement. */
  empreinteDoigt?: string | null;
}

/** Réponse de la réinitialisation : le code n'est renvoyé qu'une fois. */
export interface ReinitialisationCodePin {
  code: string;
  message: string;
}

/**
 * Gabarit biométrique d'un enseignant, transmis à la passerelle.
 *
 * Il ne quitte le serveur que pour la comparaison faite sur le poste de
 * contrôle : le gabarit enrôlé n'est jamais renvoyé tel quel à l'écran.
 */
export interface GabaritEmpreinte {
  /** Gabarit décodé, à passer à la passerelle. */
  template: string;
  /** Doigt ayant servi à l'enrôlement, pour le message d'accueil. */
  doigt?: string | null;
}

/** Administration et direction : gestion des appareils de contrôle. */
export const ROLES_GESTION_APPAREILS = ['ADMIN', 'DIRECTION'] as const;

/** Rôles qui gèrent les moyens d'un enseignant. */
export const ROLES_GESTION_MOYENS = ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'] as const;

export const attestationService = {
  /** Appareils de contrôle enrôlés. */
  appareils: () => lire<AppareilAttestation[]>('/attestation/appareils'),

  /** Révoque un appareil : ses lectures d'empreinte ne sont plus acceptées. */
  revoquerAppareil: (id: string) => supprimer(`/attestation/appareils/${id}`),

  /** Moyens d'attestation d'un enseignant, pour la séance en cours. */
  moyens: (enseignantId: string, seanceId?: string) =>
    lire<MoyensAttestation>(
      `/attestation/enseignants/${enseignantId}/moyens`,
      seanceId ? { seanceId } : undefined,
    ),

  /**
   * Gabarit biométrique de l'enseignant, pour la comparaison en salle.
   *
   * Silencieux : l'écran de pointage affiche l'échec dans son propre bandeau.
   */
  gabarit: (enseignantId: string, seanceId?: string) =>
    lire<GabaritEmpreinte>(
      `/attestation/enseignants/${enseignantId}/gabarit`,
      seanceId ? { seanceId } : undefined,
      { silencieux: true },
    ),

  /** Fixe le code personnel de l'enseignant (4 à 6 chiffres). */
  definirCodePin: (enseignantId: string, code: string) =>
    modifier<{ message: string }>(`/attestation/enseignants/${enseignantId}/code-pin`, { code }),

  /** Génère un nouveau code : l'API ne le renvoie qu'ici, une seule fois. */
  reinitialiserCodePin: (enseignantId: string) =>
    creer<ReinitialisationCodePin>(`/attestation/enseignants/${enseignantId}/code-pin/reinitialiser`),

  /** Retire le code personnel de l'enseignant. */
  supprimerCodePin: (enseignantId: string) => supprimer(`/attestation/enseignants/${enseignantId}/code-pin`),

  /** Retire l'empreinte enrôlée de l'enseignant. */
  supprimerEmpreinte: (enseignantId: string) => supprimer(`/attestation/enseignants/${enseignantId}/empreinte`),
};

/** Nom d'affichage d'un appareil : son libellé et son contrôleur. */
export function libelleAppareil(appareil: AppareilAttestation): string {
  const controleur = appareil.user ? `${appareil.user.prenom} ${appareil.user.nom}`.trim() : '';
  return controleur ? `${appareil.libelle} — ${controleur}` : appareil.libelle;
}

/** Un appareil révoqué ne sert plus : l'écran le signale, l'API le désactive. */
export function appareilActif(appareil: AppareilAttestation): boolean {
  return !!appareil.actif && !appareil.revoqueLe;
}
