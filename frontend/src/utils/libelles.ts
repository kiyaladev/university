/** Libellés et couleurs partagés par les écrans. */
import type { Role, StatutPresence, StatutSeance, TypeCours } from '../types';

export const LIBELLE_STATUT_PRESENCE: Record<StatutPresence | 'NON_CONTROLE', string> = {
  PRESENT: 'Présent',
  RETARD: 'Retard',
  ABSENT: 'Absent',
  DEPART_ANTICIPE: 'Départ anticipé',
  REMPLACE: 'Remplacé',
  EXCUSE: 'Absence excusée',
  NON_CONTROLE: 'Non contrôlé',
};

export const ICONE_STATUT_PRESENCE: Record<string, string> = {
  PRESENT: 'check_circle',
  RETARD: 'schedule',
  ABSENT: 'cancel',
  DEPART_ANTICIPE: 'logout',
  REMPLACE: 'swap_horiz',
  EXCUSE: 'assignment_turned_in',
  NON_CONTROLE: 'radio_button_unchecked',
};

export const LIBELLE_STATUT_SEANCE: Record<StatutSeance, string> = {
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  CONTROLEE: 'Contrôlée',
  ANNULEE: 'Annulée',
  NON_TENUE: 'Non tenue',
};

export const LIBELLE_ROLE: Record<Role, string> = {
  ADMIN: 'Administrateur',
  DIRECTION: 'Direction des études',
  SCOLARITE: 'Scolarité',
  CHEF_DEPARTEMENT: 'Chef de département',
  CONTROLEUR: 'Contrôleur',
  ENSEIGNANT: 'Enseignant',
  ETUDIANT: 'Étudiant',
};

export const LIBELLE_STATUT_INSCRIPTION: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  PAYEE: 'Frais payés',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

export const LIBELLE_STATUT_PAIEMENT: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  REUSSI: 'Payé',
  ECHOUE: 'Échoué',
  ANNULE: 'Annulé',
  REMBOURSE: 'Remboursé',
};

export const LIBELLE_MODE_PAIEMENT: Record<string, string> = {
  MOBILE_MONEY: 'Mobile Money',
  ESPECES: 'Espèces',
  VIREMENT: 'Virement',
};

export const LIBELLE_OPERATEUR_MM: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  TELECEL: 'Telecel',
  AUTRE: 'Autre',
};

export const LIBELLE_STATUT_PAIE: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDEE: 'Validée',
  PAYEE: 'Payée',
};

export const LIBELLE_TYPE_EVALUATION: Record<string, string> = {
  CC: 'Contrôle continu',
  EXAMEN: 'Examen',
  RATTRAPAGE: 'Rattrapage',
  ORAL: 'Oral',
  TP: 'Travaux pratiques',
};

export const LIBELLE_STATUT_EVALUATION: Record<string, string> = {
  OUVERTE: 'Ouverte',
  CLOTUREE: 'Clôturée',
};

export const LIBELLE_SESSION_DELIBERATION: Record<string, string> = {
  NORMALE: 'Session normale',
  RATTRAPAGE: 'Rattrapage',
};

export const LIBELLE_STATUT_DELIBERATION: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDEE: 'Validée',
};

export const LIBELLE_DECISION_JURY: Record<string, string> = {
  ADMIS: 'Admis',
  AJOURNE: 'Ajourné',
  DEFAILLANT: 'Défaillant',
};

export const LIBELLE_TYPE_ATTESTATION: Record<string, string> = {
  SCOLARITE: 'Certificat de scolarité',
  SITUATION: 'Certificat de situation',
  REUSSITE: 'Attestation de réussite',
  DIPLOME: 'Attestation de diplôme',
  ASSIDUITE: 'Attestation d’assiduité',
};

export const LIBELLE_STATUT_ATTESTATION: Record<string, string> = {
  EMISE: 'Émise',
  REVOQUEE: 'Révoquée',
};

