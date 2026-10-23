/**
 * FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.
 *
 * Source : backend/prisma/schema.prisma (enums Prisma)
 * Régénération : bun run types:generer
 * Vérification : bun run types:verifier
 *
 * Les interfaces de données ne sont pas générées : une réponse de l'API n'est
 * pas un modèle Prisma (champs inclus, champs omis, Decimal converti).
 */

export const Role = {
  // administrateur système
  ADMIN: 'ADMIN',
  // direction des études / vice-doyen : lecture globale + validation
  DIRECTION: 'DIRECTION',
  // service de scolarité : planification, référentiels
  SCOLARITE: 'SCOLARITE',
  // pilote son département
  CHEF_DEPARTEMENT: 'CHEF_DEPARTEMENT',
  // agent qui passe dans les salles
  CONTROLEUR: 'CONTROLEUR',
  // consultation seule : ses séances et son relevé, rien d'autre
  ENSEIGNANT: 'ENSEIGNANT',
  // portail étudiant : inscription, paiements, notes, attestations
  ETUDIANT: 'ETUDIANT',
} as const;

/** Union des valeurs de l'enum `Role`. */
export type Role = (typeof Role)[keyof typeof Role];

export const StatutEnseignant = {
  PERMANENT: 'PERMANENT',
  VACATAIRE: 'VACATAIRE',
  CONTRACTUEL: 'CONTRACTUEL',
} as const;

/** Union des valeurs de l'enum `StatutEnseignant`. */
export type StatutEnseignant = (typeof StatutEnseignant)[keyof typeof StatutEnseignant];

export const TypeCours = {
  // cours magistral
  CM: 'CM',
  // travaux dirigés
  TD: 'TD',
  // travaux pratiques
  TP: 'TP',
  EXAMEN: 'EXAMEN',
  CONFERENCE: 'CONFERENCE',
} as const;

/** Union des valeurs de l'enum `TypeCours`. */
export type TypeCours = (typeof TypeCours)[keyof typeof TypeCours];

export const StatutSeance = {
  PLANIFIE: 'PLANIFIE',
  EN_COURS: 'EN_COURS',
  CONTROLE: 'CONTROLE',
  ANNULE: 'ANNULE',
  NON_TENUE: 'NON_TENUE',
} as const;

/** Union des valeurs de l'enum `StatutSeance`. */
export type StatutSeance = (typeof StatutSeance)[keyof typeof StatutSeance];

export const StatutPresence = {
  PRESENT: 'PRESENT',
  RETARD: 'RETARD',
  ABSENT: 'ABSENT',
  DEPART_ANTICIPE: 'DEPART_ANTICIPE',
  REMPLACE: 'REMPLACE',
  EXCUSE: 'EXCUSE',
} as const;

/** Union des valeurs de l'enum `StatutPresence`. */
export type StatutPresence = (typeof StatutPresence)[keyof typeof StatutPresence];

/** Comment le CONTRÔLEUR prouve son passage en salle. */
export const MethodeVerification = {
  // saisie du contrôleur
  MANUEL: 'MANUEL',
  // scan du QR affiché dans la salle
  QR_SALLE: 'QR_SALLE',
  GEOLOCALISATION: 'GEOLOCALISATION',
  // signature manuscrite de l'enseignant sur l'écran
  SIGNATURE: 'SIGNATURE',
} as const;

/** Union des valeurs de l'enum `MethodeVerification`. */
export type MethodeVerification = (typeof MethodeVerification)[keyof typeof MethodeVerification];

/**
 * Comment l'enseignant atteste sa présence DEVANT le contrôleur, sur l'appareil
 * de celui-ci. L'enseignant n'atteste jamais seul ni à distance.
 */
export const AttestationMode = {
  AUCUNE: 'AUCUNE',
  // signature manuscrite sur l'écran du contrôleur
  SIGNATURE: 'SIGNATURE',
  // code personnel saisi sur l'écran du contrôleur
  CODE_PIN: 'CODE_PIN',
  // lecteur d'empreintes branché au poste de contrôle
  EMPREINTE: 'EMPREINTE',
} as const;

