import { api } from '../boot/axios';
import type {
  CategoriePatrimoine,
  EquipementPatrimoine,
  ReparationMateriel,
  TableauBordPatrimoine,
} from '../types';

/** Réponse paginée du back : `{ data, total, page, pageSize }`. */
interface Page<T> {
  data: T[];
  total: number;
}

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

/**
 * Toutes les requêtes du patrimoine passent par ici. L'écran ne compose plus de
 * chemins d'API à la main : une route qui bouge se corrige à un seul endroit,
 * et l'on voit d'un coup d'œil la surface réellement consommée.
 */
export const patrimoineService = {
  // --- Équipements
  listeEquipements: (filtres: FiltresEquipements = {}) =>
    api.get<Page<EquipementPatrimoine>>('/patrimoine/equipements', { params: filtres }),
  supprimerEquipement: (id: string) => api.delete(`/patrimoine/equipements/${id}`),
  reparationsEquipement: (id: string) =>
    api.get<ReparationMateriel[]>(`/patrimoine/equipements/${id}/reparations`),

  // --- Catégories
  listeCategories: () =>
    api.get<CategoriePatrimoine[] | Page<CategoriePatrimoine>>('/patrimoine/categories', {
      params: { all: '1' },
    }),
  creerCategorie: (payload: Record<string, unknown>) =>
    api.post<CategoriePatrimoine>('/patrimoine/categories', payload),
  modifierCategorie: (id: string, payload: Record<string, unknown>) =>
    api.put<CategoriePatrimoine>(`/patrimoine/categories/${id}`, payload),
  supprimerCategorie: (id: string) => api.delete(`/patrimoine/categories/${id}`),

  // --- Réparations et synthèse
  listeReparations: (filtres: { statut?: string } = {}) =>
    api.get<ReparationMateriel[]>('/patrimoine/reparations', { params: filtres }),
  tableauDeBord: () => api.get<TableauBordPatrimoine>('/patrimoine/dashboard'),
};
