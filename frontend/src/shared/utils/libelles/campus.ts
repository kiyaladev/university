/** Vie de campus : cités, restauration, salles, helpdesk, formations continues. */
import { traduireLibelles } from './traduire';

export const LIBELLE_CATEGORIE_CHAMBRE: Record<string, string> = traduireLibelles('categorie_chambre', {
  CHAMBRE_SIMPLE: 'Chambre simple',
  CHAMBRE_PARTAGEE: 'Chambre partagée',
  STUDIO: 'Studio',
  APPARTEMENT: 'Appartement',
});

export const LIBELLE_STATUT_CHAMBRE: Record<string, string> = traduireLibelles('statut_chambre', {
  LIBRE: 'Libre',
  RESERVE: 'Réservé',
  OCCUPE: 'Occupé',
  MAINTENANCE: 'Maintenance',
});

export const LIBELLE_STATUT_ATTRIBUTION: Record<string, string> = traduireLibelles('statut_attribution', {
  EN_ATTENTE: 'En attente',
  ACCORDE: 'Accordé',
  REFUSE: 'Refusé',
  RETIRE: 'Retiré',
});

export const LIBELLE_TYPE_REPAS: Record<string, string> = traduireLibelles('type_repas', {
  PETIT_DEJEUNER: 'Petit déjeuner',
  DEJEUNER: 'Déjeuner',
  COLLATION: 'Collation',
  DINER: 'Dîner',
  AUTRE: 'Autre',
});

export const LIBELLE_STATUT_CONSOMMATION: Record<string, string> = traduireLibelles('statut_consommation', {
  EN_ATTENTE: 'En attente',
  VALIDE: 'Validé',
  ANNULE: 'Annulé',
});

export const LIBELLE_STATUT_RESERVATION: Record<string, string> = traduireLibelles('statut_reservation', {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
});

export const LIBELLE_CATEGORIE_INCIDENT: Record<string, string> = traduireLibelles('categorie_incident', {
  VIDEO: 'Vidéo / projecteur',
  SON: 'Son / micro',
  RESEAU: 'Réseau / internet',
  ELECTRICITE: 'Électricité',
  MOBILIER: 'Mobilier',
  INFORMATIQUE: 'Informatique',
  CLIMATISATION: 'Climatisation',
  AUTRE: 'Autre',
});

export const LIBELLE_PRIORITE_TICKET: Record<string, string> = traduireLibelles('priorite_ticket', {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
});

export const LIBELLE_STATUT_TICKET: Record<string, string> = traduireLibelles('statut_ticket', {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
});

export const LIBELLE_STATUT_FORMATION: Record<string, string> = traduireLibelles('statut_formation', {
  BROUILLON: 'Brouillon',
  PUBLIE: 'Publié',
  COMPLET: 'Complet',
});

export const LIBELLE_STATUT_INSCRIPTION_FORMATION: Record<string, string> = traduireLibelles(
  'statut_inscription_formation',
  {
    EN_ATTENTE: 'En attente',
    CONFIRME: 'Confirmé',
    ANNULE: 'Annulé',
  },
);
