import { lire } from '@/shared/services/http';

/**
 * Vérifications publiques des documents university : attestations, cartes
 * étudiantes et badges d'accès.
 *
 * Les trois routes renvoient le même plan de réponse — `valide`, et le détail
 * du document quand il est authentifié. Les appels passent en `silencieux` :
 * le verdict, y compris l'échec, s'affiche dans le panneau de résultat de la
 * page ; une notification globale viendrait doubler ce message.
 */

/** Attestation vérifiée : ce que la page affiche quand le document est authentique. */
export interface ResultatVerificationAttestation {
  valide: boolean;
  raison?: string;
  verificationId?: string;
  attestation?: {
    numero?: string;
    type?: string;
    motif?: string | null;
    emiseLe?: string;
    etudiant?: { nom?: string; prenom?: string; matricule?: string } | null;
    annee?: string | null;
    promotion?: string | null;
  };
}

/** Carte étudiante vérifiée. */
export interface ResultatVerificationCarte {
  valide: boolean;
  raison?: string;
  carte?: {
    identifiant?: string;
    etudiant?: string | null;
    dateEmission?: string | null;
    dateValidite?: string | null;
  };
}

/** Badge d'accès vérifié. */
export interface ResultatVerificationBadge {
  valide: boolean;
  raison?: string;
  badge?: {
    numero?: string;
    type?: string;
    porteur?: string | null;
    fonction?: string | null;
    organisation?: string | null;
    zonesAccess?: string | null;
    dateDelivrance?: string | null;
    dateValidite?: string | null;
  };
}

export const verificationService = {
  /** Vérifie une attestation d'après sa référence et sa clé de lecture. */
  attestation: (ref: string, k: string) =>
    lire<ResultatVerificationAttestation>(
      '/attestations/verifier',
      { ref: ref.trim(), k: k.trim() },
      { silencieux: true },
    ),

  /** Vérifie une carte étudiante d'après son identifiant et sa clé de lecture. */
  carte: (carte: string, k: string) =>
    lire<ResultatVerificationCarte>(
      '/cartes-etudiantes/verifier',
      { carte: carte.trim(), k: k.trim() },
      { silencieux: true },
    ),

  /** Vérifie un badge d'accès d'après son numéro et sa clé de lecture. */
  badge: (badge: string, k: string) =>
    lire<ResultatVerificationBadge>('/badges/verifier', { badge: badge.trim(), k: k.trim() }, { silencieux: true }),
};
