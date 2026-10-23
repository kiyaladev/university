import { creer } from '@/shared/services/http';

/**
 * Portail de connexion par code à usage unique (OTP).
 *
 * L'envoi du code est silencieux : la réponse du serveur est volontairement
 * identique pour un numéro connu ou non — le portail ne révèle jamais quels
 * numéros figurent au registre — et la page affiche elle-même le motif dans
 * son bandeau.
 */

/** Demande d'envoi du code au numéro saisi. */
export interface DemandeCodeOtp {
  telephone: string;
}

export const portailService = {
  /** Demande l'envoi du code par SMS. */
  demanderCode: (corps: DemandeCodeOtp) => creer<{ message?: string }>('/portail/otp', corps, { silencieux: true }),
};
