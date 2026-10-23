import { i18n, getAppLocale } from '../boot/i18n';

function traduireLibelles<T extends Record<string, string>>(namespace: string, valeurs: T): T {
  return Object.defineProperties({}, Object.fromEntries(Object.entries(valeurs).map(([cle, valeur]) => [cle, {
    enumerable: true, get: () => { const message = `libelles.${namespace}.${cle}`; return i18n.global.te(message) ? i18n.global.t(message) : valeur; },
  }]))) as T;
}

/** Libellés et couleurs partagés par les écrans. */
import type {
  PrioriteReclamation,
  Role,
  StatutCarteEtudiante,
  StatutDemande,
  StatutPresence,
  StatutReclamation,
  StatutSeance,
  StatutVOD,
  TypeCours,
  TypeDemandeDocument,
  TypeReclamation,
  TypeRessourceVOD,
} from '../types';

export const LIBELLE_STATUT_PRESENCE: Record<StatutPresence | 'NON_CONTROLE', string> = traduireLibelles('statut_presence', {
  PRESENT: 'Présent',
  RETARD: 'Retard',
  ABSENT: 'Absent',
  DEPART_ANTICIPE: 'Départ anticipé',
  REMPLACE: 'Remplacé',
  EXCUSE: 'Absence excusée',
  NON_CONTROLE: 'Non contrôlé',
});

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

export const LIBELLE_ROLE: Record<Role, string> = traduireLibelles('role', {
  ADMIN: 'Administrateur',
  DIRECTION: 'Direction des études',
  SCOLARITE: 'Scolarité',
  CHEF_DEPARTEMENT: 'Chef de département',
  CONTROLEUR: 'Contrôleur',
  ENSEIGNANT: 'Enseignant',
  ETUDIANT: 'Étudiant',
});

export const LIBELLE_STATUT_INSCRIPTION: Record<string, string> = traduireLibelles('statut_inscription', {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  PAYEE: 'Frais payés',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
});

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
  VALIDEE: 'Validée',
  PAYEE: 'Payée',
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

export const LIBELLE_STATUT_NOTIFICATION: Record<string, string> = traduireLibelles('statut_notification', {
  EN_ATTENTE: 'En file',
  ENVOYEE: 'Envoyée',
  ECHOUE: 'Échouée',
});

// --- Modules Kankan ---

export const LIBELLE_CATEGORIE_CHAMBRE: Record<string, string> = traduireLibelles('categorie_chambre', {
  CHAMBRE_SIMPLE: 'Chambre simple',
  CHAMBRE_PARTAGEE: 'Chambre partagée',
  STUDIO: 'Studio',
  APPARTEMENT: 'Appartement',
});

export const LIBELLE_STATUT_CHAMBRE: Record<string, string> = traduireLibelles('statut_chambre', {
  LIBRE: 'Libre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  MAINTENANCE: 'Maintenance',
});

export const LIBELLE_STATUT_ATTRIBUTION: Record<string, string> = traduireLibelles('statut_attribution', {
  EN_ATTENTE: 'En attente',
  ACCORDEE: 'Accordée',
  REFUSEE: 'Refusée',
  RETIREE: 'Retirée',
});

export const LIBELLE_TYPE_DOCUMENT: Record<string, string> = traduireLibelles('type_document', {
  MEMOIRE: 'Mémoire',
  THESE: 'Thèse',
  ARTICLE: 'Article',
  RAPPORT: 'Rapport',
  SUPPORT_COURS: 'Support de cours',
  ARCHIVE: 'Archive',
  AUTRE: 'Autre',
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
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
});

export const LIBELLE_STATUT_RESERVATION: Record<string, string> = traduireLibelles('statut_reservation', {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
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
  PUBLIEE: 'Publiée',
  COMPLETE: 'Complète',
});

export const LIBELLE_STATUT_INSCRIPTION_FORMATION: Record<string, string> = traduireLibelles('statut_inscription_formation', {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
});

export const LIBELLE_ATTESTATION: Record<string, string> = traduireLibelles('attestation', {
  AUCUNE: 'Non attestée',
  SIGNATURE: 'Signature manuscrite',
  CODE_PIN: 'Code personnel',
  EMPREINTE: 'Empreinte digitale',
});

// --- Modules Courrier / Examens / Tirage / Recettes ---

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

export const LIBELLE_TYPE_RECETTE: Record<string, string> = traduireLibelles('type_recette', {
  ANALYSE_LABO: 'Analyse laboratoire',
  LOCATION_AMPHI: "Location d'amphithéâtre",
  PRESTATION_FORMATION: 'Prestation de formation',
  PRESTATION_CONSEIL: 'Prestation de conseil',
  AUTRE: 'Autre',
});

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

