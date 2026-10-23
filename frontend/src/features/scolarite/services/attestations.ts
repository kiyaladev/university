/** Attestations : émission, révocation et journal des vérifications. */

import { creer, lire, lister, type ParametresListe } from '@/shared/services/http';
import type { Attestation } from '@/types';

/** Une vérification de QR d'attestation (journal des scans). */
export interface VerificationAttestation {
  id: string;
  attestationId: string;
  ip?: string | null;
  resultat: boolean;
  verifieeLe: string;
}

export const attestationsService = {
  /** Liste paginée des attestations. */
  liste(params: ParametresListe = {}) {
    return lister<Attestation>('/attestations', params);
  },

  /** Émet une attestation. */
  creer(payload: unknown) {
    return creer<Attestation>('/attestations', payload);
  },

  /** Révoque une attestation (motif obligatoire côté API). */
  revoquer(id: string, motifRevocation: string) {
    return creer<Attestation>(`/attestations/${id}/revoquer`, { motifRevocation });
  },

  /** Journal des vérifications de l'attestation. */
  verifications(id: string) {
    return lire<VerificationAttestation[]>(`/attestations/${id}/verifications`);
  },
};
