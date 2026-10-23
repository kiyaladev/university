/** Types communs : puces de filtre et réponse paginée de l’API. */

/**
 * Puce de rappel d'un filtre actif, affichée par `shared/components/BarreFiltres.vue`.
 *
 * `cle` nomme le filtre d'où vient la puce : sans elle, la barre ne sait pas
 * quoi effacer au clic sur la croix et n'affiche donc pas de croix du tout.
 * `defaut` désigne la puce de la recherche globale, dont la clé est connue.
 */
export interface ChipFiltre {
  label: string;
  value: unknown;
  icone?: string;
  cle?: string;
  defaut?: boolean;
}

/**
 * Réponse d'une route de liste du back : `{ data, total, page, pageSize }`,
 * y compris avec `?all=1`.
 *
 * Toutes les routes rendent `data`, mais la pagination n'y est pas
 * systématique : certaines n'annoncent que `{ data }`. Les champs de
 * pagination sont donc facultatifs.
 */
export interface Liste<T> {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}
