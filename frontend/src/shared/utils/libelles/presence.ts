/** Présences, séances et justificatifs d'absence. */
import { traduireLibelles } from './traduire';
import type { StatutPresence, StatutSeance, TypeCours } from '@/types';

export const LIBELLE_STATUT_PRESENCE: Record<StatutPresence | 'NON_CONTROLE', string> = traduireLibelles(
  'statut_presence',
  {
    PRESENT: 'Présent',
    RETARD: 'Retard',
    ABSENT: 'Absent',
    DEPART_ANTICIPE: 'Départ anticipé',
    REMPLACE: 'Remplacé',
    EXCUSE: 'Absence excusée',
    NON_CONTROLE: 'Non contrôlé',
  },
);

export const ICONE_STATUT_PRESENCE: Record<string, string> = {
  PRESENT: 'check_circle',
  RETARD: 'schedule',
  ABSENT: 'cancel',
  DEPART_ANTICIPE: 'logout',
  REMPLACE: 'swap_horiz',
  EXCUSE: 'assignment_turned_in',
  NON_CONTROLE: 'radio_button_unchecked',
};

export const LIBELLE_STATUT_SEANCE: Record<StatutSeance, string> = traduireLibelles('statut_seance', {
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  CONTROLEE: 'Contrôlée',
  ANNULEE: 'Annulée',
  NON_TENUE: 'Non tenue',
});

export const LIBELLE_ATTESTATION: Record<string, string> = traduireLibelles('attestation', {
  AUCUNE: 'Non attestée',
  SIGNATURE: 'Signature manuscrite',
  CODE_PIN: 'Code personnel',
  EMPREINTE: 'Empreinte digitale',
});

export const ICONE_ATTESTATION: Record<string, string> = {
  AUCUNE: 'help_outline',
  SIGNATURE: 'draw',
  CODE_PIN: 'dialpad',
  EMPREINTE: 'fingerprint',
};

export const TYPES_COURS: TypeCours[] = ['CM', 'TD', 'TP', 'EXAMEN', 'CONFERENCE'];

export const LIBELLE_TYPE_COURS: Record<TypeCours, string> = traduireLibelles('type_cours', {
  CM: 'Cours magistral',
  TD: 'Travaux dirigés',
  TP: 'Travaux pratiques',
  EXAMEN: 'Examen',
  CONFERENCE: 'Conférence',
});

export const LIBELLE_TYPE_JUSTIFICATIF: Record<string, string> = traduireLibelles('types_justificatif', {
  MALADIE: 'Maladie',
  MISSION: 'Mission',
  FORMATION: 'Formation',
  DEUIL: 'Deuil',
  TRANSPORT: 'Transport',
  AUTRE: 'Autre',
});

/** Options du sélecteur : le libellé est relu à chaque rendu pour suivre la langue. */
export const TYPES_JUSTIFICATIF = Object.keys(LIBELLE_TYPE_JUSTIFICATIF).map((value) => ({
  value,
  get label() {
    return LIBELLE_TYPE_JUSTIFICATIF[value];
  },
}));

/**
 * Arbitrage d'un justificatif d'absence. Dernier statut du domaine à vivre en
 * dur dans les écrans : il se dit maintenant d'une seule voix.
 */
export const LIBELLE_STATUT_JUSTIFICATIF: Record<string, string> = traduireLibelles('statut_justificatif', {
  EN_ATTENTE: 'En attente',
  VALIDE: 'Validé',
  REJETE: 'Rejeté',
});
