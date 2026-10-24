/**
 * Colonnes de tableaux, pour les vues en carte.
 *
 * Le `q-table` en mode `grid` expose ses colonnes (`p.cols`) sans type : le
 * trieur de la carte doit donc connaître la forme de la colonne qu'il reçoit.
 */

/** Une colonne de tableau, avec la valeur qu'elle porte pour la ligne courante. */
export interface ColonneTableau {
  name?: string;
  label?: string;
  value?: string | number | boolean | null;
}

/**
 * Colonnes affichées dans une carte : la colonne d'actions n'a pas de
 * contenu à y montrer (les boutons y sont rendus à part).
 */
export function colonnesSansActions(colonnes: ColonneTableau[]): ColonneTableau[] {
  return colonnes.filter((colonne) => colonne.name !== 'actions');
}
