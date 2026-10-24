/** Tableau de bord Rectorat & Patrimoine. */

import type { AnneeAcademique, Departement, Salle } from './referentiels';

/** Énumération générée depuis le schéma Prisma (voir `types/generated/enums.ts`). */
import type { StatutReparation } from './generated/enums';

export type { StatutReparation } from './generated/enums';

export interface CategoriePatrimoine {
  id: string;
  code: string;
  libelle: string;
  dureeAmortissement?: number | null;
  actif: boolean;
  _count?: { equipements: number };
}

export interface EquipementPatrimoine {
  id: string;
  numeroSerie: string;
  libelle: string;
  categorieId: string;
  categorie?: Pick<CategoriePatrimoine, 'id' | 'code' | 'libelle'>;
  departementId?: string | null;
  departement?: Pick<Departement, 'id' | 'code' | 'nom'> | null;
  salleId?: string | null;
  salle?: Pick<Salle, 'id' | 'code' | 'nom'> | null;
  dateAcquisition?: string | null;
  valeurAcquisition?: number | null;
  numeroInventaire: string;
  qrCode: string;
  actif: boolean;
  enReparation: boolean;
  obsolescenceMois?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { reparations: number; tickets: number };
}

export interface ReparationMateriel {
  id: string;
  equipementId: string;
  equipement?: Pick<EquipementPatrimoine, 'id' | 'libelle' | 'numeroInventaire'>;
  dateDeclaration: string;
  description: string;
  prestataire?: string | null;
  cout: number;
  statut: StatutReparation;
  dateResolution?: string | null;
  declareParId?: string | null;
  declarePar?: { id: string; nom: string; prenom: string } | null;
  resoluParId?: string | null;
  resoluPar?: { id: string; nom: string; prenom: string } | null;
  notes?: string | null;
}

export interface StatistiqueMesrs {
  id: string;
  anneeId: string;
  annee?: Pick<AnneeAcademique, 'id' | 'libelle'>;
  /**
   * Snapshot des chiffres au moment de la génération.
   *
   * Sa forme suit celle que le Rectorat agrège (effectif, taux de réussite,
   * masse salariale, patrimoine…) : elle évolue avec le backend, d'où un
   * objet libre plutôt qu'un contrat figé côté front.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la forme du snapshot suit les agrégats du backend
  donnees: any;
  genereLe: string;
  genereParId?: string | null;
  generePar?: { id: string; nom: string; prenom: string } | null;
}

export interface TableauBordRectorat {
  annee: { id: string; libelle: string } | null;
  effectifTotal: number;
  effectifParPromotion: Array<{
    promotionId: string;
    effectif: number;
    nom: string;
    niveau?: string | null;
    filiere?: { id: string; code: string; nom: string } | null;
  }>;
  tauxReussite: number;
  masseSalariale: number;
  masseSalarialeMois: string;
  nbEnseignants: number;
  nbVacataires: number;
  nbReclamationsEnCours: number;
  nbIncidentsHelpdesk24h: number;
}

export interface TableauBordPatrimoine {
  total: number;
  valeur: number;
  enReparation: number;
  obsoletes: number;
  parCategorie: Array<{ code: string; libelle: string; nombre: number; valeur: number }>;
  parDepartement: Array<{ code: string; nom: string; nombre: number; valeur: number }>;
}
