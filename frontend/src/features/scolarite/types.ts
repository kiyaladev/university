/**
 * Types du domaine scolarité : réclamations, demandes de documents et vues
 * propres aux écrans (portail étudiant, bulletins, notes).
 *
 * Les types qui décrivent un modèle de l'API vivent dans `src/types` ; ceux
 * d'ici sont les formes dérivées, utilisées par un seul écran.
 */

import type { Departement, Role } from '@/types/referentiels';
import type { TravailEncadre } from '@/types/campus';
import type {
  DecisionJury,
  Deliberation,
  Etudiant,
  ModePaiement,
  SessionDeliberation,
  StatutPaiement,
} from '@/types/registre';

export type TypeReclamation =
  'NOTE_MANQUANTE' | 'ERREUR_SAISIE' | 'INSCRIPTION' | 'ENSEIGNEMENT' | 'SCOLARITE' | 'TECHNIQUE' | 'AUTRE';

export type PrioriteReclamation = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';

export type StatutReclamation = 'OUVERT' | 'EN_COURS' | 'EN_ATTENTE_REPONSE' | 'RESOLU' | 'FERME' | 'REJETE';

export interface MessageReclamation {
  id: string;
  reclamationId: string;
  auteurId?: string | null;
  nomAffichage?: string | null;
  contenu: string;
  joint?: string | null;
  createdAt: string;
  auteur?: { id: string; nom: string; prenom: string; role: Role } | null;
}

export interface Reclamation {
  id: string;
  numero: string;
  type: TypeReclamation;
  sujet: string;
  description: string;
  anonyme: boolean;
  etudiantId?: string | null;
  nomAuteur?: string | null;
  emailAuteur?: string | null;
  priorite: PrioriteReclamation;
  statut: StatutReclamation;
  departementId?: string | null;
  assigneAId?: string | null;
  delaiEscaladeHeures?: number | null;
  escaladeLe?: string | null;
  createdAt: string;
  fermeLe?: string | null;
  notes?: string | null;
  etudiant?: Etudiant | null;
  departement?: Departement | null;
  assigneA?: { id: string; nom: string; prenom: string; role: Role } | null;
  messages?: MessageReclamation[];
  _count?: { messages: number };
}

export type TypeDemandeDocument =
  | 'ATTESTATION_SCOLARITE'
  | 'ATTESTATION_FREQUENTATION'
  | 'RELEVE_NOTES'
  | 'DUPLICATA_CARTE'
  | 'ATTESTATION_REUSSITE'
  | 'CERTIFICAT_SCOLARITE'
  | 'AUTRE';

export type StatutDemande = 'EN_ATTENTE_PAIEMENT' | 'PAYE' | 'EN_TRAITEMENT' | 'PRET' | 'REMISE' | 'REJETE';

