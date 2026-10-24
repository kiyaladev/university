/**
 * Types de présentation du domaine présence.
 *
 * Les types de données (séance, contrôle, justificatif…) viennent de
 * `shared/types`. Ici ne vivent que les formes propres aux écrans de ce
 * domaine : ce qu'un relevé affiche, comment une liste se présente.
 */

/** Un chiffre de relevé : son libellé et sa valeur, déjà mise en forme. */
export interface ChiffreReleve {
  label: string;
  valeur: string | number;
}

/** Comment une liste se présente : en cartes ou en tableau. */
export type VueListe = 'cartes' | 'tableau';

/** Un chiffre du panneau : son intitulé, son détail et sa valeur. */
export interface KpiTableauBord {
  libelle: string;
  valeur: string | number;
  detail: string;
}
