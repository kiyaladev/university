import type { AxiosRequestConfig } from 'axios';
import { api } from '@/boot/axios';
import type { Liste } from '@/types';

/**
 * Accès HTTP typé et générique, au-dessus de l'instance `api` de boot/axios.
 *
 * Ces fonctions renvoient directement le corps de la réponse (et non la
 * réponse axios) : l'appelant n'a plus à écrire `const { data } = …` ni à
 * deviner la forme du résultat. Les erreurs remontent telles quelles ; c'est
 * l'intercepteur de boot/axios qui les notifie, sauf si l'option `silencieux`
 * est passée, auquel cas l'appelant se charge lui-même de les dire.
 */
export type OptionsRequete = Pick<AxiosRequestConfig, 'silencieux' | 'signal' | 'timeout' | 'headers'>;

/** Valeur de paramètre de requête acceptée par l'API. */
export type ValeurParametre = string | number | boolean | null | undefined;

/**
 * Paramètres de requête des listes (filtres, pagination, `all`).
 *
 * Chaque service déclare ses propres filtres — le plus souvent une interface
 * — et la passe telle quelle : le type des paramètres est générique (`P`),
 * pour que ces interfaces soient acceptées sans copie ni index signature.
 * Les valeurs restent des primitives : c'est le contrat de l'API, et chaque
 * service le déclare dans le type de ses propres paramètres.
 */
export type ParametresListe = Record<string, ValeurParametre>;

/**
 * Liste paginée `{ data, total, page, pageSize }`.
 *
 * La pagination est facultative : le back ne l'annonce pas sur toutes ses
 * routes de liste. Certaines routes rendent même un tableau nu : `Collection`
 * (shared/utils/collections) décrit ces deux formes.
 */
export async function lister<T, P extends object = object>(
  url: string,
  params?: P,
  opts: OptionsRequete = {},
): Promise<Liste<T>> {
  const { data } = await api.get<Liste<T>>(url, { ...opts, params });
  return data;
}

/** Lecture d'une ressource (`GET url`). */
export async function lire<T, P extends object = object>(
  url: string,
  params?: P,
  opts: OptionsRequete = {},
): Promise<T> {
  const { data } = await api.get<T>(url, { ...opts, params });
  return data;
}

/** Création (`POST url`). */
export async function creer<T, C = unknown>(url: string, corps?: C, opts: OptionsRequete = {}): Promise<T> {
  const { data } = await api.post<T>(url, corps, opts);
  return data;
}

/** Modification (`PUT url`). */
export async function modifier<T, C = unknown>(url: string, corps?: C, opts: OptionsRequete = {}): Promise<T> {
  const { data } = await api.put<T>(url, corps, opts);
  return data;
}

/** Suppression (`DELETE url`). */
export async function supprimer(url: string, opts: OptionsRequete = {}): Promise<void> {
  await api.delete(url, opts);
}

/**
 * Lecture d'un fichier binaire (`GET url`, réponse `blob`).
 *
 * Un PDF n'est pas du JSON : la lecture passe par ici plutôt que par
 * `lire`, qui rend le corps de la réponse tel quel.
 */
export async function lireBlob<P extends object = object>(
  url: string,
  params?: P,
  opts: OptionsRequete = {},
): Promise<Blob> {
  const { data } = await api.get<Blob>(url, { ...opts, params, responseType: 'blob' });
  return data;
}

/**
 * Création d'un fichier binaire (`POST url`, réponse `blob`).
 *
 * Même usage que `lireBlob`, pour les fichiers produits par le serveur :
 * un relevé hebdomadaire, par exemple.
 */
export async function creerBlob<C = unknown>(url: string, corps?: C, opts: OptionsRequete = {}): Promise<Blob> {
  const { data } = await api.post<Blob>(url, corps, { ...opts, responseType: 'blob' });
  return data;
}
