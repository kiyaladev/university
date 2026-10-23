import { creer, lire, lister, modifier } from '@/shared/services/http';
import type { Seance } from '@/types';

/**
 * Séances d'enseignement (`/seances`).
 *
 * Rôles, tels qu'écrits dans les `@Roles` du contrôleur :
 *
 * - `GET /seances` et `GET /seances/journee` : tout le personnel ; l'API
 *   restreint la liste aux séances que l'agent a le droit de voir ;
 * - `GET /seances/controleurs`, `GET /seances/tournee-apercu`,
 *   `PUT /seances/:id/controleur` et `POST /seances/tournee` : administration et
 *   scolarité ;
 * - `POST /seances` : planificateurs et contrôleurs (séance non programmée) ;
 * - `PUT /seances/:id` et `POST /seances/:id/annuler` : planificateurs ;
 * - `POST /seances/generer` : planificateurs.
 */

/** Filtres acceptés par la liste des séances et par la feuille de contrôle du jour. */
export interface ParametresSeances {
  date?: string;
  dateDebut?: string;
  dateFin?: string;
  anneeId?: string;
  enseignantId?: string;
  promotionId?: string;
  salleId?: string;
  departementId?: string;
  matiereId?: string;
  statut?: string;
  /** `1` : uniquement les séances non encore contrôlées. */
  nonControlees?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
}

/** Contrôleur actif, proposé pour l'affectation d'une séance ou d'une tournée. */
export interface ControleurSeance {
  id: string;
  nom: string;
  prenom: string;
}

/** Feuille de contrôle d'une journée. */
export interface JourneeSeances {
  date: string;
  total: number;
  controlees: number;
  enAttente: number;
  seances: Seance[];
}

/** Ce qu'une tournée affecterait, et ce qu'elle laisserait de côté. */
export interface ApercuTournee {
  seancesSansAffectation: number;
  seancesAffectables: number;
  ignoreesAnneeCloturee: number;
}

/** Résultat de l'affectation groupée d'une tournée. */
export interface ResultatTournee {
  seancesAffectees: number;
  ignoreesAnneeCloturee?: number;
}

/** Paramètres d'une tournée : période, contrôleur et département optionnel. */
export interface Tournee {
  dateDebut: string;
  dateFin: string;
  controleurId: string;
  departementId?: string;
}

/** Demande de génération des séances d'une année. */
export interface GenerationSeances {
  anneeId: string;
  dateDebut: string;
  dateFin: string;
  joursExclus: string[];
}

/** Résultat de la génération : ce qui a été créé, ce qui a été envisagé. */
export interface ResultatGeneration {
  creees: number;
  candidates: number;
  ignorees: number;
}

/** Champs modifiables d'une séance. */
export interface ModificationSeance {
  affectationId?: string;
  date?: string;
  heureDebut?: string;
  heureFin?: string;
  type?: string;
  salleId?: string | null;
  thematique?: string | null;
}

export const seancesService = {
  /** Séances filtrées par période, enseignant, statut, salle… */
  liste: (params: ParametresSeances = {}) => lister<Seance>('/seances', params),

  /** Feuille de contrôle du jour : les séances et leur état de contrôle. */
  journee: (date: string, params: Omit<ParametresSeances, 'date'> = {}) =>
    lire<JourneeSeances>('/seances/journee', { ...params, date }),

  /** Contrôleurs actifs, pour l'affectation d'une séance ou d'une tournée. */
  controleurs: () => lire<ControleurSeance[]>('/seances/controleurs'),

  /** Ce qu'une tournée affecterait sur la période demandée. */
  apercuTournee: (params: Tournee) => lire<ApercuTournee>('/seances/tournee-apercu', params),

  /** Affecte d'un bloc les séances encore sans contrôleur. */
  affecterTournee: (params: Tournee) => creer<ResultatTournee>('/seances/tournee', params),

  /** Affecte (ou retire) le contrôleur d'une séance. */
  affecterControleur: (id: string, controleurId: string | null) =>
    modifier<Seance>(`/seances/${id}/controleur`, { controleurId }),

  /** Annule une séance, avec le motif saisi par le planificateur. */
  annuler: (id: string, motif?: string) => creer<Seance>(`/seances/${id}/annuler`, { motif }),

  /** Modifie une séance planifiée. */
  modifier: (id: string, corps: ModificationSeance) => modifier<Seance>(`/seances/${id}`, corps),

  /** Crée une séance non programmée. */
  creer: (corps: ModificationSeance) => creer<Seance>('/seances', corps),

  /** Génère les séances d'une année à partir de l'emploi du temps. */
  generer: (corps: GenerationSeances) => creer<ResultatGeneration>('/seances/generer', corps),
};
