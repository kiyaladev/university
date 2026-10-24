/** Référentiels : rôles, comptes, années, structure, salles, enseignants, matières, affectations, créneaux. */

/**
 * Les énumérations viennent du schéma Prisma : elles sont générées dans
 * `types/generated/enums.ts` et réexportées ici, sans recopie. Regenerer avec
 * `bun run types:generer`.
 */
import type {
  Niveau,
  Role,
  StatutEnseignant,
  StatutJustificatif,
  StatutPresence,
  StatutSeance,
  TypeCours,
  TypeJustificatif,
} from './generated/enums';

export type {
  Niveau,
  Role,
  StatutEnseignant,
  StatutJustificatif,
  StatutPresence,
  StatutSeance,
  TypeCours,
  TypeJustificatif,
} from './generated/enums';

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
