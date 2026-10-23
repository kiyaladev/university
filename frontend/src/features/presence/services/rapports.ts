import { lire } from '@/shared/services/http';

/**
 * Rapports de présence (`/rapports`).
 *
 * Tous ces rapports partagent la même période et les mêmes filtres ; ils se
 * distinguent par la forme de leurs lignes. Les types ci-dessous décrivent
 * cette forme pour que les écrans n'aient plus à écrire `any`.
 */

/** Filtres communs à tous les rapports. */
export interface ParametresRapports {
  dateDebut?: string;
  dateFin?: string;
  date?: string;
  enseignantId?: string;
  departementId?: string;
  promotionId?: string;
  anneeId?: string;
  salleId?: string;
  /** Filtre de l'état de paiement : `ACTIF`, `VACATAIRE`… */
  statutEnseignant?: string;
}

/** Période couverte par un rapport. */
export interface PeriodeRapport {
  debut: string;
  fin: string;
}

/** Compteurs agrégés d'une période. */
export interface SyntheseRapport {
  planifiees?: number;
  controlees?: number;
  present?: number;
  absent?: number;
  retard?: number;
  excuse?: number;
  remplace?: number;
  departAnticipe?: number;
  heuresPrevues?: number;
  heuresRealisees?: number;
  assurees?: number;
  tauxPresence?: number;
  tauxControle?: number;
  tauxRealisation?: number;
}

/** Ligne d'assiduité : le bilan d'un enseignant sur la période. */
export interface LigneAssiduite extends SyntheseRapport {
  enseignantId: string;
  matricule: string;
  nom: string;
  grade?: string | null;
  statutEnseignant?: string | null;
  departement?: string | null;
}

/** Rapport d'assiduité des enseignants. */
export interface RapportAssiduite {
  periode?: PeriodeRapport;
  total?: SyntheseRapport;
  lignes: LigneAssiduite[];
}

/** Ligne de volume horaire : le contrat d'un enseignant face au réalisé. */
export interface LigneVolumeHoraire extends SyntheseRapport {
  affectationId: string;
  enseignant: string;
  departement?: string | null;
  matiere: string;
  codeMatiere: string;
  promotion: string;
  volumeHorairePrevu: number;
  reste: number;
  tauxContrat?: number;
}

/** Rapport de volume horaire. */
export interface RapportVolumeHoraire {
  lignes: LigneVolumeHoraire[];
}

/** Détail d'une ligne d'état de paiement : un motif de séance. */
export interface DetailPaiement {
  libelle: string;
  heures: number;
  seances: number;
}

/** Ligne d'état de paiement : ce qu'on doit à un enseignant. */
export interface LignePaiement {
  enseignantId: string;
  matricule: string;
  nom: string;
  statutEnseignant?: string | null;
  departement?: string | null;
  tauxHoraire?: number;
  heuresRealisees: number;
  montant: number;
  seancesAssurees?: number;
  absences?: number;
  detail?: DetailPaiement[];
}

/** Rapport d'état de paiement des enseignants vacataires. */
export interface RapportPaiement {
  periode?: PeriodeRapport;
  totalMontant?: number;
  totalHeures?: number;
  lignes: LignePaiement[];
}

/** Ligne du registre de contrôle : la transcription d'une séance. */
export interface LigneRegistre {
  seanceId: string;
  date: string;
  horaire: string;
  enseignant: string;
  matricule: string;
  matiere: string;
  promotion: string;
  salle: string;
  type: string;
  statut: string;
  heureArrivee: string;
  heureFinReelle: string;
  dureeMinutes: number;
  effectifPresent?: number | null;
  thematiqueTraitee: string;
  observation?: string;
  methode?: string | null;
  attestation?: string | null;
  attestationValide?: boolean;
  justificatif?: string | null;
}

/** Registre de contrôle : le cahier du contrôleur, transcrit. */
export interface RapportRegistre {
  date: string;
  total: number;
  synthese?: SyntheseRapport;
  lignes: LigneRegistre[];
}

/** Résumé d'un groupe de séances, pour la couverture des contrôleurs. */
export interface ResumeCouverture {
  seancesPassees?: number;
  visitees?: number;
  nonVisitees?: number;
  realiseesParAssigne?: number;
  realiseesParUnAutre?: number;
  tauxCouverture?: number;
  tauxParAssigne?: number;
}

