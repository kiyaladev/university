import type { AxiosRequestConfig } from 'axios';
import { api } from '../boot/axios';
import type { Liste } from '../types';

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

/** Paramètres de requête acceptés par les listes (filtres, pagination, `all`). */
export type ParametresListe = Record<string, string | number | boolean | null | undefined>;

/** Liste paginée `{ data, total, page, pageSize }`. */
export async function lister<T>(
  url: string,
  params: ParametresListe = {},
  opts: OptionsRequete = {},
): Promise<Liste<T>> {
  const { data } = await api.get<Liste<T>>(url, { ...opts, params });
  return data;
}

/** Lecture d'une ressource (`GET url`). */
export async function lire<T>(url: string, params?: ParametresListe, opts: OptionsRequete = {}): Promise<T> {
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
