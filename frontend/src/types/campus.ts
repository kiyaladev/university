/** Modules Kankan : cités, bibliothèque, resto, réservations, stages, helpdesk, formation continue. */

import type { AnneeAcademique, Departement, Enseignant, Salle } from './referentiels';
import type { Etudiant, StatutPaiement } from './registre';

/** Énumérations générées depuis le schéma Prisma (voir `types/generated/enums.ts`). */
import type {
  CategorieChambre,
  CategorieIncident,
  PrioriteTicket,
  StatutAttributionLogement,
  StatutChambre,
  StatutConsommation,
  StatutEncadrement,
  StatutFormation,
  StatutInscriptionFormation,
  StatutReservationSalle,
  StatutSuspicionPlagiat,
  StatutTicket,
  TypeDocument,
  TypeEncadrement,
  TypeRepas,
} from './generated/enums';

export type {
  CategorieChambre,
  CategorieIncident,
  PrioriteTicket,
  StatutAttributionLogement,
  StatutChambre,
  StatutConsommation,
  StatutEncadrement,
  StatutFormation,
  StatutInscriptionFormation,
  StatutReservationSalle,
  StatutSuspicionPlagiat,
  StatutTicket,
  TypeDocument,
  TypeEncadrement,
  TypeRepas,
} from './generated/enums';

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
  /** Texte plein extrait (PDF) pour la recherche full-text + anti-plagiat. */
  contenuTexte?: string | null;
  /** Mots-clés saisis à la main ou détectés par extraction. */
  motsClefs?: string[];
  /** Empreinte SHA-256 normalisée — sert au regroupement par similarité. */
  empreinteHash?: string | null;
  /** Indice synthétique de plagiat (0–100) — agrège le max des suspicions. */
  indicePlagiat?: number | null;
  /** Extrait autour du terme cherché (renvoyé par /documents/recherche). */
  extraitContexte?: string | null;
  createdAt: string;
  departement?: Departement | null;
  enseignant?: Enseignant | null;
  etudiant?: Etudiant | null;
}

export interface SuspicionPlagiat {
  id: string;
  documentAId: string;
  documentBId: string;
  score: number;
  statut: StatutSuspicionPlagiat;
  detecteLe: string;
  acquitteParId?: string | null;
  acquitteLe?: string | null;
  commentaire?: string | null;
  documentA?: DocumentDepot;
  documentB?: DocumentDepot;
  acquittePar?: { id: string; nom: string; prenom: string } | null;
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
  createdAt: string;
  salle?: Salle;
  demandeurId?: string | null;
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
  etudiant?: Pick<Etudiant, 'id' | 'matricule' | 'nom' | 'prenom'>;
  encadrant?: Pick<Enseignant, 'id' | 'nom' | 'prenom'> | null;
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
  salle?: Pick<Salle, 'id' | 'code' | 'nom'> | null;
  president?: Pick<Enseignant, 'id' | 'nom' | 'prenom'> | null;
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
  formation?: Formation | null;
  etudiant?: Etudiant | null;
}
