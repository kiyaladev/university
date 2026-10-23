import { creer, lister, modifier, supprimer } from '@/shared/services/http';
import type { AnneeAcademique, AttributionLogement, Chambre, Etudiant, Residence } from '@/types';

/**
 * Cités universitaires : résidences, chambres, attributions de logement et les
 * référentiels qui les accompagnent (années académiques, étudiants).
 *
 * Toutes les pages de la cité parlent à l'API par cette porte : une route qui
 * bouge se corrige à un seul endroit, et la surface réellement consommée se
 * lit d'un coup d'œil.
 */

/** Filtres acceptés par la liste des résidences. */
export interface ParametresResidences {
  all?: string;
  search?: string;
}

/** Filtres acceptés par la liste des chambres. */
export interface ParametresChambres {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  residenceId?: string;
  categorie?: string;
  statut?: string;
}

/** Filtres acceptés par la liste des attributions de logement. */
export interface ParametresAttributions {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  anneeId?: string;
  statut?: string;
  residenceId?: string;
}

/** Champs acceptés à la création ou à la modification d'une résidence. */
export interface CorpsResidence {
  code: string;
  nom: string;
  ville?: string | null;
  adresse?: string | null;
  capacite: number;
  responsable?: string | null;
  actif?: boolean;
}

/** Champs acceptés à la création ou à la modification d'une chambre. */
export interface CorpsChambre {
  code: string;
  residenceId: string;
  categorie: string;
  lits: number;
  loyer: number;
  devise?: string;
  statut?: string;
}

/** Champs acceptés à la création d'une attribution de logement. */
export interface CorpsAttribution {
  chambreId: string;
  etudiantId: string;
  anneeId?: string | null;
  critereScore?: number | null;
  justificatif?: string | null;
}

/** Décision du jury : le backend attend `commentaire` (et non `motif`). */
export interface DecisionAttribution {
  statut: 'ACCORDE' | 'REFUSE';
  commentaire?: string;
}

/** Retrait d'une attribution : le motif est conservé côté serveur. */
export interface RetraitAttribution {
  motif?: string;
}

export const citesService = {
  // --------------------------------------------------------------- résidences
  /** Parc complet des résidences (l'API ne pagine pas cette ressource). */
  listeResidences: (params: ParametresResidences = {}) => lister<Residence>('/residences', params),

  creerResidence: (corps: CorpsResidence) => creer<Residence>('/residences', corps),

  modifierResidence: (id: string, corps: Partial<CorpsResidence>) => modifier<Residence>(`/residences/${id}`, corps),

  supprimerResidence: (id: string) => supprimer(`/residences/${id}`),

  // ----------------------------------------------------------------- chambres
  listeChambres: (params: ParametresChambres = {}) => lister<Chambre>('/chambres', params),

  creerChambre: (corps: CorpsChambre) => creer<Chambre>('/chambres', corps),

  modifierChambre: (id: string, corps: Partial<CorpsChambre>) => modifier<Chambre>(`/chambres/${id}`, corps),

  supprimerChambre: (id: string) => supprimer(`/chambres/${id}`),

  // -------------------------------------------------------------- attributions
  listeAttributions: (params: ParametresAttributions = {}) =>
    lister<AttributionLogement>('/attributions-logement', params),

  creerAttribution: (corps: CorpsAttribution) => creer<AttributionLogement>('/attributions-logement', corps),

  /** Décision du jury sur une demande en attente. */
  deciderAttribution: (id: string, corps: DecisionAttribution) =>
    modifier<AttributionLogement>(`/attributions-logement/${id}/decider`, corps),

  /** Retrait d'une attribution accordée ou en attente. */
  retirerAttribution: (id: string, corps: RetraitAttribution = {}) =>
    modifier<AttributionLogement>(`/attributions-logement/${id}/retirer`, corps),

  // ------------------------------------------------------------- référentiels
  /** Années académiques (toutes, pour les filtres et le dialogue d'attribution). */
  listeAnnees: () => lister<AnneeAcademique>('/annees', { all: '1' }),

  /** Recherche d'un étudiant (matricule, nom…) pour le dialogue d'attribution. */
  rechercherEtudiants: (terme: string) => lister<Etudiant>('/etudiants', { search: terme, all: '1' }),
};
