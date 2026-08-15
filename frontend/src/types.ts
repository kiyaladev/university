/** Types partagés avec l'API UniPrésence. */

export type Role =
  | 'ADMIN'
  | 'DIRECTION'
  | 'SCOLARITE'
  | 'CHEF_DEPARTEMENT'
  | 'CONTROLEUR'
  | 'ENSEIGNANT'
  | 'ETUDIANT';

export type StatutPresence =
  | 'PRESENT'
  | 'RETARD'
  | 'ABSENT'
  | 'DEPART_ANTICIPE'
  | 'REMPLACE'
  | 'EXCUSE';

export type StatutSeance = 'PLANIFIEE' | 'EN_COURS' | 'CONTROLEE' | 'ANNULEE' | 'NON_TENUE';
export type TypeCours = 'CM' | 'TD' | 'TP' | 'EXAMEN' | 'CONFERENCE';
export type Niveau = 'L1' | 'L2' | 'L3' | 'M1' | 'M2' | 'DOCTORAT';
export type StatutEnseignant = 'PERMANENT' | 'VACATAIRE' | 'CONTRACTUEL';
export type StatutJustificatif = 'EN_ATTENTE' | 'VALIDE' | 'REJETE';
export type TypeJustificatif =
  | 'MALADIE'
  | 'MISSION'
  | 'FORMATION'
  | 'DEUIL'
  | 'TRANSPORT'
  | 'AUTRE';

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string | null;
  role: Role;
  actif: boolean;
  departementId?: string | null;
  departement?: Departement | null;
  enseignantId?: string | null;
}

export interface AnneeAcademique {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  active: boolean;
  cloturee: boolean;
}

export interface Departement {
  id: string;
  code: string;
  nom: string;
  faculte?: string | null;
  _count?: { enseignants: number; filieres: number };
}

export interface Filiere {
  id: string;
  code: string;
  nom: string;
  departementId: string;
  departement?: Departement;
}

export interface Promotion {
  id: string;
  nom: string;
  niveau: Niveau;
  effectif: number;
  filiereId: string;
  anneeId: string;
  filiere?: Filiere;
}

export interface Salle {
  id: string;
  code: string;
  nom: string;
  batiment?: string | null;
  capacite: number;
  qrToken: string;
  latitude?: number | null;
  longitude?: number | null;
  rayonMetres: number;
  actif: boolean;
}

export interface Enseignant {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  grade?: string | null;
  statut: StatutEnseignant;
  tauxHoraire: number;
  actif: boolean;
  departementId?: string | null;
  departement?: Departement | null;
  user?: { id: string; email: string; actif: boolean } | null;
}

export interface Matiere {
  id: string;
  code: string;
  intitule: string;
  volumeHoraireTotal: number;
  credits: number;
  departementId?: string | null;
  departement?: Departement | null;
}

export interface Affectation {
  id: string;
  enseignantId: string;
  matiereId: string;
  promotionId: string;
  anneeId: string;
  volumeHorairePrevu: number;
  enseignant?: Enseignant;
  matiere?: Matiere;
  promotion?: Promotion;
}

export interface Creneau {
  id: string;
  affectationId: string;
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
  type: TypeCours;
  salleId?: string | null;
  actif: boolean;
  /** Période de validité : vides, le créneau court sur toute l'année. */
  dateDebut?: string | null;
  dateFin?: string | null;
  affectation?: Affectation;
  salle?: Salle | null;
}

