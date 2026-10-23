/** Réclamations : registre, traitement, escalade et clôture. */

import { creer, lire, lister, modifier, type OptionsRequete, type ParametresListe } from '@/shared/services/http';
import { elements, type Collection } from './collections';
import type { Reclamation } from '@/types';
import type { Utilisateur } from '@/types';

/** Compteurs du tableau de bord des réclamations. */
export interface TableauBordReclamations {
  ouvertes?: number;
  enCours?: number;
  resolues?: number;
  escaladees?: number;
  [cle: string]: number | undefined;
}

export const reclamationsService = {
  /** Registre paginé des réclamations. */
  liste(params: ParametresListe = {}) {
    return lister<Reclamation>('/reclamations', params);
  },

  /** Réclamations de l'étudiant connecté (vue étudiante). */
  mesReclamations(params: ParametresListe = {}) {
    return lister<Reclamation>('/reclamations/me', params);
  },

  /** Fiche d'une réclamation, avec ses messages. */
  lire(id: string) {
    return lire<Reclamation>(`/reclamations/${id}`);
  },

  /** Compteurs du tableau de bord. */
  tableauBord(opts: OptionsRequete = {}) {
    return lire<TableauBordReclamations>('/reclamations/dashboard', undefined, opts);
  },

  /** Agents habilités à traiter une réclamation. */
  agents() {
    return lire<Collection<Utilisateur>>('/reclamations/agents').then(elements);
  },

  /** Dépose une réclamation. */
  creer(payload: unknown, opts: OptionsRequete = {}) {
    return creer<Reclamation>('/reclamations', payload, opts);
  },

  /** Ajoute un message au fil de discussion. */
  ajouterMessage(id: string, contenu: string) {
    return creer<Reclamation>(`/reclamations/${id}/messages`, { contenu });
  },

  /** Change le statut d'une réclamation. */
  changerStatut(id: string, statut: string, commentaire?: string) {
    return modifier<Reclamation>(`/reclamations/${id}/statut`, {
      statut,
      ...(commentaire ? { commentaire } : {}),
    });
  },

  /** Assigne une réclamation à un agent. */
  assigner(id: string, assigneAId: string) {
    return modifier<Reclamation>(`/reclamations/${id}/assigner`, { assigneAId });
  },

  /** Escalade une réclamation au niveau supérieur. */
  escalader(id: string) {
    return creer<Reclamation>(`/reclamations/${id}/escalader`);
  },

  /** Clôture une réclamation avec une note. */
  cloturer(id: string, noteCloture: string) {
    return creer<Reclamation>(`/reclamations/${id}/cloturer`, { noteCloture });
  },
};
