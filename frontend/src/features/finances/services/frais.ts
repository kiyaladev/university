import { creer, lister, modifier, supprimer } from '@/shared/services/http';
import type { Liste } from '@/types';

/**
 * Grille des frais d'inscription (`/frais`).
 *
 * - `GET /frais/gestion` : administration et scolarité — la grille de
 *   gestion, qui montre l'année et la promotion de chaque tarif.
 * - `GET /frais` est public et ne rend que le montant et la devise : il
 *   sert aux formulaires d'inscription, pas à l'administration.
 * - `POST /frais` et `PUT /frais/:id` : administration et scolarité.
 * - `DELETE /frais/:id` : administration seule.
 *
 * Les rôles sont ceux des `@Roles` du contrôleur ; c'est l'API qui tranche.
 */

/** Année et promotion retenues par la grille. */
export interface ParametresFrais {
  anneeId?: string | null;
  promotionId?: string | null;
  page?: number;
  pageSize?: number;
  all?: string;
}

/**
 * Tarif d'inscription, avec le libellé de son année et de sa promotion.
 * `GET /frais` ne rend que ces éléments : il n'expose pas la fiche complète
 * de l'année ni de la promotion.
 */
export interface FraisAvecLibelles {
  id: string;
  anneeId: string;
  promotionId: string;
  montant: number;
  devise: string;
  annee?: { id: string; libelle: string } | null;
  promotion?: { id: string; nom: string; niveau?: string | null } | null;
}

/** Corps attendu par la création et la modification d'un tarif. */
export interface FraisSaisie {
  anneeId: string;
  promotionId: string;
  montant: number;
  devise?: string;
}

/** Rôle autorisé à créer, modifier et supprimer un tarif. */
export const ROLES_GESTION_FRAIS = ['ADMIN', 'SCOLARITE'] as const;

/** Rôle autorisé à supprimer un tarif (l'API ne l'ouvre qu'à l'administration). */
export const ROLES_SUPPRESSION_FRAIS = ['ADMIN'] as const;

export const fraisService = {
  /** Tarifs filtrés par année et/ou promotion. */
  liste: (params: ParametresFrais = {}) => lister<FraisAvecLibelles>('/frais/gestion', params),

  /** Création d'un tarif. */
  creer: (corps: FraisSaisie) => creer<FraisAvecLibelles>('/frais', corps),

  /** Modification d'un tarif. */
  modifier: (id: string, corps: Partial<FraisSaisie>) =>
    modifier<FraisAvecLibelles>(`/frais/${id}`, corps),

  /** Suppression d'un tarif. */
  supprimer: (id: string) => supprimer(`/frais/${id}`),
};

/** Année et promotion telles qu'affichées dans la grille. */
export function libellesFrais(frais: FraisAvecLibelles): { annee: string; promotion: string } {
  return {
    annee: frais.annee?.libelle ?? '—',
    promotion: frais.promotion?.nom ?? '—',
  };
}

/** Ligne de la grille : le tarif, son année et sa promotion dans un seul objet. */
export function ligneFrais(frais: FraisAvecLibelles) {
  const { annee, promotion } = libellesFrais(frais);
  return { ...frais, anneeLibelle: annee, promotionLibelle: promotion };
}

export type LigneFrais = ReturnType<typeof ligneFrais>;

/** Les filtres vides ne sont pas transmis : l'API les attend absents. */
export function filtresFrais(filtres: { anneeId?: string | null; promotionId?: string | null }): ParametresFrais {
  return {
    ...(filtres.anneeId ? { anneeId: filtres.anneeId } : {}),
    ...(filtres.promotionId ? { promotionId: filtres.promotionId } : {}),
  };
}

export type PageFrais = Liste<FraisAvecLibelles>;