export interface Controle {
  id: string;
  seanceId: string;
  controleurId: string;
  statut: StatutPresence;
  heureArrivee?: string | null;
  heureFinReelle?: string | null;
  dureeMinutes: number;
  effectifPresent?: number | null;
  thematiqueTraitee?: string | null;
  observation?: string | null;
  methode: 'MANUEL' | 'QR_SALLE' | 'GEOLOCALISATION' | 'SIGNATURE';
  latitude?: number | null;
  longitude?: number | null;
  distanceMetres?: number | null;
  signatureBase64?: string | null;
  qrSalleValide: boolean;
  attestation: AttestationMode;
  attestationValide: boolean;
  attestationLe?: string | null;
  empreinteScore?: number | null;
  horsLigne: boolean;
  horodatage: string;
  controleur?: { id: string; nom: string; prenom: string; role: Role };
  enseignantRemplacant?: { id: string; nom: string; prenom: string } | null;
  seance?: Seance;
}

export interface Justificatif {
  id: string;
  seanceId: string;
  enseignantId: string;
  type: TypeJustificatif;
  motif: string;
  piece?: string | null;
  statut: StatutJustificatif;
  commentaire?: string | null;
  traiteLe?: string | null;
  createdAt: string;
  enseignant?: Enseignant;
  traitePar?: { id: string; nom: string; prenom: string } | null;
  seance?: Seance;
}

export interface Seance {
  id: string;
  affectationId: string;
  anneeId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  type: TypeCours;
  salleId?: string | null;
  statut: StatutSeance;
  thematique?: string | null;
  affectation?: Affectation;
  salle?: Salle | null;
  controle?: Controle | null;
  justificatif?: Justificatif | null;
}

export type AttestationMode = 'AUCUNE' | 'SIGNATURE' | 'CODE_PIN' | 'EMPREINTE';

/** Résultat signé par la passerelle biométrique locale. */
export interface PreuveEmpreinte {
  score: number;
  horodatage: string;
  signature: string;
  /** Appareil signataire, quand la lecture vient d'un lecteur embarqué. */
  appareilId?: string;
}

/** Moyens d'attestation dont dispose un enseignant. */
export interface MoyensAttestation {
  codePin: boolean;
  empreinte: boolean;
  empreinteDoigt?: string | null;
}

export interface Pointage {
  seanceId: string;
  statut?: StatutPresence;
  heureArrivee?: string;
  heureFinReelle?: string;
  effectifPresent?: number;
  thematiqueTraitee?: string;
  observation?: string;
  qrToken?: string;
  latitude?: number;
  longitude?: number;
  enseignantRemplacantId?: string;
  horsLigne?: boolean;
  horodatage?: string;

  // Attestation de l'enseignant : une seule de ces preuves suffit
  signatureBase64?: string;
  codePinEnseignant?: string;
  empreinte?: PreuveEmpreinte;
}

