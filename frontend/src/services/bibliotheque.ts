import { api } from '../boot/axios';
import type { DocumentDepot } from '../types';

/**
 * Fonds documentaire : un seul point d'entrée pour la page publique et pour
 * l'écran de gestion, afin que les deux voient le même objet de la même façon.
 *
 * Deux routes coexistent côté serveur :
 *  - `/documents`            : liste filtrée (le visiteur anonyme ne reçoit que
 *                             les documents publiés) ;
 *  - `/documents/recherche`  : recherche plein texte — le paramètre `q` y est
 *                             OBLIGATOIRE, un appel sans terme est rejeté.
 * `rechercher()` choisit donc la bonne route selon qu'un terme est saisi.
 */

/** Le backend renvoie `{ data, total }` ; certaines routes renvoient un tableau nu. */
export type ReponseDocuments =
  | { data?: DocumentDepot[]; total?: number }
  | DocumentDepot[];

export interface ResultatDocuments {
  liste: DocumentDepot[];
  total: number;
}

/** Ramène les deux formes de réponse à une liste + un total exploitables. */
export function normaliserDocuments(reponse: ReponseDocuments): ResultatDocuments {
  if (Array.isArray(reponse)) return { liste: reponse, total: reponse.length };
  const liste = reponse.data ?? [];
  return { liste, total: reponse.total ?? liste.length };
}

type Params = Record<string, unknown>;

/** `silencieux` : erreur non notifiée (la vitrine publique ne crie pas). */
const config = (params: Params, silencieux: boolean) => ({ params, silencieux });

export const bibliothequeService = {
  liste: (params: Params = {}, silencieux = false) =>
    api.get<ReponseDocuments>('/documents', config(params, silencieux)),

  rechercheFts: (params: Params & { q: string }, silencieux = false) =>
    api.get<ReponseDocuments>('/documents/recherche', config(params, silencieux)),

  /** Liste ou recherche plein texte selon la présence d'un terme. */
  rechercher: (terme: string, params: Params = {}, silencieux = false) => {
    const q = terme.trim();
    return q
      ? bibliothequeService.rechercheFts({ ...params, q }, silencieux)
      : bibliothequeService.liste(params, silencieux);
  },

  detail: (id: string) => api.get<DocumentDepot>(`/documents/${id}`),

  /** Téléchargement du fichier joint (compte un téléchargement côté serveur). */
  fichier: (id: string, silencieux = false) =>
    api.get<Blob>(`/documents/${id}/fichier`, {
      responseType: 'blob',
      timeout: 60000,
      silencieux,
    }),

  modifier: (id: string, corps: Record<string, unknown>) =>
    api.put<DocumentDepot>(`/documents/${id}`, corps),

  supprimer: (id: string) => api.delete<void>(`/documents/${id}`),

  recalculerPlagiat: () => api.post('/documents/recalculer-plagiat', {}),
};
