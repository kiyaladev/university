/**
 * Lecture défensive d'une erreur de type `unknown`.
 *
 * Les attrapages remontent des objets très hétérogènes : erreurs Prisma
 * (`code` en `P2002`, `P2034`…), exceptions NestJS (`response.message`),
 * erreurs de bibliothèques HTTP. Leur forme n'est pas connue à l'avance, on
 * ne peut donc pas les typer à la compilation.
 *
 * Plutôt que de laisser passer un `any`, on extrait les champs utiles avec
 * des gardes explicites. Les valeurs textuelles sont rendues telles quelles :
 * une liste de messages de validation reste une liste, la réponse renvoyée au
 * client ne change donc pas.
 */

/** Champs exploitables d'une erreur, extraits de sa forme réelle. */
export interface ErreurRenseignee {
  /** Code Prisma (`P2002`, `P2034`…) quand l'erreur en porte un. */
  code?: string;
  /** Message de l'erreur : un texte, ou la liste des textes de validation. */
  message?: string | string[];
  /** Corps de la réponse HTTP, quand l'erreur en porte un. */
  response?: { message?: string | string[] };
}

/** Ne garde que les valeurs textuelles (ou les listes de textes). */
function texteOuListe(valeur: unknown): string | string[] | undefined {
  if (typeof valeur === 'string') return valeur;
  if (Array.isArray(valeur)) return valeur as string[];
  return undefined;
}

/**
 * Extrait les champs exploitables d'une erreur inconnue.
 *
 * Une erreur qui n'est pas un objet (texte, nombre, `null`) ne porte aucun de
 * ces champs : la lecture est alors vide, comme l'était l'accès optionnel
 * `e?.code` / `e?.message`.
 */
export function erreur(e: unknown): ErreurRenseignee {
  if (typeof e !== 'object' || e === null) return {};
  const source = e as Record<string, unknown>;
  const reponse = source.response;
  const messageReponse =
    typeof reponse === 'object' && reponse !== null
      ? texteOuListe((reponse as Record<string, unknown>).message)
      : undefined;
  return {
    code: typeof source.code === 'string' ? source.code : undefined,
    message: texteOuListe(source.message),
    response: messageReponse === undefined ? undefined : { message: messageReponse },
  };
}

/** Code Prisma de l'erreur, s'il en porte un. */
export function codeErreur(e: unknown): string | undefined {
  return erreur(e).code;
}

/** Message de l'erreur, s'il est textuel. */
export function messageErreur(e: unknown): string | string[] | undefined {
  return erreur(e).message;
}
