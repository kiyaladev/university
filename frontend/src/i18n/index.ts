/**
 * Chargement des catalogues de traduction.
 *
 * Les deux langues ensemble pesaient plus de 400 Ko : le morceau principal
 * les emportait toutes les deux, alors qu'un poste n'en lit qu'une à la fois.
 * Chaque langue a donc son propre point d'entrée (`fr-FR/index.ts`,
 * `en-US/index.ts`) chargé à la demande : celui de la langue active au
 * démarrage, l'autre au moment où l'on change de langue.
 *
 * Rien ne doit importer ces catalogues statiquement : le chargement passe
 * par `chargerMessages`.
 */

export type AppLocale = 'fr-FR' | 'en-US';

/** Les langues disponibles, dans l'ordre de la préférence. */
export const LOCALES: readonly AppLocale[] = ['fr-FR', 'en-US'];

const CHARGEURS: Record<AppLocale, () => Promise<Record<string, unknown>>> = {
  'fr-FR': () => import('./fr-FR/index').then((m) => m.default),
  'en-US': () => import('./en-US/index').then((m) => m.default),
};

/** Messages d'une langue, chargés à la demande. */
export function chargerMessages(locale: AppLocale): Promise<Record<string, unknown>> {
  return CHARGEURS[locale]();
}
