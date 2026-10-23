/** Portail étudiant : dossier, résultats et portefeuille restauration. */

import { creer, lire, type OptionsRequete } from '@/shared/services/http';
import type { LigneResultat, PortailProfil } from '@/features/scolarite/types';

/** Réponse de `/portail/resultats`. */
export interface ResultatsPortail {
  deliberations: LigneResultat[];
  finale: LigneResultat | null;
}

/** Réponse de `/portail/resto/recharger`. */
export interface RechargeResto {
  instructions?: string | null;
  paiement?: { id: string; reference: string; montant: number; devise: string };
}

/** Charge utile d'une recharge de portefeuille resto. */
export interface RechargeRestoEntree {
  montant: number;
  mode: string;
  operateur: string;
}

export const portailService = {
  /** Dossier de l'étudiant connecté. */
  profil(opts: OptionsRequete = {}) {
    return lire<PortailProfil>('/portail/me', undefined, opts);
  },

  /** Résultats des délibérations de l'étudiant. */
  resultats(opts: OptionsRequete = {}) {
    return lire<ResultatsPortail>('/portail/resultats', undefined, opts);
  },

  /** Portefeuille restauration de l'étudiant. */
  resto(opts: OptionsRequete = {}) {
    return lire<Record<string, unknown>>('/portail/resto/me', undefined, opts);
  },

  /** Recharge le portefeuille restauration. */
  rechargerResto(corps: RechargeRestoEntree, opts: OptionsRequete = {}) {
    return creer<RechargeResto>('/portail/resto/recharger', corps, opts);
  },
};
