/** Bibliothèque, encadrement, plagiat et cours en VOD. */
import { traduireLibelles } from './traduire';
import type { StatutVOD, TypeRessourceVOD } from '../../types';

export const LIBELLE_TYPE_DOCUMENT: Record<string, string> = traduireLibelles('type_document', {
  MEMOIRE: 'Mémoire',
  THESE: 'Thèse',
  ARTICLE: 'Article',
  RAPPORT: 'Rapport',
  SUPPORT_COURS: 'Support de cours',
  ARCHIVE: 'Archive',
  AUTRE: 'Autre',
});

export const LIBELLE_TYPE_ENCADREMENT: Record<string, string> = traduireLibelles('type_encadrement', {
  STAGE: 'Stage',
  MEMOIRE: 'Mémoire',
  RAPPORT: 'Rapport',
});

export const LIBELLE_STATUT_ENCADREMENT: Record<string, string> = traduireLibelles('statut_encadrement', {
  PROPOSE: 'Proposé',
  VALIDE: 'Validé',
  EN_COURS: 'En cours',
  SOUTENU: 'Soutenu',
  ABANDONNE: 'Abandonné',
});

/** Arbitrage d'une suspicion de plagiat (liste, détail et carte le disaient chacun à sa façon). */
export const LIBELLE_STATUT_SUSPICION: Record<string, string> = traduireLibelles('statut_suspicion', {
  EN_ATTENTE: 'En attente',
  ACQUITTE: 'Acquittée',
  CONFIRME: 'Confirmée',
});

/**
 * Cours en VOD. Le catalogue et le formulaire d'édition proposaient chacun leur
 * liste de types : une seule sert désormais aux deux, statut compris.
 */
export const LIBELLE_TYPE_RESSOURCE_VOD: Record<TypeRessourceVOD, string> = traduireLibelles('type_ressource_vod', {
  AUDIO: 'Audio',
  VIDEO: 'Vidéo',
  NOTES: 'Notes',
  TRANSCRIPTION: 'Transcription',
});

export const LIBELLE_STATUT_VOD: Record<StatutVOD, string> = traduireLibelles('statut_vod', {
  BROUILLON: 'Brouillon',
  EN_LIGNE: 'En ligne',
  HORS_LIGNE: 'Hors ligne',
  ARCHIVE: 'Archivée',
});
