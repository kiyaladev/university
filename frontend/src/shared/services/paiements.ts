import { creer, lire } from '@/shared/services/http';
import type { Collection } from '@/shared/utils/collections';
import type { Inscription, Paiement } from '@/types';

/**
 * Appels d'API du paiement.
 *
 * Le dialogue de paiement est partagé entre la scolarité et les finances : il
 * ne peut pas s'appuyer sur le service d'un seul domaine. Les écrans des
 * finances s'en servent aussi, pour ne garder qu'un appel par route.
 */

/** Corps d'un paiement de frais d'inscription. */
export interface CorpsPaiement {
  montant: number;
  devise: string;
  mode: string;
  operateur?: string;
  telephone?: string;
  nomComplet?: string;
  motif?: string;
  inscriptionId?: string;
  etudiantId?: string;
}

/** Statut que la simulation tranche un paiement en attente. */
export type StatutSimule = 'REUSSI' | 'ECHOUE';

export const paiementsApi = {
  /** Dossiers d'inscription : le dialogue y cherche le dossier à encaisser. */
  dossiers: () => lire<Collection<Inscription>>('/inscriptions', { all: '1' }),

  /** Enregistre un paiement. */
  creer: (corps: CorpsPaiement) => creer<Paiement>('/paiements', corps),

  /** Tranche un paiement en attente : réussi ou échoué. */
  simuler: (id: string, statut: StatutSimule) => creer<Paiement>(`/paiements/${id}/simuler`, { statut }),
};