export const LIBELLE_TYPE_COURS: Record<TypeCours, string> = traduireLibelles('type_cours', {
  CM: 'Cours magistral',
  TD: 'Travaux dirigés',
  TP: 'Travaux pratiques',
  EXAMEN: 'Examen',
  CONFERENCE: 'Conférence',
});

export const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2', 'DOCTORAT'];

/** Jours de la semaine, numérotés de 1 (lundi) à 7 (dimanche). */
export const JOURS: Record<number, string> = traduireLibelles('jours', {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
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

/**
 * Réclamations. Le même dossier se lit dans le registre de la scolarité, dans
 * « Mes réclamations » côté étudiant, dans le formulaire de dépôt et dans le
 * dialogue de détail : les quatre écrans doivent nommer un statut, un motif et
 * une priorité de la même façon, sinon l'étudiant et l'agent ne parlent plus du
 * même dossier.
 */
export const LIBELLE_STATUT_RECLAMATION: Record<StatutReclamation, string> = traduireLibelles('statut_reclamation', {
  OUVERTE: 'Ouverte',
  EN_COURS: 'En cours',
  EN_ATTENTE_REPONSE: 'Attente réponse',
  RESOLUE: 'Résolue',
  FERMEE: 'Fermée',
  REJETEE: 'Rejetée',
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
export const LIBELLE_PRIORITE_RECLAMATION: Record<PrioriteReclamation, string> = traduireLibelles('priorite_reclamation', {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
});

/**
 * Demandes de documents. Une même demande s'affiche au guichet de la scolarité,
 * dans le suivi de l'étudiant, dans le formulaire de dépôt et dans la grille
 * tarifaire : un seul jeu de mots pour le statut et pour le type de document.
 */
export const LIBELLE_STATUT_DEMANDE: Record<StatutDemande, string> = traduireLibelles('statut_demande', {
  EN_ATTENTE_PAIEMENT: 'Attente paiement',
  PAYEE: 'Payée',
  EN_TRAITEMENT: 'En traitement',
  PRETE: 'Prête',
  REMISE: 'Remise',
  REJETEE: 'Rejetée',
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

/**
 * Carte étudiante. Volontairement distincte de `LIBELLE_STATUT_ATTESTATION`
 * même si les mots coïncident aujourd'hui : révoquer une carte et révoquer une
 * attestation sont deux gestes métier séparés, qui peuvent diverger demain.
 */
export const LIBELLE_STATUT_CARTE: Record<StatutCarteEtudiante, string> = traduireLibelles('statut_carte', {
  EMISE: 'Émise',
  REVOQUEE: 'Révoquée',
});

/** Classes de pastille de la carte : le registre et « Ma carte » se colorent pareil. */
export const CLASSE_STATUT_CARTE: Record<StatutCarteEtudiante, string> = {
  EMISE: 'badge--ok',
  REVOQUEE: 'badge--ko',
};

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

/** Options prêtes pour un `q-select` (`emit-value` / `map-options`). */
export function optionsDepuis(libelles: Record<string, string>) {
  return Object.entries(libelles).map(([value, label]) => ({ value, label }));
}

/** Arbitrage d'une suspicion de plagiat (liste, détail et carte le disaient chacun à sa façon). */
export const LIBELLE_STATUT_SUSPICION: Record<string, string> = traduireLibelles('statut_suspicion', {
  EN_ATTENTE: 'En attente',
  ACQUITTE: 'Acquittée',
  CONFIRME: 'Confirmée',
});

export const STATUTS_ENSEIGNANT = ['PERMANENT', 'VACATAIRE', 'CONTRACTUEL'];

export const LIBELLE_STATUT_ENSEIGNANT: Record<string, string> = traduireLibelles('statut_enseignant', {
  PERMANENT: 'Permanent',
  VACATAIRE: 'Vacataire',
  CONTRACTUEL: 'Contractuel',
});

/**
 * Arbitrage d'un justificatif d'absence. Dernier statut du domaine à vivre en
 * dur dans les écrans : il se dit maintenant d'une seule voix.
 */
export const LIBELLE_STATUT_JUSTIFICATIF: Record<string, string> = traduireLibelles('statut_justificatif', {
  EN_ATTENTE: 'En attente',
  VALIDE: 'Validé',
  REJETE: 'Rejeté',
});

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
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(getAppLocale());
}

export function dateHeureLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(getAppLocale());
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
  return (v ?? 0).toLocaleString(getAppLocale(), { maximumFractionDigits: 0 });
}

/** Nombre à la française : virgule décimale, espace insécable pour les milliers. */
export function nombreLisible(v?: number | null, decimales = 2): string {
  return (v ?? 0).toLocaleString(getAppLocale(), {
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
