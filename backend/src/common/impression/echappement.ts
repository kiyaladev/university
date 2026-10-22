/**
 * Échappement des valeurs injectées dans les documents imprimables.
 *
 * L'implémentation unique reste `echapper` de `common/utils` : elle est
 * réexportée ici pour que les gabarits n'aient qu'un point d'import. Règle
 * des gabarits : une valeur métier est échappée une fois, au moment où elle
 * entre dans le HTML ; un fragment déjà construit (tableau, en-tête) est
 * transmis tel quel. `pageA4` échappe lui-même le titre, la langue et le nom
 * de l'établissement : on lui passe donc ces trois valeurs en texte brut.
 */
import { echapper } from '../utils';

export { echapper };

/** Bloc d'indicateurs (libellé + valeur) des états imprimés : les deux
 *  parties sont des valeurs brutes, échappées ici. */
export function blocIndicateurs(items: Array<[string, string | number]>): string {
  return `<div class="kpis">${items
    .map(([l, v]) => `<div class="kpi"><span>${echapper(l)}</span><strong>${echapper(v)}</strong></div>`)
    .join('')}</div>`;
}