/** Union des valeurs de l'enum `AttestationMode`. */
export type AttestationMode = (typeof AttestationMode)[keyof typeof AttestationMode];

export const TypeJustificatif = {
  MALADIE: 'MALADIE',
  MISSION: 'MISSION',
  FORMATION: 'FORMATION',
  DEUIL: 'DEUIL',
  TRANSPORT: 'TRANSPORT',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `TypeJustificatif`. */
export type TypeJustificatif = (typeof TypeJustificatif)[keyof typeof TypeJustificatif];

export const StatutJustificatif = {
  EN_ATTENTE: 'EN_ATTENTE',
  VALIDE: 'VALIDE',
  REJETE: 'REJETE',
} as const;

/** Union des valeurs de l'enum `StatutJustificatif`. */
export type StatutJustificatif = (typeof StatutJustificatif)[keyof typeof StatutJustificatif];

export const Niveau = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  M1: 'M1',
  M2: 'M2',
  DOCTORAT: 'DOCTORAT',
} as const;

/** Union des valeurs de l'enum `Niveau`. */
export type Niveau = (typeof Niveau)[keyof typeof Niveau];

/** Cycle de vie d'une inscription (en ligne ou au guichet). */
export const StatutInscription = {
  // dossier ouvert, non rendu
  BROUILLON: 'BROUILLON',
  // dossier rendu, frais non réglés
  EN_ATTENTE_PAIEMENT: 'EN_ATTENTE_PAIEMENT',
  // frais réglés, pas encore validée par la scolarité
  PAYE: 'PAYE',
  // scolarité : dossier complet (frais + pièces)
  VALIDE: 'VALIDE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutInscription`. */
export type StatutInscription = (typeof StatutInscription)[keyof typeof StatutInscription];

/** État d'une transaction de paiement (Mobile Money ou autre). */
export const StatutPaiement = {
  EN_ATTENTE: 'EN_ATTENTE',
  REUSSI: 'REUSSI',
  ECHOUE: 'ECHOUE',
  ANNULE: 'ANNULE',
  REMBOURSE: 'REMBOURSE',
} as const;

/** Union des valeurs de l'enum `StatutPaiement`. */
export type StatutPaiement = (typeof StatutPaiement)[keyof typeof StatutPaiement];

export const ModePaiement = {
  // Orange Money / MTN MoMo / Telecel…
  MOBILE_MONEY: 'MOBILE_MONEY',
  // guichet
  ESPECES: 'ESPECES',
  // banque
  VIREMENT: 'VIREMENT',
} as const;

/** Union des valeurs de l'enum `ModePaiement`. */
export type ModePaiement = (typeof ModePaiement)[keyof typeof ModePaiement];

/** Cycle de vie d'une feuille de paie vacataires. */
export const StatutPaie = {
  // calculée, non figée
  BROUILLON: 'BROUILLON',
  // validée par la direction, les montants sont figés
  VALIDE: 'VALIDE',
  // mandat exécuté
  PAYE: 'PAYE',
} as const;

/** Union des valeurs de l'enum `StatutPaie`. */
export type StatutPaie = (typeof StatutPaie)[keyof typeof StatutPaie];

export const TypeEvaluation = {
  // contrôle continu
  CC: 'CC',
  // épreuve de session
  EXAMEN: 'EXAMEN',
  RATTRAPAGE: 'RATTRAPAGE',
  ORAL: 'ORAL',
  // travaux pratiques notés
  TP: 'TP',
} as const;

/** Union des valeurs de l'enum `TypeEvaluation`. */
export type TypeEvaluation = (typeof TypeEvaluation)[keyof typeof TypeEvaluation];

export const StatutEvaluation = {
  // saisie des notes possible
  OUVERT: 'OUVERT',
  // notes publiées, plus de modification
  CLOTURE: 'CLOTURE',
} as const;

/** Union des valeurs de l'enum `StatutEvaluation`. */
export type StatutEvaluation = (typeof StatutEvaluation)[keyof typeof StatutEvaluation];

export const SessionDeliberation = {
  // première session
  NORMALE: 'NORMALE',
  // session de rattrapage
  RATTRAPAGE: 'RATTRAPAGE',
} as const;

/** Union des valeurs de l'enum `SessionDeliberation`. */
export type SessionDeliberation = (typeof SessionDeliberation)[keyof typeof SessionDeliberation];

export const StatutDeliberation = {
  BROUILLON: 'BROUILLON',
  VALIDE: 'VALIDE',
} as const;

/** Union des valeurs de l'enum `StatutDeliberation`. */
export type StatutDeliberation = (typeof StatutDeliberation)[keyof typeof StatutDeliberation];

export const DecisionJury = {
  ADMIS: 'ADMIS',
  AJOURNE: 'AJOURNE',
  DEFAILLANT: 'DEFAILLANT',
} as const;

/** Union des valeurs de l'enum `DecisionJury`. */
export type DecisionJury = (typeof DecisionJury)[keyof typeof DecisionJury];

export const TypeAttestation = {
  // certificat de scolarité
  SCOLARITE: 'SCOLARITE',
  // certificat de situation
  SITUATION: 'SITUATION',
  // attestation de réussite / d'admission
  REUSSITE: 'REUSSITE',
  // attestation de diplôme (en attendant le parchemin)
  DIPLOME: 'DIPLOME',
  // attestation d'assiduité
  ASSIDUITE: 'ASSIDUITE',
} as const;

/** Union des valeurs de l'enum `TypeAttestation`. */
export type TypeAttestation = (typeof TypeAttestation)[keyof typeof TypeAttestation];

export const StatutAttestation = {
  EMIS: 'EMIS',
  // attestation invalidée (erreur, fraude…)
  REVOQUE: 'REVOQUE',
} as const;

/** Union des valeurs de l'enum `StatutAttestation`. */
export type StatutAttestation = (typeof StatutAttestation)[keyof typeof StatutAttestation];

export const StatutNotification = {
  // en file d'envoi SMS
  EN_ATTENTE: 'EN_ATTENTE',
  ENVOYE: 'ENVOYE',
  ECHOUE: 'ECHOUE',
} as const;

/** Union des valeurs de l'enum `StatutNotification`. */
export type StatutNotification = (typeof StatutNotification)[keyof typeof StatutNotification];

export const CategorieChambre = {
  CHAMBRE_SIMPLE: 'CHAMBRE_SIMPLE',
  CHAMBRE_PARTAGEE: 'CHAMBRE_PARTAGEE',
  STUDIO: 'STUDIO',
  APPARTEMENT: 'APPARTEMENT',
} as const;

/** Union des valeurs de l'enum `CategorieChambre`. */
export type CategorieChambre = (typeof CategorieChambre)[keyof typeof CategorieChambre];

export const StatutChambre = {
  LIBRE: 'LIBRE',
  RESERVE: 'RESERVE',
  OCCUPE: 'OCCUPE',
  MAINTENANCE: 'MAINTENANCE',
} as const;

/** Union des valeurs de l'enum `StatutChambre`. */
export type StatutChambre = (typeof StatutChambre)[keyof typeof StatutChambre];

export const StatutAttributionLogement = {
  EN_ATTENTE: 'EN_ATTENTE',
  ACCORDE: 'ACCORDE',
  REFUSE: 'REFUSE',
  RETIRE: 'RETIRE',
} as const;

/** Union des valeurs de l'enum `StatutAttributionLogement`. */
export type StatutAttributionLogement = (typeof StatutAttributionLogement)[keyof typeof StatutAttributionLogement];

export const TypeDocument = {
  MEMOIRE: 'MEMOIRE',
  THESE: 'THESE',
  ARTICLE: 'ARTICLE',
  RAPPORT: 'RAPPORT',
  SUPPORT_COURS: 'SUPPORT_COURS',
  ARCHIVE: 'ARCHIVE',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `TypeDocument`. */
export type TypeDocument = (typeof TypeDocument)[keyof typeof TypeDocument];

export const TypeRepas = {
  PETIT_DEJEUNER: 'PETIT_DEJEUNER',
  DEJEUNER: 'DEJEUNER',
  COLLATION: 'COLLATION',
  DINER: 'DINER',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `TypeRepas`. */
export type TypeRepas = (typeof TypeRepas)[keyof typeof TypeRepas];

export const StatutConsommation = {
  EN_ATTENTE: 'EN_ATTENTE',
  VALIDE: 'VALIDE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutConsommation`. */
export type StatutConsommation = (typeof StatutConsommation)[keyof typeof StatutConsommation];

export const StatutReservationSalle = {
  EN_ATTENTE: 'EN_ATTENTE',
  CONFIRME: 'CONFIRME',
  REFUSE: 'REFUSE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutReservationSalle`. */
export type StatutReservationSalle = (typeof StatutReservationSalle)[keyof typeof StatutReservationSalle];

export const TypeEncadrement = {
  STAGE: 'STAGE',
  MEMOIRE: 'MEMOIRE',
  RAPPORT: 'RAPPORT',
} as const;

/** Union des valeurs de l'enum `TypeEncadrement`. */
export type TypeEncadrement = (typeof TypeEncadrement)[keyof typeof TypeEncadrement];

export const StatutEncadrement = {
  PROPOSE: 'PROPOSE',
  VALIDE: 'VALIDE',
  EN_COURS: 'EN_COURS',
  SOUTENU: 'SOUTENU',
  ABANDONNE: 'ABANDONNE',
} as const;

/** Union des valeurs de l'enum `StatutEncadrement`. */
export type StatutEncadrement = (typeof StatutEncadrement)[keyof typeof StatutEncadrement];

export const CategorieIncident = {
  VIDEO: 'VIDEO',
  SON: 'SON',
  RESEAU: 'RESEAU',
  ELECTRICITE: 'ELECTRICITE',
  MOBILIER: 'MOBILIER',
  INFORMATIQUE: 'INFORMATIQUE',
  CLIMATISATION: 'CLIMATISATION',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `CategorieIncident`. */
export type CategorieIncident = (typeof CategorieIncident)[keyof typeof CategorieIncident];

export const PrioriteTicket = {
  BASSE: 'BASSE',
  NORMALE: 'NORMALE',
  HAUTE: 'HAUTE',
} as const;

/** Union des valeurs de l'enum `PrioriteTicket`. */
export type PrioriteTicket = (typeof PrioriteTicket)[keyof typeof PrioriteTicket];

export const StatutTicket = {
  OUVERT: 'OUVERT',
  EN_COURS: 'EN_COURS',
  RESOLU: 'RESOLU',
  CLOTURE: 'CLOTURE',
} as const;

/** Union des valeurs de l'enum `StatutTicket`. */
export type StatutTicket = (typeof StatutTicket)[keyof typeof StatutTicket];

export const StatutFormation = {
  BROUILLON: 'BROUILLON',
  PUBLIE: 'PUBLIE',
  COMPLET: 'COMPLET',
} as const;

/** Union des valeurs de l'enum `StatutFormation`. */
export type StatutFormation = (typeof StatutFormation)[keyof typeof StatutFormation];

export const StatutInscriptionFormation = {
  EN_ATTENTE: 'EN_ATTENTE',
  CONFIRME: 'CONFIRME',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutInscriptionFormation`. */
export type StatutInscriptionFormation = (typeof StatutInscriptionFormation)[keyof typeof StatutInscriptionFormation];

export const StatutSuspicionPlagiat = {
  EN_ATTENTE: 'EN_ATTENTE',
  ACQUITTE: 'ACQUITTE',
  CONFIRME: 'CONFIRME',
} as const;

/** Union des valeurs de l'enum `StatutSuspicionPlagiat`. */
export type StatutSuspicionPlagiat = (typeof StatutSuspicionPlagiat)[keyof typeof StatutSuspicionPlagiat];

export const StatutReparation = {
  DECLARE: 'DECLARE',
  EN_COURS: 'EN_COURS',
  TERMINE: 'TERMINE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutReparation`. */
export type StatutReparation = (typeof StatutReparation)[keyof typeof StatutReparation];

export const TypeCourrier = {
  ENTRANT: 'ENTRANT',
  SORTANT: 'SORTANT',
} as const;

/** Union des valeurs de l'enum `TypeCourrier`. */
export type TypeCourrier = (typeof TypeCourrier)[keyof typeof TypeCourrier];

export const StatutCourrier = {
  RECU: 'RECU',
  ENREGISTRE: 'ENREGISTRE',
  EN_CIRCUIT: 'EN_CIRCUIT',
  TRAITE: 'TRAITE',
  CLASSE: 'CLASSE',
  ARCHIVE: 'ARCHIVE',
} as const;

/** Union des valeurs de l'enum `StatutCourrier`. */
export type StatutCourrier = (typeof StatutCourrier)[keyof typeof StatutCourrier];

export const TypeExamen = {
  PARTIEL: 'PARTIEL',
  FINAL: 'FINAL',
  RATTRAPAGE: 'RATTRAPAGE',
  CONTROLE_CONTINU: 'CONTROLE_CONTINU',
} as const;

/** Union des valeurs de l'enum `TypeExamen`. */
export type TypeExamen = (typeof TypeExamen)[keyof typeof TypeExamen];

export const StatutExamen = {
  PLANIFIE: 'PLANIFIE',
  EN_COURS: 'EN_COURS',
  TERMINE: 'TERMINE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutExamen`. */
export type StatutExamen = (typeof StatutExamen)[keyof typeof StatutExamen];

export const StadeTirage = {
  PROGRAMME: 'PROGRAMME',
  IMPRIME: 'IMPRIME',
  MIS_SOUS_PLI: 'MIS_SOUS_PLI',
  DISTRIBUE: 'DISTRIBUE',
  RECUPERE: 'RECUPERE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StadeTirage`. */
export type StadeTirage = (typeof StadeTirage)[keyof typeof StadeTirage];

export const TypeRecette = {
  ANALYSE_LABO: 'ANALYSE_LABO',
  LOCATION_AMPHI: 'LOCATION_AMPHI',
  PRESTATION_FORMATION: 'PRESTATION_FORMATION',
  PRESTATION_CONSEIL: 'PRESTATION_CONSEIL',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `TypeRecette`. */
export type TypeRecette = (typeof TypeRecette)[keyof typeof TypeRecette];

export const TypeReclamation = {
  NOTE_MANQUANTE: 'NOTE_MANQUANTE',
  ERREUR_SAISIE: 'ERREUR_SAISIE',
  INSCRIPTION: 'INSCRIPTION',
  ENSEIGNEMENT: 'ENSEIGNEMENT',
  SCOLARITE: 'SCOLARITE',
  TECHNIQUE: 'TECHNIQUE',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `TypeReclamation`. */
export type TypeReclamation = (typeof TypeReclamation)[keyof typeof TypeReclamation];

export const PrioriteReclamation = {
  BASSE: 'BASSE',
  NORMALE: 'NORMALE',
  HAUTE: 'HAUTE',
  URGENTE: 'URGENTE',
} as const;

/** Union des valeurs de l'enum `PrioriteReclamation`. */
export type PrioriteReclamation = (typeof PrioriteReclamation)[keyof typeof PrioriteReclamation];

export const StatutReclamation = {
  OUVERT: 'OUVERT',
  EN_COURS: 'EN_COURS',
  EN_ATTENTE_REPONSE: 'EN_ATTENTE_REPONSE',
  RESOLU: 'RESOLU',
  FERME: 'FERME',
  REJETE: 'REJETE',
} as const;

/** Union des valeurs de l'enum `StatutReclamation`. */
export type StatutReclamation = (typeof StatutReclamation)[keyof typeof StatutReclamation];

export const TypeDemandeDocument = {
  ATTESTATION_SCOLARITE: 'ATTESTATION_SCOLARITE',
  ATTESTATION_FREQUENTATION: 'ATTESTATION_FREQUENTATION',
  RELEVE_NOTES: 'RELEVE_NOTES',
  DUPLICATA_CARTE: 'DUPLICATA_CARTE',
  ATTESTATION_REUSSITE: 'ATTESTATION_REUSSITE',
  CERTIFICAT_SCOLARITE: 'CERTIFICAT_SCOLARITE',
  AUTRE: 'AUTRE',
} as const;

/** Union des valeurs de l'enum `TypeDemandeDocument`. */
export type TypeDemandeDocument = (typeof TypeDemandeDocument)[keyof typeof TypeDemandeDocument];

export const StatutDemande = {
  EN_ATTENTE_PAIEMENT: 'EN_ATTENTE_PAIEMENT',
  PAYE: 'PAYE',
  EN_TRAITEMENT: 'EN_TRAITEMENT',
  PRET: 'PRET',
  REMISE: 'REMISE',
  REJETE: 'REJETE',
} as const;

/** Union des valeurs de l'enum `StatutDemande`. */
export type StatutDemande = (typeof StatutDemande)[keyof typeof StatutDemande];

export const TypeElection = {
  DELEGUE_PROMOTION: 'DELEGUE_PROMOTION',
  DELEGUE_DEPARTEMENT: 'DELEGUE_DEPARTEMENT',
  PRESIDENT_UNIVERSITE: 'PRESIDENT_UNIVERSITE',
  SYNDICAT: 'SYNDICAT',
  CLUB: 'CLUB',
} as const;

/** Union des valeurs de l'enum `TypeElection`. */
export type TypeElection = (typeof TypeElection)[keyof typeof TypeElection];

export const StatutElection = {
  BROUILLON: 'BROUILLON',
  OUVERT: 'OUVERT',
  CLOS: 'CLOS',
  PROCLAME: 'PROCLAME',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutElection`. */
export type StatutElection = (typeof StatutElection)[keyof typeof StatutElection];

export const ModeVote = {
  WEB: 'WEB',
  KIOSQUE: 'KIOSQUE',
  SMS: 'SMS',
} as const;

/** Union des valeurs de l'enum `ModeVote`. */
export type ModeVote = (typeof ModeVote)[keyof typeof ModeVote];

export const StatutBadge = {
  ACTIF: 'ACTIF',
  EXPIRE: 'EXPIRE',
  ANNULE: 'ANNULE',
} as const;

/** Union des valeurs de l'enum `StatutBadge`. */
export type StatutBadge = (typeof StatutBadge)[keyof typeof StatutBadge];

export const TypeRessourceVOD = {
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  NOTES: 'NOTES',
  TRANSCRIPTION: 'TRANSCRIPTION',
} as const;

/** Union des valeurs de l'enum `TypeRessourceVOD`. */
export type TypeRessourceVOD = (typeof TypeRessourceVOD)[keyof typeof TypeRessourceVOD];

export const StatutVOD = {
  BROUILLON: 'BROUILLON',
  EN_LIGNE: 'EN_LIGNE',
  HORS_LIGNE: 'HORS_LIGNE',
  ARCHIVE: 'ARCHIVE',
} as const;

/** Union des valeurs de l'enum `StatutVOD`. */
export type StatutVOD = (typeof StatutVOD)[keyof typeof StatutVOD];
