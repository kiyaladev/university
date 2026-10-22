import type { Paginated } from './dto';

/**
 * Pagination commune des listes (`?page=`, `?pageSize=`, `?all=`).
 *
 * Reprend à l'identique le bloc recopié dans les services :
 * - `page` vaut 1 par défaut ;
 * - `pageSize` vaut 50 par défaut, 1 000 avec `all`, borné à [1, 1000] ;
 * - `all=true|1` lit la première tranche de 1 000 lignes (raccourci borné
 *   pour les listes déroulantes) et la réponse annonce alors `page: 1` et
 *   `pageSize: min(total, pageSize)`.
 */
export interface Pagination {
  /** Fragment `skip`/`take` à passer tel quel à `findMany`. */
  skip: number;
  take: number;
  /** Page demandée (ignorée en mode « tout »). */
  page: number;
  pageSize: number;
  /** `?all=true|1` : toute la liste, dans la limite de `pageSize`. */
  tout: boolean;
}

export interface ParametresPagination {
  page?: number | string;
  pageSize?: number | string;
  all?: string;
}

export function paginer(query: ParametresPagination = {}): Pagination {
  const page = Number(query.page ?? 1);
  const tout = query.all === 'true' || query.all === '1';
  const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (tout ? 1000 : 50))));
  return {
    skip: tout ? 0 : (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
    tout,
  };
}

/** Forme de réponse `{ data, total, page, pageSize }` des listes paginées. */
export function pagine<T>(data: T[], total: number, pagination: Pagination): Paginated<T> {
  const { tout, page, pageSize } = pagination;
  return { data, total, page: tout ? 1 : page, pageSize: tout ? Math.min(total, pageSize) : pageSize };
}
