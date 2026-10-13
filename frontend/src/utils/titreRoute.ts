import { i18n } from '../boot/i18n';

/**
 * Traduit le titre d'une route. `meta.titre` porte une clé (`nav.controle`), pas
 * un texte : le bandeau, l'onglet du navigateur et le message de refus de la
 * garde de routes doivent tous suivre la langue choisie, et trois littéraux
 * français se recopiant ne le peuvent pas.
 *
 * Si la clé manque, on rend la clé elle-même plutôt que `undefined` : c'est
 * bruyant mais repérable, là où un vide donnerait un bandeau muet.
 */
export function titreRoute(cle?: string): string {
  if (!cle) return '';
  if (!i18n.global.te(cle)) return cle;
  return i18n.global.t(cle) as unknown as string;
}