export const LIBELLE_STATUT_NOTIFICATION: Record<string, string> = {
  EN_ATTENTE: 'En file',
  ENVOYEE: 'Envoyée',
  ECHOUE: 'Échouée',
};

// --- Modules Kankan ---

export const LIBELLE_CATEGORIE_CHAMBRE: Record<string, string> = {
  CHAMBRE_SIMPLE: 'Chambre simple',
  CHAMBRE_PARTAGEE: 'Chambre partagée',
  STUDIO: 'Studio',
  APPARTEMENT: 'Appartement',
};

export const LIBELLE_STATUT_CHAMBRE: Record<string, string> = {
  LIBRE: 'Libre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  MAINTENANCE: 'Maintenance',
};

export const LIBELLE_STATUT_ATTRIBUTION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  ACCORDEE: 'Accordée',
  REFUSEE: 'Refusée',
  RETIREE: 'Retirée',
};

export const LIBELLE_TYPE_DOCUMENT: Record<string, string> = {
  MEMOIRE: 'Mémoire',
  THESE: 'Thèse',
  ARTICLE: 'Article',
  RAPPORT: 'Rapport',
  SUPPORT_COURS: 'Support de cours',
  ARCHIVE: 'Archive',
  AUTRE: 'Autre',
};

export const LIBELLE_TYPE_REPAS: Record<string, string> = {
  PETIT_DEJEUNER: 'Petit déjeuner',
  DEJEUNER: 'Déjeuner',
  COLLATION: 'Collation',
  DINER: 'Dîner',
  AUTRE: 'Autre',
};

export const LIBELLE_STATUT_CONSOMMATION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

export const LIBELLE_STATUT_RESERVATION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export const LIBELLE_TYPE_ENCADREMENT: Record<string, string> = {
  STAGE: 'Stage',
  MEMOIRE: 'Mémoire',
  RAPPORT: 'Rapport',
};

export const LIBELLE_STATUT_ENCADREMENT: Record<string, string> = {
  PROPOSE: 'Proposé',
  VALIDE: 'Validé',
  EN_COURS: 'En cours',
  SOUTENU: 'Soutenu',
  ABANDONNE: 'Abandonné',
};

export const LIBELLE_CATEGORIE_INCIDENT: Record<string, string> = {
  VIDEO: 'Vidéo / projecteur',
  SON: 'Son / micro',
  RESEAU: 'Réseau / internet',
  ELECTRICITE: 'Électricité',
  MOBILIER: 'Mobilier',
  INFORMATIQUE: 'Informatique',
  CLIMATISATION: 'Climatisation',
  AUTRE: 'Autre',
};

export const LIBELLE_PRIORITE_TICKET: Record<string, string> = {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
};

export const LIBELLE_STATUT_TICKET: Record<string, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
};

export const LIBELLE_STATUT_FORMATION: Record<string, string> = {
  BROUILLON: 'Brouillon',
  PUBLIEE: 'Publiée',
  COMPLETE: 'Complète',
};

export const LIBELLE_STATUT_INSCRIPTION_FORMATION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
};

export const LIBELLE_ATTESTATION: Record<string, string> = {
  AUCUNE: 'Non attestée',
  SIGNATURE: 'Signature manuscrite',
  CODE_PIN: 'Code personnel',
  EMPREINTE: 'Empreinte digitale',
};

// --- Modules Courrier / Examens / Tirage / Recettes ---

export const LIBELLE_STATUT_COURRIER: Record<string, string> = {
  RECU: 'Reçu',
  ENREGISTRE: 'Enregistré',
  EN_CIRCUIT: 'En circuit',
  TRAITE: 'Traité',
  CLASSE: 'Classé',
  ARCHIVE: 'Archivé',
};

export const LIBELLE_TYPE_COURRIER: Record<string, string> = {
  ENTRANT: 'Entrant',
  SORTANT: 'Sortant',
};

