/**
 * Transformateurs de validation partagés.
 *
 * Un paramètre de requête arrive toujours en chaîne : `?actif=false` donne
 * « false », jamais le booléen `false`. Or la conversion implicite de
 * class-transformer applique `Boolean('false')` à une propriété typée
 * `boolean` — donc `true`. Le filtre « résidences inactives » demandait
 * « actives », et rien ne le signalait.
 *
 * Un transformateur explicif lit la valeur **brute** de l'objet source et la
 * traduit. Quand la valeur n'est pas convertible, elle est laissée telle quelle :
 * la validation (`@IsBoolean`) la refuse alors en 400, ce qui vaut mieux
 * qu'un `true` silencieux.
 */
import { Transform } from 'class-transformer';

/** Textes admis pour « vrai », en français comme en anglais. */
const TEXTES_VRAI = ['true', '1', 'oui', 'yes', 'on'];

/** Textes admis pour « faux », en français comme en anglais. */
const TEXTES_FAUX = ['false', '0', 'non', 'no', 'off'];

/**
 * Traduit une valeur brute en booléen.
 *
 * Renvoie la valeur inchangée quand elle n'est pas convertible : la
 * validation la refusera alors, plutôt que de déformer le sens du filtre.
 * Une chaîne vide est traitée comme une absence de filtre.
 */
export function toBool(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const texte = value.trim().toLocaleLowerCase('fr');
    if (!texte) return undefined;
    if (TEXTES_VRAI.includes(texte)) return true;
    if (TEXTES_FAUX.includes(texte)) return false;
  }
  return value;
}

/**
 * Applique {@link toBool} à un paramètre de requête.
 *
 * La valeur lue est celle de l'objet source (`obj[key]`), et non celle déjà
 * convertie par class-transformer : c'est le seul endroit où la chaîne
 * d'origine (« false ») est encore lisible.
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ obj, key, value }) => toBool(obj && typeof obj === 'object' && key in obj ? obj[key] : value));
}
