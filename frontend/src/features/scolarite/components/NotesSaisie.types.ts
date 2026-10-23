import type { LigneEvaluation } from '../services/evaluations';

/**
 * Une ligne du tableur de saisie : l'inscrit, la note saisie et les valeurs
 * d'origine reçues du serveur (pour savoir ce qui a bougé).
 */
export interface LigneSaisie extends LigneEvaluation {
  inscriptionId: string;
  note: number | null;
  present: boolean;
  /** Note brute venant du serveur (null si jamais saisie) */
  noteOriginale: number | null;
  /** Présence telle que reçue du serveur : marquer un absent est une modification. */
  presentOriginal: boolean;
}
