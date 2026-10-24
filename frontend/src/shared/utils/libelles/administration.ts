/** Administration : notifications, courrier, examens, tirage, badges, élections. */
import { traduireLibelles } from './traduire';
import type { StatutElection } from '@/types';

export const LIBELLE_STATUT_NOTIFICATION: Record<string, string> = traduireLibelles('statut_notification', {
  EN_ATTENTE: 'En file',
  ENVOYE: 'Envoyé',
  ECHOUE: 'Échoué',
});

export const LIBELLE_STATUT_COURRIER: Record<string, string> = traduireLibelles('statut_courrier', {
  RECU: 'Reçu',
  ENREGISTRE: 'Enregistré',
  EN_CIRCUIT: 'En circuit',
  TRAITE: 'Traité',
  CLASSE: 'Classé',
  ARCHIVE: 'Archivé',
});

export const LIBELLE_TYPE_COURRIER: Record<string, string> = traduireLibelles('type_courrier', {
  ENTRANT: 'Entrant',
  SORTANT: 'Sortant',
});

export const LIBELLE_TYPE_EXAMEN: Record<string, string> = traduireLibelles('type_examen', {
  PARTIEL: 'Partiel',
  FINAL: 'Examen final',
  RATTRAPAGE: 'Rattrapage',
  CONTROLE_CONTINU: 'Contrôle continu',
});

export const LIBELLE_STATUT_EXAMEN: Record<string, string> = traduireLibelles('statut_examen', {
  PLANIFIE: 'Planifié',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
});

export const LIBELLE_STADE_TIRAGE: Record<string, string> = traduireLibelles('stade_tirage', {
  PROGRAMME: 'Programmé',
  IMPRIME: 'Imprimé',
  MIS_SOUS_PLI: 'Mis sous pli',
  DISTRIBUE: 'Distribué',
  RECUPERE: 'Récupéré',
  ANNULE: 'Annulé',
});

/**
 * Badges d'accès. Le même badge se nomme dans le registre, dans le formulaire
 * d'émission et sur la page publique de vérification : un seul jeu de mots.
 */
export const LIBELLE_TYPE_BADGE: Record<string, string> = traduireLibelles('type_badge', {
  VISITEUR: 'Visiteur',
  INTERVENANT: 'Intervenant',
  TECHNICIEN: 'Technicien',
  VIP: 'Personnalité',
});

export const LIBELLE_STATUT_BADGE: Record<string, string> = traduireLibelles('statut_badge', {
  ACTIF: 'Actif',
  EXPIRE: 'Expiré',
  ANNULE: 'Annulé',
});

/** Élections : la page de gestion et la page de vote nomment un scrutin pareil. */
export const LIBELLE_STATUT_ELECTION: Record<StatutElection, string> = traduireLibelles('statut_election', {
  BROUILLON: 'Brouillon',
  OUVERT: 'Ouvert',
  CLOS: 'Clos',
  PROCLAME: 'Proclamé',
  ANNULE: 'Annulé',
});
