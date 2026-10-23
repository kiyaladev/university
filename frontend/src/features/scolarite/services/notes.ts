/** Notes : consultation du registre d'une épreuve et saisie en masse. */

import { lire, modifier } from '@/shared/services/http';
import type { ResultatSaisie, ReponseNotesEvaluation, SaisieNotes } from './evaluations';

export const notesService = {
  /** Registre des notes d'une évaluation : l'épreuve et ses lignes de saisie. */
  evaluation(evaluationId: string) {
    return lire<ReponseNotesEvaluation>(`/notes/evaluation/${evaluationId}`);
  },

  /** Enregistre les notes saisies. */
  saisie(payload: SaisieNotes) {
    return modifier<ResultatSaisie>('/notes/saisie', payload);
  },
};