export interface TarifDemande {
  id: string;
  type: TypeDemandeDocument;
  montant: number;
  devise: string;
  delaiHeures: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemandeDocument {
  id: string;
  numero: string;
  type: TypeDemandeDocument;
  motif?: string | null;
  etudiantId: string;
  inscriptionId?: string | null;
  frais: number;
  devise: string;
  paiementId?: string | null;
  statut: StatutDemande;
  notification?: string | null;
  traiteParId?: string | null;
  createdAt: string;
  remiseLe?: string | null;
  notes?: string | null;
  etudiant?: Etudiant | null;
  inscription?: { id: string; numero: string } | null;
  paiement?: {
    id: string;
    reference: string;
    statut: StatutPaiement;
    montant: number;
    devise: string;
    mode: ModePaiement;
  } | null;
  traitePar?: { id: string; nom: string; prenom: string; role: Role } | null;
}

// ------------------------------------------------------------------ stages

/** Une soutenance affichée dans le calendrier des soutenances à venir. */
export interface SoutenanceCalendrier {
  id: string;
  date: string;
  salleId?: string | null;
  presidentId?: string | null;
  note?: number | null;
  mention?: string | null;
  salle?: { id: string; code: string; nom: string } | null;
  president?: { id: string; nom: string; prenom: string } | null;
  travailEncadre?: TravailEncadre | null;
}

/** Une transition de statut proposée dans le menu d'un travail encadré. */
export interface BoutonTransition {
  statut: string;
  libelle: string;
  icone: string;
  couleur: string;
  role?: string[];
}

// ------------------------------------------------------------ délibérations

/** La liste renvoie l'effectif agrégé, absent du modèle partagé. */
export interface DeliberationListe extends Deliberation {
  _count?: { lignes: number };
}

// -------------------------------------------------------------- bulletins

/** Une ligne du listing des bulletins : l'inscrit et sa décision de jury. */
export interface LigneBulletin {
  inscriptionId: string;
  etudiantId: string | null;
  matricule: string;
  nom: string;
  prenom: string;
  moyenne: number | null;
  decision: string | null;
  mention: string | null;
  rang: number | null;
  deliberationId: string | null;
}

/** Une matière d'un bulletin. */
export interface LigneDetailBulletin {
  matiere: string;
  code?: string;
  credits: number;
  moyenne: number; // /20
  decision?: string;
}

/** Le bulletin d'un étudiant, tel qu'affiché et imprimé. */
export interface Bulletin {
  etudiant: { matricule: string; nom: string; prenom: string };
  promotion: string;
  annee: string;
  session: string;
  dateDeliberation?: string;
  lignes: LigneDetailBulletin[];
  moyenneGenerale: number;
  decision: DecisionJury | null;
  mention?: string;
  rang?: number;
  effectif?: number;
}

// -------------------------------------------------------------- étudiants

/** Un étudiant du registre, avec ses inscriptions. */
export interface EtudiantRegistre extends Etudiant {
  inscriptions?: {
    id: string;
    promotionId?: string;
    promotion?: { id: string; nom: string; niveau?: string } | null;
    createdAt?: string;
  }[];
}

/** Un étudiant du formulaire de création, avec ses inscriptions saisies. */
export interface EtudiantAvecInscriptions extends Etudiant {
  inscriptions?: { promotionId?: string; promotion?: { id: string; nom: string; niveau?: string } | null }[];
}

// ------------------------------------------------------------ réclamations

/** Une tuile de choix du type de réclamation. */
export interface TuileType {
  value: TypeReclamation;
  label: string;
  icone: string;
}

// ----------------------------------------------------------------- portail

/** Un paiement affiché dans le portail étudiant. */
export interface PaiementPortail {
  id: string;
  reference: string;
  montant: number;
  devise: string;
  mode: string;
  operateur?: string | null;
  statut: string;
  horodatage: string;
  motif?: string | null;
}

/** Une attestation affichée dans le portail étudiant. */
export interface AttestationPortail {
  id: string;
  numero: string;
  type: string;
  motif?: string | null;
  statut: 'EMIS' | 'REVOQUE';
  emiseLe: string;
}

/** Un résultat de délibération affiché dans le portail étudiant. */
export interface LigneResultat {
  id: string;
  session: SessionDeliberation;
  statutDeliberation: string;
  valideeLe?: string | null;
  annee: string;
  promotion: string;
  moyenne: number;
  decision: DecisionJury;
  mention?: string | null;
  rang?: number | null;
}

/** Le dossier de l'étudiant, tel que renvoyé par `/portail/me`. */
export interface PortailProfil {
  etudiant: {
    id: string;
    matricule: string;
    nom: string;
    prenom: string;
    email?: string | null;
    telephone?: string | null;
    actif: boolean;
  };
  inscription: {
    id: string;
    numero: string;
    statut: string;
    dateInscription?: string | null;
    montantFrais: number;
    annee: { libelle?: string };
    promotion: { nom?: string; niveau?: string; filiere?: string | null };
  } | null;
  frais: { montant: number; devise: string; paye: number; solde: number; taux: number } | null;
  paiements: PaiementPortail[];
  attestations: AttestationPortail[];
}

/** Une opération du portefeuille resto. */
export interface LigneResto {
  cle: string;
  date: string;
  libelle: string;
  montant: number;
  statut: string;
}

/** Le portefeuille resto de l'étudiant. */
export interface PortefeuilleRestoPortail {
  solde: number;
  lignes: LigneResto[];
  instructions?: string | null;
}
