/** Modules transverses : carte étudiante, badges d’accès, VOD, élections. */

import type { Departement, Enseignant, Matiere, Promotion } from './referentiels';
import type { Etudiant } from './registre';

/** Énumérations générées depuis le schéma Prisma (voir `types/generated/enums.ts`). */
import type {
  ModeVote,
  StatutAttestation,
  StatutBadge,
  StatutElection,
  StatutVOD,
  TypeElection,
  TypeRessourceVOD,
} from './generated/enums';

export type {
  ModeVote,
  StatutBadge,
  StatutElection,
  StatutVOD,
  TypeElection,
  TypeRessourceVOD,
} from './generated/enums';

/**
 * Statut de la carte étudiante : le modèle `CarteEtudiante` réutilise l'enum
 * Prisma `StatutAttestation` (EMIS / REVOQUE). Le nom d'usage est conservé
 * pour ne rien changer aux imports existants.
 */
export type StatutCarteEtudiante = StatutAttestation;

/**
 * Type de badge d'accès : la colonne `BadgeAcces.type` est une chaîne libre en
 * base (pas d'enum Prisma), les valeurs sont donc énumérées à la main.
 */
export type TypeBadge = 'VISITEUR' | 'INTERVENANT' | 'TECHNICIEN' | 'VIP';

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
