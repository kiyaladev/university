import { creer, lister } from '@/shared/services/http';
import type {
  ConsommationResto,
  PortefeuilleResto,
  RechargeResto,
  ResultatRecharge,
  ResultatValidationRepas,
} from '../types';

/**
 * Resta universitaire : le guichet (validation d'un repas), les portefeuilles
 * des étudiants et le journal des transactions.
 */

/** Filtres acceptés par la liste des portefeuilles. */
export interface ParametresPortefeuilles {
  page?: number;
  pageSize?: number;
  all?: string;
  search?: string;
}

/** Filtres acceptés par la liste des consommations et des recharges. */
export interface ParametresFlux {
  dateDebut?: string;
  dateFin?: string;
  pageSize?: number;
  cantine?: string;
  statut?: string;
}

/** Champs acceptés au guichet pour valider un repas. */
export interface ValidationRepas {
  reference: string;
  repas: string;
  montant: number;
  cantine?: string;
}

/** Champs acceptés pour recharger un portefeuille. */
export interface CorpsRecharge {
  montant: number;
  mode?: string;
  reference?: string;
  [cle: string]: unknown;
}

export const restoService = {
  // ---------------------------------------------------------------- guichet
  /**
   * Validation d'un repas au guichet.
   *
   * Silencieuse : le guichet affiche lui-même le motif du refus (solde
   * insuffisant, référence inconnue) dans son bandeau de résultat.
   */
  validerRepas: (corps: ValidationRepas) =>
    creer<ResultatValidationRepas>('/resto/valider', corps, { silencieux: true }),

  // ----------------------------------------------------------- portefeuilles
  listePortefeuilles: (params: ParametresPortefeuilles = {}) =>
    lister<PortefeuilleResto>('/resto/portefeuilles', { ...params }),

  /** Recharge d'un portefeuille : immédiate (compte) ou en attente de paiement. */
  recharger: (id: string, corps: CorpsRecharge) =>
    creer<ResultatRecharge>(`/resto/portefeuilles/${id}/recharger`, corps),

  // -------------------------------------------------------------- transactions
  listeConsommations: (params: ParametresFlux = {}) => lister<ConsommationResto>('/resto/consommations', { ...params }),

  listeRecharges: (params: ParametresFlux = {}) => lister<RechargeResto>('/resto/recharges', { ...params }),

  /** Annulation d'une consommation (remboursement au guichet). */
  annulerConsommation: (id: string, motif: string) => creer<void>(`/resto/consommations/${id}/annuler`, { motif }),
};
