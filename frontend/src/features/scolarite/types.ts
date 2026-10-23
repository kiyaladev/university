/** Plateforme de réclamations & demandes de documents. */

import type { Departement, Role } from '@/types/referentiels';
import type { Etudiant, ModePaiement, StatutPaiement } from '@/types/registre';

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
  creeLe: string;
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
  creeLe: string;
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
  creeLe: string;
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