export const LIBELLE_TYPE_EXAMEN: Record<string, string> = {
  PARTIEL: 'Partiel',
  FINAL: 'Examen final',
  RATTRAPAGE: 'Rattrapage',
  CONTROLE_CONTINU: 'Contrôle continu',
};

export const LIBELLE_STATUT_EXAMEN: Record<string, string> = {
  PLANIFIE: 'Planifié',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

export const LIBELLE_STADE_TIRAGE: Record<string, string> = {
  PROGRAMME: 'Programmé',
  IMPRIME: 'Imprimé',
  MIS_SOUS_PLI: 'Mis sous pli',
  DISTRIBUE: 'Distribué',
  RECUPERE: 'Récupéré',
  ANNULE: 'Annulé',
};

export const LIBELLE_TYPE_RECETTE: Record<string, string> = {
  ANALYSE_LABO: 'Analyse laboratoire',
  LOCATION_AMPHI: "Location d'amphithéâtre",
  PRESTATION_FORMATION: 'Prestation de formation',
  PRESTATION_CONSEIL: 'Prestation de conseil',
  AUTRE: 'Autre',
};

export const ICONE_ATTESTATION: Record<string, string> = {
  AUCUNE: 'help_outline',
  SIGNATURE: 'draw',
  CODE_PIN: 'dialpad',
  EMPREINTE: 'fingerprint',
};

/** Adresse de la passerelle biométrique locale (poste du contrôleur). */
export const CLE_PASSERELLE = 'unipresence_biometrie_url';
export const PASSERELLE_DEFAUT = 'http://127.0.0.1:5044';

export const urlPasserelle = () =>
  localStorage.getItem(CLE_PASSERELLE) || PASSERELLE_DEFAUT;

/**
 * Le poste a-t-il un lecteur déclaré ? Un navigateur en HTTPS refuse d'appeler
 * une adresse de bouclage tant que l'opérateur ne l'a pas configurée : on ne
 * sonde donc que si une adresse a été enregistrée sur cet appareil.
 */
export const passerelleConfiguree = () =>
  !!localStorage.getItem(CLE_PASSERELLE) || location.protocol === 'http:';

export const TYPES_COURS: TypeCours[] = ['CM', 'TD', 'TP', 'EXAMEN', 'CONFERENCE'];

export const LIBELLE_TYPE_COURS: Record<TypeCours, string> = {
  CM: 'Cours magistral',
  TD: 'Travaux dirigés',
  TP: 'Travaux pratiques',
  EXAMEN: 'Examen',
  CONFERENCE: 'Conférence',
};

export const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2', 'DOCTORAT'];

export const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const TYPES_JUSTIFICATIF = [
  { value: 'MALADIE', label: 'Maladie' },
  { value: 'MISSION', label: 'Mission' },
  { value: 'FORMATION', label: 'Formation' },
  { value: 'DEUIL', label: 'Deuil' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'AUTRE', label: 'Autre' },
];

export const STATUTS_ENSEIGNANT = ['PERMANENT', 'VACATAIRE', 'CONTRACTUEL'];

/** "1h45" à partir de minutes. */
export function dureeLisible(minutes?: number | null): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/** "12/08/2026" à partir d'une date ISO. */
export function dateLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('fr-FR');
}

export function dateHeureLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('fr-FR');
}

/** Date du jour au format YYYY-MM-DD (fuseau local). */
export function aujourdhui(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Décale une date ISO de n jours. */
export function decalerJours(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + jours);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Heure courante "HH:mm". */
export function maintenantHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function montantLisible(v?: number | null): string {
  return (v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

/** Nombre à la française : virgule décimale, espace insécable pour les milliers. */
export function nombreLisible(v?: number | null, decimales = 2): string {
  return (v ?? 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

/** « 85,3 h » plutôt que « 85.3 H ». */
export function heuresLisibles(v?: number | null): string {
  return `${nombreLisible(v, 1)} h`;
}

/** « 94,2 % ». */
export function pourcentLisible(v?: number | null): string {
  return `${nombreLisible(v, 1)} %`;
}
