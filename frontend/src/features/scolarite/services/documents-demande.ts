/** Demandes de documents : registre, workflow, tarifs et paiement. */

import { creer, lire, lister, type OptionsRequete, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from './collections';
import type { DemandeDocument, TarifDemande } from '@/types';

/** Compteurs du tableau de bord des demandes de documents. */
export interface TableauBordDemandes {
  EN_ATTENTE_PAIEMENT?: number;
  PAYE?: number;
  EN_TRAITEMENT?: number;
  PRET?: number;
  REMISE?: number;
  REJETE?: number;
  pretesNonRemises?: number;
  [cle: string]: number | undefined;
}

/** Actions de workflow d'une demande. */
export type ActionDemandeDocument =
  | 'confirmer-paiement'
  | 'lancer-traitement'
  | 'prete'
  | 'remettre'
  | 'rejeter';

export const demandesDocumentsService = {
  /** Registre paginé des demandes. */
  liste(params: ParametresListe = {}) {
    return lister<DemandeDocument>('/documents-demande', params);
  },

  /** Demandes de l'étudiant connecté. */
  mesDemandes(params: ParametresListe = {}) {
    return lister<DemandeDocument>('/documents-demande/mes', params);
  },

  /** Fiche d'une demande. */
  lire(id: string) {
    return lire<DemandeDocument>(`/documents-demande/${id}`);
  },

  /** Compteurs du tableau de bord. */
  tableauBord(opts: OptionsRequete = {}) {
    return lire<TableauBordDemandes>('/documents-demande/dashboard', undefined, opts);
  },

  /** Tarifs appliqués aux types de documents. */
  tarifs() {
    return lire<Collection<TarifDemande>>('/documents-demande/tarifs').then(elements);
  },

  /** Dépose une demande de document. */
  creer(payload: unknown, opts: OptionsRequete = {}) {
    return creer<DemandeDocument>('/documents-demande', payload, opts);
  },

  /** Action de workflow sur une demande. */
  action(id: string, action: ActionDemandeDocument, corps: unknown = {}) {
    return creer<DemandeDocument>(`/documents-demande/${id}/${action}`, corps);
  },

  /** Lance le paiement d'une demande. */
  payer(id: string, corps: unknown, opts: OptionsRequete = {}) {
    return creer<DemandeDocument>(`/documents-demande/${id}/payer`, corps, opts);
  },
};
