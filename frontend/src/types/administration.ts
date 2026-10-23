/** Modules Courrier / Examens / Tirage / Recettes. */

import type { AnneeAcademique, Matiere, Promotion, Role, Salle } from './referentiels';
import type { Etudiant, Inscription, Paiement } from './registre';

export type TypeCourrier = 'ENTRANT' | 'SORTANT';
export type StatutCourrier = 'RECU' | 'ENREGISTRE' | 'EN_CIRCUIT' | 'TRAITE' | 'CLASSE' | 'ARCHIVE';
export type TypeExamen = 'PARTIEL' | 'FINAL' | 'RATTRAPAGE' | 'CONTROLE_CONTINU';
export type StatutExamen = 'PLANIFIE' | 'EN_COURS' | 'TERMINE' | 'ANNULE';
export type StadeTirage = 'PROGRAMME' | 'IMPRIME' | 'MIS_SOUS_PLI' | 'DISTRIBUE' | 'RECUPERE' | 'ANNULE';
export type TypeRecette = 'ANALYSE_LABO' | 'LOCATION_AMPHI' | 'PRESTATION_FORMATION' | 'PRESTATION_CONSEIL' | 'AUTRE';

export interface CircuitCourrier {
  id: string;
  courrierId: string;
  ordre: number;
  valideurId?: string | null;
  roleValideur?: string | null;
  statut: StatutCourrier;
  paraphe?: string | null;
  parapheLe?: string | null;
  commentaire?: string | null;
  valideur?: { id: string; nom: string; prenom: string; role: Role } | null;
}

export interface Courrier {
  id: string;
  numero: string;
  type: TypeCourrier;
  objet: string;
  expediteur?: string | null;
  destinataire?: string | null;
  dateReception?: string | null;
  dateEnvoi?: string | null;
  fichier?: string | null;
  typeMime?: string | null;
  tailleKo?: number | null;
  numeroReference?: string | null;
  paraphe?: string | null;
  statut: StatutCourrier;
  enregistreParId?: string | null;
  traiteParId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  circuits?: CircuitCourrier[];
  enregistrePar?: { id: string; nom: string; prenom: string } | null;
  traitePar?: { id: string; nom: string; prenom: string } | null;
}

export interface Examen {
  id: string;
  intitule: string;
  type: TypeExamen;
  matiereId: string;
  promotionId: string;
  anneeId: string;
  dateExamen: string;
  heureDebut: string;
  heureFin: string;
  salleId?: string | null;
  nbInscrits: number;
  nbPresents: number;
  codeExamen: string;
  statut: StatutExamen;
  creeParId?: string | null;
  surveillantId?: string | null;
  createdAt: string;
  updatedAt: string;
  matiere?: Matiere;
  promotion?: Promotion;
  annee?: AnneeAcademique;
  salle?: Salle | null;
  surveillant?: { id: string; nom: string; prenom: string } | null;
  creePar?: { id: string; nom: string; prenom: string } | null;
  _count?: { scans: number; tirages: number };
}

export interface ScanExamen {
  id: string;
  examenId: string;
  inscriptionId?: string | null;
  matriculeSaisi?: string | null;
  nomPorteur?: string | null;
  prenomPorteur?: string | null;
  heureScan: string;
  valide: boolean;
  motifRejet?: string | null;
  scanneurId?: string | null;
  ipAppareil?: string | null;
  dejaEnregistre?: boolean;
  inscription?: (Inscription & { etudiant?: Etudiant }) | null;
  scanneur?: { id: string; nom: string; prenom: string } | null;
  examen?: {
    id: string;
    intitule: string;
    codeExamen: string;
    dateExamen: string;
    heureDebut: string;
    heureFin: string;
  };
}

export interface Tirage {
  id: string;
  examenId: string;
  dateTirage: string;
  imprimeurId?: string | null;
  nbExemplaires: number;
  empreinteSource: string;
  empreinteExemplaires?: string | null;
  circuitImpression?: string | null;
  stade: StadeTirage;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  examen?: Examen;
  imprimeur?: { id: string; nom: string; prenom: string } | null;
}

export interface RecetteExterne {
  id: string;
  numero: string;
  type: TypeRecette;
  libelle: string;
  description?: string | null;
  montant: number;
  devise: string;
  date: string;
  client?: string | null;
  factureNum?: string | null;
  paiementId?: string | null;
  creeParId?: string | null;
  createdAt: string;
  paiement?: Paiement | null;
  creePar?: { id: string; nom: string; prenom: string } | null;
}
