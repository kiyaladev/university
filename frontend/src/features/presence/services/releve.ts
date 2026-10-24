import { creerBlob } from '@/shared/services/http';

/**
 * Relevé hebdomadaire du chef de département (`/impression/releve-hebdomadaire`).
 *
 * Le serveur renvoie un PDF : la réponse n'est pas du JSON, et la lecture
 * passe par `creerBlob`, qui demande le type `blob` à l'API.
 */

/** Corps de la demande de relevé. */
export interface ReleveHebdomadaire {
  departementId?: string | null;
  dateDebut: string;
  dateFin: string;
  /** Signature du chef de département, encodée en base64. */
  signatureBase64?: string | null;
}

/**
 * Demande le relevé hebdomadaire et renvoie le PDF.
 *
 * L'appel est silencieux : la signature peut être refusée par le serveur, et
 * l'écran affiche alors le motif dans son propre bandeau.
 */
export async function telechargerReleveHebdomadaire(corps: ReleveHebdomadaire): Promise<Blob> {
  return creerBlob('/impression/releve-hebdomadaire', corps, { silencieux: true });
}

/** Nom du fichier téléchargé, daté du début de la semaine. */
export function nomFichierReleve(dateDebut: string): string {
  return `releve-hebdomadaire-${dateDebut}.pdf`;
}
