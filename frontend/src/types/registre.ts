/** Registre universitaire (modules Inscriptions, Paie, Scolarité, Attestations, Portail). */

import type { AnneeAcademique, Enseignant, Matiere, Promotion } from './referentiels';

export type StatutInscription = 'BROUILLON' | 'EN_ATTENTE_PAIEMENT' | 'PAYEE' | 'VALIDEE' | 'ANNULEE';

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
