/** Scolarité : inscriptions, évaluations, délibérations, attestations, carte étudiante. */
import { traduireLibelles } from './traduire';
import type { StatutCarteEtudiante } from '../../types';

export const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2', 'DOCTORAT'];

export const LIBELLE_STATUT_INSCRIPTION: Record<string, string> = traduireLibelles('statut_inscription', {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  PAYEE: 'Frais payés',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
});

export const LIBELLE_TYPE_EVALUATION: Record<string, string> = traduireLibelles('type_evaluation', {
  CC: 'Contrôle continu',
  EXAMEN: 'Examen',
  RATTRAPAGE: 'Rattrapage',
  ORAL: 'Oral',
  TP: 'Travaux pratiques',
});

export const LIBELLE_STATUT_EVALUATION: Record<string, string> = traduireLibelles('statut_evaluation', {
  OUVERTE: 'Ouverte',
  CLOTUREE: 'Clôturée',
});

export const LIBELLE_SESSION_DELIBERATION: Record<string, string> = traduireLibelles('session_deliberation', {
  NORMALE: 'Session normale',
  RATTRAPAGE: 'Rattrapage',
});

export const LIBELLE_STATUT_DELIBERATION: Record<string, string> = traduireLibelles('statut_deliberation', {
  BROUILLON: 'Brouillon',
  VALIDEE: 'Validée',
  PROPOSE: 'Proposé',
  VALIDE: 'Validé (lecture seule)',
  SOUTENU: 'Soutenu (rattrapage validé)',
  ABANDONNE: 'Abandonné',
});

export const LIBELLE_DECISION_JURY: Record<string, string> = traduireLibelles('decision_jury', {
  ADMIS: 'Admis',
  AJOURNE: 'Ajourné',
  DEFAILLANT: 'Défaillant',
});

export const LIBELLE_TYPE_ATTESTATION: Record<string, string> = traduireLibelles('type_attestation', {
  SCOLARITE: 'Certificat de scolarité',
  SITUATION: 'Certificat de situation',
  REUSSITE: 'Attestation de réussite',
  DIPLOME: 'Attestation de diplôme',
  ASSIDUITE: 'Attestation d’assiduité',
});

export const LIBELLE_STATUT_ATTESTATION: Record<string, string> = traduireLibelles('statut_attestation', {
  EMISE: 'Émise',
  REVOQUEE: 'Révoquée',
});

/**
 * Carte étudiante. Volontairement distincte de `LIBELLE_STATUT_ATTESTATION`
 * même si les mots coïncident aujourd'hui : révoquer une carte et révoquer une
 * attestation sont deux gestes métier séparés, qui peuvent diverger demain.
 */
export const LIBELLE_STATUT_CARTE: Record<StatutCarteEtudiante, string> = traduireLibelles('statut_carte', {
  EMISE: 'Émise',
  REVOQUEE: 'Révoquée',
});
