import { i18n } from '@/boot/i18n';

/**
 * Table de libellés traduite à la lecture : chaque clé lit `libelles.<namespace>.<clé>`
 * dans le catalogue vue-i18n et retombe sur le français fourni quand la clé manque.
 */
export function traduireLibelles<T extends Record<string, string>>(namespace: string, valeurs: T): T {
  return Object.defineProperties({}, Object.fromEntries(Object.entries(valeurs).map(([cle, valeur]) => [cle, {
    enumerable: true, get: () => { const message = `libelles.${namespace}.${cle}`; return i18n.global.te(message) ? i18n.global.t(message) : valeur; },
  }]))) as T;
}

/** Options prêtes pour un `q-select` (`emit-value` / `map-options`). */
export function optionsDepuis(libelles: Record<string, string>) {
  return Object.entries(libelles).map(([value, label]) => ({ value, label }));
}
