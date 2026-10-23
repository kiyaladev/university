import { creer, lire, lister, modifier, supprimer } from '@/shared/services/http';
import type {
  CategoriePatrimoine,
  EquipementPatrimoine,
  Liste,
  ReparationMateriel,
  TableauBordPatrimoine,
} from '@/types';

/**
 * Toutes les requêtes du patrimoine passent par ici. L'écran ne compose plus de
 * chemins d'API à la main : une route qui bouge se corrige à un seul endroit,
 * et l'on voit d'un coup d'œil la surface réellement consommée.
 */

/** Filtres acceptés par la liste des équipements. */
export interface FiltresEquipements {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  categorieId?: string;
  departementId?: string;
  actif?: string;
  enReparation?: string;
}

/** Champs acceptés à la création ou à la modification d'un équipement. */
export interface CorpsEquipementPatrimoine {
  libelle: string;
  numeroSerie: string;
  numeroInventaire: string;
  categorieId: string;
  departementId?: string | null;
  salleId?: string | null;
  dateAcquisition?: string | null;
  valeurAcquisition?: number | null;
  obsolescenceMois?: number | null;
  actif?: string | boolean;
}

/** Champs acceptés pour déclarer une réparation. */
export interface CorpsReparation {
  description: string;
  prestataire?: string;
  cout?: number;
  dateResolution?: string;
}

/** Champs acceptés pour clore une réparation. */
export interface ResolutionReparation {
  noteResolution?: string;
}

export const patrimoineService = {
  // --- Équipements
  listeEquipements: (filtres: FiltresEquipements = {}) =>
    lister<EquipementPatrimoine>('/patrimoine/equipements', filtres),

  creerEquipement: (corps: CorpsEquipementPatrimoine) => creer<EquipementPatrimoine>('/patrimoine/equipements', corps),

  modifierEquipement: (id: string, corps: Partial<CorpsEquipementPatrimoine>) =>
    modifier<EquipementPatrimoine>(`/patrimoine/equipements/${id}`, corps),

  supprimerEquipement: (id: string) => supprimer(`/patrimoine/equipements/${id}`),

  reparationsEquipement: (id: string) => lire<ReparationMateriel[]>(`/patrimoine/equipements/${id}/reparations`),

  // --- Réparations
  /** Déclare une réparation sur un équipement. */
  declarerReparation: (equipementId: string, corps: CorpsReparation) =>
    creer<ReparationMateriel>(`/patrimoine/equipements/${equipementId}/reparation`, corps),

  /** Clôture une réparation (note de résolution facultative). */
  resoudreReparation: (equipementId: string, corps: ResolutionReparation = {}) =>
    creer<ReparationMateriel>(`/patrimoine/equipements/${equipementId}/reparation/resoudre`, corps),

  // --- Catégories
  listeCategories: () =>
    lire<CategoriePatrimoine[] | Liste<CategoriePatrimoine>>('/patrimoine/categories', { all: '1' }),

  creerCategorie: (payload: Record<string, unknown>) =>
    creer<CategoriePatrimoine>('/patrimoine/categories', payload),

  modifierCategorie: (id: string, payload: Record<string, unknown>) =>
    modifier<CategoriePatrimoine>(`/patrimoine/categories/${id}`, payload),

  supprimerCategorie: (id: string) => supprimer(`/patrimoine/categories/${id}`),

  // --- Réparations et synthèse
  listeReparations: (filtres: { statut?: string } = {}) =>
    lire<ReparationMateriel[]>('/patrimoine/reparations', filtres),

  tableauDeBord: () => lire<TableauBordPatrimoine>('/patrimoine/dashboard'),
};
