/**
 * Source unique de vérité pour le jeton de session.
 *
 * Le jeton vit à la fois dans `localStorage` (pour survivre à un rechargement)
 * et dans le store Pinia (pour piloter la garde de routes). Tant que ces deux
 * endroits sont écrits séparément, ils finissent par diverger : c'est
 * exactement ce qui se produit quand l'intercepteur 401 efface la clé sans
 * prévenir le store — `connecte` reste vrai et l'utilisateur tourne en boucle
 * de redirections.
 *
 * Ce module ne dépend ni d'axios ni de Pinia, ce qui permet aux deux de
 * l'importer sans cycle d'import.
 */

export const CLE_TOKEN = 'unipresence_token';

export function lireToken(): string {
  return localStorage.getItem(CLE_TOKEN) ?? '';
}

export function ecrireToken(token: string): void {
  localStorage.setItem(CLE_TOKEN, token);
}

export function effacerToken(): void {
  localStorage.removeItem(CLE_TOKEN);
}

/** Défaut à ne pas renvoyer en URL : c'est la fuite la plus facile à rater. */
export function jetonPresent(): boolean {
  return lireToken().length > 0;
}
