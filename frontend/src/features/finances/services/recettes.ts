import { creer, lire, lister, modifier } from '@/shared/services/http';
import type { RecetteExterne, TypeRecette } from '@/types';

/**
 * Recettes propres (`/recettes`).
 *
 * - `GET /recettes` : registre paginé, filtrable par recherche, type, statut de
 *   paiement et période.
 * - `GET /recettes/dashboard` : totaux du mois, de l'année et top 3 des types.
 * - `POST /recettes` et `PUT /recettes/:id` : émission et modification d'une
 *   recette.
 * - `POST /recettes/:id/encaisser` : la recette devient un paiement encaissé.
 */

/** Totaux affichés en tête de l'écran des recettes. */
export interface KpisRecettes {
  annee: number;
  totalMois: number;
  totalAnnee: number;
  top3: Array<{ type: string; total: number }>;
}

/** Corps d'une recette, sans son numéro (réservé à la création). */
export interface RecetteSaisie {
  type: TypeRecette;
  libelle: string;
  description: string | null;
  montant: number;
  devise: string;
  date: string;
  client: string | null;
  factureNum: string | null;
}

/** Paramètres acceptés par le registre des recettes. */
export interface ParametresRecettes {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
  type?: string;
  paiementStatut?: string;
  dateDebut?: string;
  dateFin?: string;
}

export const recettesService = {
  /** Registre paginé des recettes. */
  liste: (params: ParametresRecettes = {}) => lister<RecetteExterne>('/recettes', params),

  /** Totaux du tableau de bord des recettes. */
  dashboard: () => lire<KpisRecettes>('/recettes/dashboard'),

  /** Émission d'une recette : le numéro est choisi par l'utilisateur. */
  creer: (corps: RecetteSaisie & { numero: string }) => creer<RecetteExterne>('/recettes', corps),

  /** Modification d'une recette. */
  modifier: (id: string, corps: RecetteSaisie) => modifier<RecetteExterne>(`/recettes/${id}`, corps),

  /** Encaissement d'une recette : elle rejoint le registre des paiements. */
  encaisser: (id: string) => creer<RecetteExterne>(`/recettes/${id}/encaisser`, {}),
};
