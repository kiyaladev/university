/** Modules transverses : carte étudiante, badges d’accès, VOD, élections. */

import type { Departement, Enseignant, Matiere, Promotion } from './referentiels';
import type { Etudiant } from './registre';

export type StatutCarteEtudiante = 'EMISE' | 'REVOQUEE';
export type TypeBadge = 'VISITEUR' | 'INTERVENANT' | 'TECHNICIEN' | 'VIP';
export type StatutBadge = 'ACTIF' | 'EXPIRE' | 'ANNULE';
export type TypeRessourceVOD = 'AUDIO' | 'VIDEO' | 'NOTES' | 'TRANSCRIPTION';
export type StatutVOD = 'BROUILLON' | 'EN_LIGNE' | 'HORS_LIGNE' | 'ARCHIVE';
export type TypeElection =
  | 'DELEGUE_PROMOTION'
  | 'DELEGUE_DEPARTEMENT'
  | 'PRESIDENT_UNIVERSITE'
  | 'SYNDICAT'
  | 'CLUB';
export type StatutElection = 'BROUILLON' | 'OUVERTE' | 'CLOSE' | 'PROCLAMEE' | 'ANNULEE';
export type ModeVote = 'WEB' | 'KIOSQUE' | 'SMS';

export interface CarteEtudiante {
  id: string;
  etudiantId: string;
  qrToken: string;
  dateEmission: string;
  dateValidite?: string | null;
  statut: StatutCarteEtudiante;
  motifRevocation?: string | null;
  photoUrl?: string | null;
  creeParId?: string | null;
  active: boolean;
  etudiant?: Pick<Etudiant, 'id' | 'matricule' | 'nom' | 'prenom'> & {
    sexe?: string | null;
    dateNaissance?: string | null;
    lieuNaissance?: string | null;
    photoUrl?: string | null;
  };
  creePar?: { id: string; nom: string; prenom: string } | null;
}

export interface BadgeAcces {
  id: string;
  numero: string;
  type: TypeBadge;
  nom: string;
  prenom: string;
  fonction?: string | null;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
  pieceIdentite?: string | null;
  numeroPiece?: string | null;
  dateDelivrance: string;
  dateValidite: string;
  zonesAccess?: string | null;
  qrToken: string;
  statut: StatutBadge;
  motif?: string | null;
  creeParId?: string | null;
  photoUrl?: string | null;
  creePar?: { id: string; nom: string; prenom: string } | null;
}

export interface CoursVOD {
  id: string;
  titre: string;
  description?: string | null;
  matiereId?: string | null;
  seanceId?: string | null;
  enseignantId?: string | null;
  type: TypeRessourceVOD;
  url: string;
  thumbnailUrl?: string | null;
  dureeSecondes?: number | null;
  tailleKo?: number | null;
  transcription?: string | null;
  nbVues: number;
  nbComplets: number;
  public: boolean;
  inscriptionId?: string | null;
  statut: StatutVOD;
  creeParId?: string | null;
  dateMiseEnLigne?: string | null;
  createdAt: string;
  updatedAt: string;
  matiere?: Pick<Matiere, 'id' | 'code' | 'intitule'> | null;
  enseignant?: Pick<Enseignant, 'id' | 'matricule' | 'nom' | 'prenom'> | null;
  creePar?: { id: string; nom: string; prenom: string } | null;
  _count?: { vues: number };
}

export interface CandidatElection {
  id: string;
  electionId: string;
  nom: string;
  prenom: string;
  etudiantId?: string | null;
  enseignantId?: string | null;
  photoUrl?: string | null;
  programme?: string | null;
  ordre: number;
  etudiant?: Pick<Etudiant, 'id' | 'matricule' | 'nom' | 'prenom'> | null;
  enseignant?: Pick<Enseignant, 'id' | 'matricule' | 'nom' | 'prenom'> | null;
  _count?: { votes: number };
}

export interface Election {
  id: string;
  titre: string;
  type: TypeElection;
  promotionId?: string | null;
  departementId?: string | null;
  description?: string | null;
  dateOuverture: string;
  dateCloture: string;
  nbSieges: number;
  bulletin?: string | null;
  statut: StatutElection;
  creeParId?: string | null;
  promotion?: Promotion | null;
  departement?: Departement | null;
  creePar?: { id: string; nom: string; prenom: string } | null;
  candidats?: CandidatElection[];
  _count?: { candidats: number; votes: number };
}

export interface ResultatElection {
  election: {
    id: string;
    titre: string;
    type: TypeElection;
    nbSieges: number;
    statut: StatutElection;
    dateOuverture: string;
    dateCloture: string;
  };
  participation: {
    nbBulletins: number;
    voixTotales: number;
    siegesPourvoir: number;
  };
  candidats: Array<{
    id: string;
    nom: string;
    prenom: string;
    ordre: number;
    voix: number;
    elu: boolean;
  }>;
}
