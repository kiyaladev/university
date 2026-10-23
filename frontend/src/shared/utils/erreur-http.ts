/**
 * Lecture du message d'une erreur HTTP, quelle que soit l'écriture du corps.
 *
 * Deux formats coexistent pendant la transition :
 * - le format unique de l'API, `{ statusCode, message, error }`, où `message`
 *   est une chaîne ou un tableau de chaînes (plusieurs fautes accumulées) ;
 * - l'ancien format de validation, `{ statutCode, erreur, messages }`.
 *
 * Un téléphone peut garder en cache une version du front plus ancienne que
 * l'API déployée, ou l'inverse. La lecture accepte donc les deux écritures :
 * sinon l'utilisateur voit un message générique au lieu de la cause réelle.
 */

/** Extrait le message d'un corps d'erreur, quel que soit son format. */
export function extraireMessageErreur(donnees: unknown): string | string[] | undefined {
  if (!donnees || typeof donnees !== 'object') return undefined;
  const corps = donnees as Record<string, unknown>;
  const candidat = corps.message ?? corps.messages ?? corps.erreur;
  if (Array.isArray(candidat)) {
    const textes = candidat.map((element) => String(element ?? '').trim()).filter(Boolean);
    return textes.length ? textes : undefined;
  }
  if (typeof candidat === 'string' && candidat.trim()) return candidat;
  return undefined;
}

/**
 * Complète un corps d'erreur avec le champ `message` du format unique.
 *
 * Le corps est renvoyé tel quel s'il porte déjà un message ; sinon le
 * message extrait de l'ancien format y est ajouté, sans effacer les autres
 * champs. Les écrans qui lisent `response.data.message` continuent ainsi de
 * fonctionner avec les deux écritures.
 */
export function completerMessageErreur(donnees: unknown): Record<string, unknown> | undefined {
  if (!donnees || typeof donnees !== 'object') return undefined;
  const corps = donnees as Record<string, unknown>;
  const message = extraireMessageErreur(corps);
  if (message === undefined || corps.message !== undefined) return corps;
  return { ...corps, message };
}
