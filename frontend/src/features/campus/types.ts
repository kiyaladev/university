import type {
  Etudiant,
  Formation,
  InscriptionFormation,
  Paiement,
  ReservationSalle,
  StatutVOD,
  TypeRepas,
  TypeRessourceVOD,
} from '@/types';

/**
 * Types du domaine « campus » qui n'existent pas encore dans `src/types` :
 * ils sont propres aux écrans du domaine et restent ici, à côté de leurs
 * services, plutôt que redéclarés dans chaque `.vue`.
 */

/** Étudiant tel qu'il apparaît dans un portefeuille de restauration. */
export interface EtudiantPortefeuille {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  telephone?: string | null;
}

/** Portefeuille de restauration d'un étudiant. */
export interface PortefeuilleResto {
  id: string;
  etudiant: EtudiantPortefeuille;
  solde: number;
  devise?: string | null;
  bloque?: boolean;
}

/** Consommation d'un repas au restaurant universitaire. */
export interface ConsommationResto {
  id: string;
  repas: TypeRepas;
  montant: number;
  statut: string;
  consommeLe: string;
  cantine?: string | null;
  etudiant?: string | null;
  portefeuille?: { etudiant?: EtudiantPortefeuille | null } | null;
}

/** Recharge d'un portefeuille (avec son paiement). */
export interface RechargeResto {
  id: string;
  montant: number;
  rechargeLe: string;
  statut: string;
  paiement?: { mode?: string | null; reference?: string | null; statut?: string | null } | null;
  portefeuille?: { etudiant?: EtudiantPortefeuille | null } | null;
}

/** Réponse du guichet : la validation d'un repas. */
export interface ResultatValidationRepas {
  etudiant?: EtudiantPortefeuille | null;
  consommation?: ConsommationResto | null;
  solde?: number;
  etudiantId?: string | null;
  soldeInsuffisant?: boolean;
  code?: string;
  message?: string;
}

/** Bandeau « repas validé » affiché par le guichet. */
export interface ResultatGuichetOk {
  etudiant: EtudiantPortefeuille;
  consommation: ConsommationResto;
  solde: number;
}

/** Bandeau « repas refusé » affiché par le guichet (solde insuffisant, réseau…). */
export interface ResultatGuichetKo {
  message: string;
  soldeInsuffisant: boolean;
  etudiantId?: string | null;
}

/** Réponse d'une recharge de portefeuille. */
export interface ResultatRecharge {
  immediat: boolean;
  solde: number;
  paiement?: { reference?: string | null; mode?: string | null } | null;
}

/** Ligne unifiée du journal des transactions (recharges + consommations). */
export interface LigneTransaction {
  cle: string;
  id: string;
  repas?: TypeRepas;
  type: 'REPAS' | 'RECHARGE';
  date: string;
  libelle: string;
  etudiant: string;
  montant: number;
  statut: string;
  annulable: boolean;
}

/**
 * Ressource de la médiathèque (VOD).
 *
 * `/vod` renvoie la fiche complète ; `/vod/ma-collecte` n'en renvoie qu'un
 * sous-ensemble, enrichi de la reprise de lecture : le type l'assume, d'où
 * les champs facultatifs.
 */
export interface RessourceCatalogue {
  id: string;
  titre: string;
  description?: string | null;
  type: TypeRessourceVOD;
  url: string;
  thumbnailUrl?: string | null;
  matiereId?: string | null;
  enseignantId?: string | null;
  dureeSecondes?: number | null;
  public?: boolean;
  inscriptionId?: string | null;
  statut?: StatutVOD | null;
  creeParId?: string | null;
  createdAt?: string | null;
  nbVues?: number;
  matiere?: { id: string; code: string; intitule: string } | null;
  enseignant?: { id: string; nom: string; prenom: string } | null;
  /** Collecte étudiante uniquement : reprise de lecture. */
  dernierePosition?: number;
  termine?: boolean;
  /** Vue enregistrée par l'étudiant (pour le lecteur). */
  vue?: { position?: number | null; terminee?: boolean } | null;
}

/** Séance d'une réservation, telle que renvoyée par le calendrier. */
export interface SeanceCalendrier {
  id: string;
  date?: string | null;
  titre?: string | null;
  heureDebut: string;
  heureFin: string;
  salleId?: string | null;
  reservationId?: string | null;
  statut?: string | null;
  responsable?: string | null;
  organisme?: string | null;
  /** Affectation de la séance : matière, promotion, enseignant. */
  affectation?: {
    matiere?: { intitule?: string | null } | null;
    promotion?: { nom?: string | null } | null;
    enseignant?: { nom?: string | null; prenom?: string | null } | null;
  } | null;
  [cle: string]: unknown;
}

/** Jour du calendrier de réservation. */
export interface JourCalendrier {
  date: string;
  reservations: ReservationSalle[];
  seances: SeanceCalendrier[];
  [cle: string]: unknown;
}

/** Réservation lue en détail (demandeur et décideur joints par le serveur). */
export type ReservationDetail = ReservationSalle & {
  demandeurId?: string | null;
  refuseParId?: string | null;
  refusePar?: { id: string; nom: string; prenom: string } | null;
};

/** Étudiant proposé dans le dialogue de recharge. */
export interface EtudiantOption {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  solde: number;
  libelle: string;
}

/** Transition de vie d'un scrutin : ouvrir, clore, proclamer. */
export type ActionTransitionElection = 'ouvrir' | 'clore' | 'proclamer';

/**
 * Inscription à une formation, telle que renvoyée par le registre : la
 * demande, l'étudiant joint et son paiement.
 */
export interface InscriptionFormationDetail extends InscriptionFormation {
  formation?: Formation | null;
  etudiant?: Etudiant | null;
  paiement?: Pick<Paiement, 'id' | 'reference' | 'montant' | 'devise' | 'statut'> | null;
}