export interface Liste<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Registre universitaire (modules Inscriptions, Paie, Scolarité, Attestations,
// Portail)
// ---------------------------------------------------------------------------

export type StatutInscription =
  | 'BROUILLON'
  | 'EN_ATTENTE_PAIEMENT'
  | 'PAYEE'
  | 'VALIDEE'
  | 'ANNULEE';

export type StatutPaiement = 'EN_ATTENTE' | 'REUSSI' | 'ECHOUE' | 'ANNULE' | 'REMBOURSE';
export type ModePaiement = 'MOBILE_MONEY' | 'ESPECES' | 'VIREMENT';
export type StatutPaie = 'BROUILLON' | 'VALIDEE' | 'PAYEE';
export type TypeEvaluation = 'CC' | 'EXAMEN' | 'RATTRAPAGE' | 'ORAL' | 'TP';
export type StatutEvaluation = 'OUVERTE' | 'CLOTUREE';
export type SessionDeliberation = 'NORMALE' | 'RATTRAPAGE';
export type StatutDeliberation = 'BROUILLON' | 'VALIDEE';
export type DecisionJury = 'ADMIS' | 'AJOURNE' | 'DEFAILLANT';
export type TypeAttestation = 'SCOLARITE' | 'SITUATION' | 'REUSSITE' | 'DIPLOME' | 'ASSIDUITE';
export type StatutAttestation = 'EMISE' | 'REVOQUEE';
export type StatutNotification = 'EN_ATTENTE' | 'ENVOYEE' | 'ECHOUE';

export interface Etudiant {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  sexe?: string | null;
  dateNaissance?: string | null;
  lieuNaissance?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  actif: boolean;
  user?: { id: string; email: string; actif: boolean } | null;
  _count?: { inscriptions: number; paiements: number };
}

export interface Inscription {
  id: string;
  numero: string;
  etudiantId: string;
  anneeId: string;
  promotionId: string;
  statut: StatutInscription;
  montantFrais: number;
  dateInscription?: string | null;
  valideeLe?: string | null;
  createdAt: string;
  updatedAt: string;
  etudiant?: Etudiant;
  annee?: AnneeAcademique;
  promotion?: Promotion;
  paiements?: Paiement[];
  _sum?: { paiements_montant?: number } | { paiements?: { montant: number }[] };
}

export interface Frais {
  id: string;
  anneeId: string;
  promotionId: string;
  montant: number;
  devise: string;
  annee?: AnneeAcademique;
  promotion?: Promotion;
}

export interface Paiement {
  id: string;
  reference: string;
  montant: number;
  devise: string;
  mode: ModePaiement;
  operateur?: string | null;
  telephone?: string | null;
  nomComplet?: string | null;
  motif?: string | null;
  statut: StatutPaiement;
  transactionId?: string | null;
  inscriptionId?: string | null;
  etudiantId?: string | null;
  horodatage: string;
  completeLe?: string | null;
  motifAnnulation?: string | null;
  createdAt: string;
  etudiant?: Etudiant | null;
  inscription?: Inscription | null;
  creePar?: { id: string; nom: string; prenom: string } | null;
}

export interface Evaluation {
  id: string;
  intitule: string;
  type: TypeEvaluation;
  coefficient: number;
  matiereId: string;
  anneeId: string;
  promotionId: string;
  semestre: number;
  date?: string | null;
  statut: StatutEvaluation;
  createdAt: string;
  matiere?: Matiere;
  annee?: AnneeAcademique;
  promotion?: Promotion;
  _count?: { notes: number };
}

export interface Note {
  id: string;
  evaluationId: string;
  inscriptionId: string;
  note?: number | null;
  present: boolean;
  saisieLe: string;
  inscription?: Inscription & { etudiant?: Etudiant; promotion?: Promotion };
}

export interface Deliberation {
  id: string;
  anneeId: string;
  promotionId: string;
  session: 'NORMALE' | 'RATTRAPAGE';
  statut: StatutDeliberation;
  tauxReussite?: number | null;
  commentaire?: string | null;
  creeLe: string;
  valideeLe?: string | null;
  annee?: AnneeAcademique;
  promotion?: Promotion;
  lignes?: DeliberationLigne[];
}

export interface DeliberationLigne {
  id: string;
  deliberationId: string;
  inscriptionId: string;
  moyenne: number;
  decision: DecisionJury;
  mention?: string | null;
  rang?: number | null;
  inscription?: Inscription & { etudiant?: Etudiant };
}

export interface Attestation {
  id: string;
  numero: string;
  type: TypeAttestation;
  motif?: string | null;
  statut: StatutAttestation;
  qrToken: string;
  anneeId?: string | null;
  promotionId?: string | null;
  inscriptionId?: string | null;
  etudiantId?: string | null;
  emiseLe: string;
  revoqueeLe?: string | null;
  motifRevocation?: string | null;
  etudiant?: Etudiant | null;
  annee?: AnneeAcademique | null;
  promotion?: Promotion | null;
  inscription?: Inscription | null;
  emisePar?: { id: string; nom: string; prenom: string } | null;
  _count?: { verifications: number };
}

export interface FeuillePaie {
  id: string;
  libelle: string;
  mois: number;
  annee: number;
  dateDebut: string;
  dateFin: string;
  statut: StatutPaie;
  montantTotal: number;
  creeLe: string;
  valideeLe?: string | null;
  payeeLe?: string | null;
  lignes?: LignePaie[];
  creePar?: { id: string; nom: string; prenom: string } | null;
  valideePar?: { id: string; nom: string; prenom: string } | null;
}

export interface LignePaie {
  id: string;
  feuilleId: string;
  enseignantId: string;
  tauxHoraire: number;
  heuresReelles: number;
  volumePrevu: number;
  montantBrut: number;
  retenue: number;
  montantNet: number;
  commentaire?: string | null;
  enseignant?: Enseignant;
}

export interface Notification {
  id: string;
  telephone: string;
  message: string;
  motif?: string | null;
  destinataireNom?: string | null;
  etudiantId?: string | null;
  statut: StatutNotification;
  envoyeLe?: string | null;
  erreur?: string | null;
  createdAt: string;
  etudiant?: Etudiant | null;
  envoyePar?: { id: string; nom: string; prenom: string } | null;
}

// ---------------------------------------------------------------------------
// Modules Kankan : cités, bibliothèque, resto, réservations, stages, helpdesk,
// formation continue
// ---------------------------------------------------------------------------

export type CategorieChambre = 'CHAMBRE_SIMPLE' | 'CHAMBRE_PARTAGEE' | 'STUDIO' | 'APPARTEMENT';
export type StatutChambre = 'LIBRE' | 'RESERVEE' | 'OCCUPEE' | 'MAINTENANCE';
export type StatutAttributionLogement = 'EN_ATTENTE' | 'ACCORDEE' | 'REFUSEE' | 'RETIREE';
export type TypeDocument = 'MEMOIRE' | 'THESE' | 'ARTICLE' | 'RAPPORT' | 'SUPPORT_COURS' | 'ARCHIVE' | 'AUTRE';
export type TypeRepas = 'PETIT_DEJEUNER' | 'DEJEUNER' | 'COLLATION' | 'DINER' | 'AUTRE';
export type StatutConsommation = 'EN_ATTENTE' | 'VALIDEE' | 'ANNULEE';
export type StatutReservationSalle = 'EN_ATTENTE' | 'CONFIRMEE' | 'REFUSEE' | 'ANNULEE';
export type TypeEncadrement = 'STAGE' | 'MEMOIRE' | 'RAPPORT';
export type StatutEncadrement = 'PROPOSE' | 'VALIDE' | 'EN_COURS' | 'SOUTENU' | 'ABANDONNE';
export type CategorieIncident = 'VIDEO' | 'SON' | 'RESEAU' | 'ELECTRICITE' | 'MOBILIER' | 'INFORMATIQUE' | 'CLIMATISATION' | 'AUTRE';
export type PrioriteTicket = 'BASSE' | 'NORMALE' | 'HAUTE';
export type StatutTicket = 'OUVERT' | 'EN_COURS' | 'RESOLU' | 'CLOTURE';
export type StatutFormation = 'BROUILLON' | 'PUBLIEE' | 'COMPLETE';
export type StatutInscriptionFormation = 'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE';

export interface Residence {
  id: string;
  code: string;
  nom: string;
  ville?: string | null;
  adresse?: string | null;
  capacite: number;
  responsable?: string | null;
  actif: boolean;
  chambres?: Chambre[];
  _count?: { chambres: number };
}

export interface Chambre {
  id: string;
  code: string;
  residenceId: string;
  categorie: CategorieChambre;
  lits: number;
  loyer: number;
  devise: string;
  statut: StatutChambre;
  residence?: Residence;
  _count?: { attributions: number };
}

export interface AttributionLogement {
  id: string;
  chambreId: string;
  etudiantId: string;
  anneeId?: string | null;
  statut: StatutAttributionLogement;
  critereScore?: number | null;
  justificatif?: string | null;
  accordeeLe?: string | null;
  retireeLe?: string | null;
  retireeMotif?: string | null;
  createdAt: string;
  chambre?: Chambre;
  etudiant?: Etudiant;
  annee?: AnneeAcademique | null;
}

export interface DocumentDepot {
  id: string;
  titre: string;
  type: TypeDocument;
  auteurs?: string | null;
  anneeEdition?: number | null;
  resume?: string | null;
  fichier?: string | null;
  typeMime?: string | null;
  tailleKo?: number | null;
  public: boolean;
  departementId?: string | null;
  enseignantId?: string | null;
  etudiantId?: string | null;
  telechargements: number;
  createdAt: string;
  departement?: Departement | null;
  enseignant?: Enseignant | null;
  etudiant?: Etudiant | null;
}

export interface PortefeuilleResto {
  id: string;
  etudiantId: string;
  solde: number;
  etudiant?: Etudiant;
}

export interface Recharge {
  id: string;
  portefeuilleId: string;
  etudiantId: string;
  montant: number;
  statut: StatutPaiement;
  paiementId?: string | null;
  rechargeLe: string;
}

export interface ConsommationResto {
  id: string;
  portefeuilleId: string;
  repas: TypeRepas;
  montant: number;
  cantine?: string | null;
  statut: StatutConsommation;
  valideLe?: string | null;
  consommeLe: string;
}

export interface ReservationSalle {
  id: string;
  salleId: string;
  motif: string;
  organisme?: string | null;
  dateJour: string;
  heureDebut: string;
  heureFin: string;
  responsable?: string | null;
  statut: StatutReservationSalle;
  refuseMotif?: string | null;
  creeLe: string;
  salle?: Salle;
  demandeur?: { id: string; nom: string; prenom: string } | null;
}

export interface TravailEncadre {
  id: string;
  type: TypeEncadrement;
  intitule: string;
  description?: string | null;
  etudiantId: string;
  encadrantId?: string | null;
  entreprise?: string | null;
  tuteurEntreprise?: string | null;
  lieu?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  statut: StatutEncadrement;
  rapportRendu: boolean;
  etudiant?: Etudiant;
  encadrant?: Enseignant | null;
  soutenance?: Soutenance | null;
  createdAt: string;
}

export interface Soutenance {
  id: string;
  travailEncadreId: string;
  date: string;
  salleId?: string | null;
  presidentId?: string | null;
  assesseurs?: string | null;
  note?: number | null;
  mention?: string | null;
  salle?: Salle | null;
  president?: Enseignant | null;
}

export interface EquipementCampus {
  id: string;
  libelle: string;
  emplacement?: string | null;
  codeQr: string;
  actif: boolean;
  _count?: { tickets: number };
}

export interface TicketSupport {
  id: string;
  numero: string;
  equipementId?: string | null;
  categorie: CategorieIncident;
  description: string;
  priorite: PrioriteTicket;
  statut: StatutTicket;
  declarantNom?: string | null;
  declarantEmail?: string | null;
  declarantTelephone?: string | null;
  traiteLe?: string | null;
  clicheLe?: string | null;
  createdAt: string;
  equipement?: EquipementCampus | null;
  utilisateur?: { id: string; nom: string; prenom: string } | null;
  traitePar?: { id: string; nom: string; prenom: string } | null;
}

export interface Formation {
  id: string;
  titre: string;
  description?: string | null;
  categorie?: string | null;
  prix: number;
  devise: string;
  dureeHeures?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  lieu?: string | null;
  capacite?: number | null;
  statut: StatutFormation;
  createdAt: string;
  _count?: { inscriptions: number };
}

export interface InscriptionFormation {
  id: string;
  numero: string;
  formationId: string;
  etudiantId?: string | null;
  nomComplet?: string | null;
  telephone?: string | null;
  email?: string | null;
  statut: StatutInscriptionFormation;
  paiementId?: string | null;
  inscriteLe: string;
  formation?: Formation;
  etudiant?: Etudiant | null;
}
