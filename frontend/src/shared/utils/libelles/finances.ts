/** Paiements, paie des enseignants et recettes propres. */
import { traduireLibelles } from './traduire';

export const LIBELLE_STATUT_PAIEMENT: Record<string, string> = traduireLibelles('statut_paiement', {
  EN_ATTENTE: 'En attente',
  REUSSI: 'Payé',
  ECHOUE: 'Échoué',
  ANNULE: 'Annulé',
  REMBOURSE: 'Remboursé',
});

export const LIBELLE_MODE_PAIEMENT: Record<string, string> = traduireLibelles('mode_paiement', {
  MOBILE_MONEY: 'Mobile Money',
  ESPECES: 'Espèces',
  VIREMENT: 'Virement',
});

export const LIBELLE_OPERATEUR_MM: Record<string, string> = traduireLibelles('operateur_mm', {
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  TELECEL: 'Telecel',
  AUTRE: 'Autre',
});

export const LIBELLE_STATUT_PAIE: Record<string, string> = traduireLibelles('statut_paie', {
  BROUILLON: 'Brouillon',
  VALIDE: 'Validé',
  PAYE: 'Payé',
});

export const LIBELLE_TYPE_RECETTE: Record<string, string> = traduireLibelles('type_recette', {
  ANALYSE_LABO: 'Analyse laboratoire',
  LOCATION_AMPHI: "Location d'amphithéâtre",
  PRESTATION_FORMATION: 'Prestation de formation',
  PRESTATION_CONSEIL: 'Prestation de conseil',
  AUTRE: 'Autre',
});

/**
 * Recette propre : le registre ne connaît que deux états, dérivés de la
 * présence d'un paiement rattaché.
 */
export const LIBELLE_STATUT_RECETTE: Record<'ENCAISSE' | 'A_ENCAISSER', string> = traduireLibelles('statut_recette', {
  ENCAISSE: 'Encaissée',
  A_ENCAISSER: 'À encaisser',
});
