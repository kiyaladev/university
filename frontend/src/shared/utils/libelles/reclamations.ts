/** Réclamations et demandes de documents. */
import { traduireLibelles } from './traduire';
import type {
  PrioriteReclamation,
  StatutDemande,
  StatutReclamation,
  TypeDemandeDocument,
  TypeReclamation,
} from '@/types';

/**
 * Réclamations. Le même dossier se lit dans le registre de la scolarité, dans
 * « Mes réclamations » côté étudiant, dans le formulaire de dépôt et dans le
 * dialogue de détail : les quatre écrans doivent nommer un statut, un motif et
 * une priorité de la même façon, sinon l'étudiant et l'agent ne parlent plus du
 * même dossier.
 */
export const LIBELLE_STATUT_RECLAMATION: Record<StatutReclamation, string> = traduireLibelles('statut_reclamation', {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  EN_ATTENTE_REPONSE: 'Attente réponse',
  RESOLU: 'Résolu',
  FERME: 'Fermé',
  REJETE: 'Rejeté',
});

export const LIBELLE_TYPE_RECLAMATION: Record<TypeReclamation, string> = traduireLibelles('type_reclamation', {
  NOTE_MANQUANTE: 'Note manquante',
  ERREUR_SAISIE: 'Erreur de saisie',
  INSCRIPTION: 'Inscription',
  ENSEIGNEMENT: 'Enseignement',
  SCOLARITE: 'Scolarité',
  TECHNIQUE: 'Technique',
  AUTRE: 'Autre',
});

/** Priorité propre aux réclamations : elle monte jusqu'à « Urgente », contrairement aux tickets helpdesk. */
export const LIBELLE_PRIORITE_RECLAMATION: Record<PrioriteReclamation, string> = traduireLibelles(
  'priorite_reclamation',
  {
    BASSE: 'Basse',
    NORMALE: 'Normale',
    HAUTE: 'Haute',
    URGENTE: 'Urgente',
  },
);

/**
 * Demandes de documents. Une même demande s'affiche au guichet de la scolarité,
 * dans le suivi de l'étudiant, dans le formulaire de dépôt et dans la grille
 * tarifaire : un seul jeu de mots pour le statut et pour le type de document.
 */
export const LIBELLE_STATUT_DEMANDE: Record<StatutDemande, string> = traduireLibelles('statut_demande', {
  EN_ATTENTE_PAIEMENT: 'Attente paiement',
  PAYE: 'Payé',
  EN_TRAITEMENT: 'En traitement',
  PRET: 'Prêt',
  REMISE: 'Remise',
  REJETE: 'Rejeté',
});

export const LIBELLE_TYPE_DEMANDE: Record<TypeDemandeDocument, string> = traduireLibelles('type_demande', {
  ATTESTATION_SCOLARITE: 'Attestation de scolarité',
  ATTESTATION_FREQUENTATION: 'Attestation de fréquentation',
  RELEVE_NOTES: 'Relevé de notes',
  DUPLICATA_CARTE: 'Duplicata de carte',
  ATTESTATION_REUSSITE: 'Attestation de réussite',
  CERTIFICAT_SCOLARITE: 'Certificat de scolarité',
  AUTRE: 'Autre',
});
