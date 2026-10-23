import { creer, lister, modifier } from '@/shared/services/http';
import type { AnneeAcademique, Departement, Filiere, Niveau, Promotion } from '@/types';

/**
 * Structure académique : années, départements, filières et promotions.
 *
 * Les années, départements et promotions sont lus par le store des
 * référentiels (partagés avec les autres écrans) ; les filières sont lues
 * ici, en une seule requête, avec `?all=1`.
 *
 * Les créations et modifications passent par une fonction par ressource :
 * l'URL n'est plus écrite à la main dans les pages.
 */

/** Le backend joint l'année académique aux promotions. */
export interface PromotionListee extends Promotion {
  annee?: AnneeAcademique | null;
}

/** Corps accepté par la création et la modification d'une année. */
export interface AnneeSaisie {
  libelle: string;
  dateDebut?: string;
  dateFin?: string;
  active?: boolean;
}

/** Corps accepté par la création et la modification d'un département. */
export interface DepartementSaisie {
  code: string;
  nom: string;
  faculte?: string;
}

/** Corps accepté par la création et la modification d'une filière. */
export interface FiliereSaisie {
  code: string;
  nom: string;
  departementId: string;
}

/** Corps accepté par la création et la modification d'une promotion. */
export interface PromotionSaisie {
  nom: string;
  niveau: Niveau;
  effectif?: number;
  filiereId: string;
  anneeId: string;
}

export const structureService = {
  /** Filières du référentiel, toutes confondues (`?all=1`). */
  filieres: () => lister<Filiere>('/filieres', { all: '1' }),

  /** Création d'une année académique. */
  creerAnnee: (corps: AnneeSaisie) => creer<AnneeAcademique>('/annees', corps),

  /** Modification d'une année académique. */
  modifierAnnee: (id: string, corps: Partial<AnneeSaisie>) => modifier<AnneeAcademique>(`/annees/${id}`, corps),

  /** Création d'un département. */
  creerDepartement: (corps: DepartementSaisie) => creer<Departement>('/departements', corps),

  /** Modification d'un département. */
  modifierDepartement: (id: string, corps: Partial<DepartementSaisie>) =>
    modifier<Departement>(`/departements/${id}`, corps),

  /** Création d'une filière. */
  creerFiliere: (corps: FiliereSaisie) => creer<Filiere>('/filieres', corps),

  /** Modification d'une filière. */
  modifierFiliere: (id: string, corps: Partial<FiliereSaisie>) => modifier<Filiere>(`/filieres/${id}`, corps),

  /** Création d'une promotion. */
  creerPromotion: (corps: PromotionSaisie) => creer<PromotionListee>('/promotions', corps),

  /** Modification d'une promotion. */
  modifierPromotion: (id: string, corps: Partial<PromotionSaisie>) =>
    modifier<PromotionListee>(`/promotions/${id}`, corps),
};
