/** Types communs : puces de filtre et réponse paginée de l'API. */

/**
 * Filtres d'une page.
 *
 * Les clés sont connues de la seule page (année, promotion, statut…) : les
 * composants qui les manipulent — la barre de filtres, les listes paginées —
 * les traitent comme des données libres. D'où un type volontairement large,
 * dont la forme précise est portée par la page qui le déclare.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la forme des filtres est propre à chaque page
export type FiltresPage = Record<string, any>;

/**
 * Valeur d'un filtre : un scalaire, une liste de scalaires, ou rien.
 *
 * Une valeur vide (`''`, `null`, `undefined`, liste vide) efface le filtre :
 * c'est ce que fait la barre de filtres quand on décoche une puce.
 */
export type ValeurFiltre = string | number | boolean | null | undefined | Array<string | number | boolean>;

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