/** Rapport de couverture des contrôleurs. */
export interface RapportCouverture {
  periode?: PeriodeRapport;
  nonAffectees?: ResumeCouverture;
  lignes: Array<ResumeCouverture & { controleurId: string; nom: string }>;
}

/** Une journée de présence, pour le tableau de bord. */
export interface JourneeRapport extends SyntheseRapport {
  date: string;
  enAttente?: number;
  /** L'évolution d'un jour compte les absences et les retards à part. */
  absences?: number;
  retards?: number;
}

/** Une part de la répartition par statut de présence. */
export interface PartRepartition {
  statut: string;
  valeur: number;
}

/** Une ligne du classement par département. */
export interface LigneDepartement extends SyntheseRapport {
  id: string;
  nom: string;
}

/** Une ligne du classement des enseignants les plus absents. */
export interface LigneEnseignantAbsent extends SyntheseRapport {
  id: string;
  nom: string;
}

/** Tableau de bord : la synthèse d'une période, du jour et des classements. */
export interface RapportTableauBord {
  periode?: PeriodeRapport;
  jour?: JourneeRapport;
  global?: SyntheseRapport;
  evolution?: JourneeRapport[];
  repartition?: PartRepartition[];
  departements?: LigneDepartement[];
  enseignantsAbsents?: LigneEnseignantAbsent[];
  justificatifsEnAttente?: number;
}

/** Ligne de salle : le terrain d'un contrôleur. */
export interface LigneSalle extends SyntheseRapport {
  salleId: string | null;
  code: string;
  nom: string;
  batiment?: string | null;
  capacite?: number;
  effectifMoyen?: number;
  tauxOccupation?: number;
  derniereVisite?: string | null;
}

/** Rapport d'occupation des salles. */
export interface RapportSalles {
  periode?: PeriodeRapport;
  total?: SyntheseRapport;
  lignes: LigneSalle[];
}

/** Fiche personnelle d'un enseignant : ses séances sur la période. */
export interface FicheEnseignant {
  enseignant?: {
    id: string;
    matricule: string;
    nom: string;
    prenom: string;
    grade?: string | null;
    statut?: string | null;
    departementId?: string | null;
    departement?: { id: string; code: string; nom: string } | null;
  } | null;
  periode?: PeriodeRapport;
  synthese?: SyntheseRapport;
  seances: Array<{
    id: string;
    date: string;
    horaire: string;
    matiere: string;
    promotion: string;
    salle: string;
    statut: string;
    dureeMinutes: number;
    thematiqueTraitee?: string;
    observation?: string;
  }>;
}

export const rapportsService = {
  /** Tableau de bord : synthèse de la période, évolution, classement par département. */
  dashboard: (params: ParametresRapports = {}) => lire<RapportTableauBord>('/rapports/dashboard', params),

  /** Assiduité des enseignants sur la période. */
  presenceEnseignants: (params: ParametresRapports = {}) =>
    lire<RapportAssiduite>('/rapports/presence-enseignants', params),

  /** Occupation des salles sur la période. */
  salles: (params: ParametresRapports = {}) => lire<RapportSalles>('/rapports/salles', params),

  /** Volume horaire : le contrat face au réalisé, par affectation. */
  volumeHoraire: (params: ParametresRapports = {}) =>
    lire<RapportVolumeHoraire>('/rapports/volume-horaire', params),

  /** État de paiement des enseignants vacataires. */
  etatPaiement: (params: ParametresRapports = {}) => lire<RapportPaiement>('/rapports/etat-paiement', params),

  /** Registre de contrôle : la transcription du cahier du contrôleur. */
  registre: (params: ParametresRapports = {}) => lire<RapportRegistre>('/rapports/registre', params),

  /** Couverture des contrôleurs sur la période. */
  couvertureControleurs: (params: ParametresRapports = {}) =>
    lire<RapportCouverture>('/rapports/couverture-controleurs', params),

  /** Fiche personnelle de l'agent connecté : ses séances sur la période. */
  maFiche: (params: ParametresRapports = {}) => lire<FicheEnseignant>('/rapports/ma-fiche', params),
};
