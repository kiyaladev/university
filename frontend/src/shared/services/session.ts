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
 * l'importer sans cycle d'import. Il est également importé par
 * `quasar.config.ts` (qui s'exécute au build) : il ne doit donc rien faire
 * d'autre que déclarer des fonctions pures.
 */
import { CLE_TOKEN } from './cles-stockage';

export { CLE_TOKEN };

/** Charge utile d'un jeton : l'identifiant du compte et l'expiration. */
export interface ChargeJeton {
  sub?: string;
  exp?: number;
  [cle: string]: unknown;
}

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

/**
 * Décode la charge utile d'un JWT, sans en vérifier la signature. Le préfixe
 * « Bearer » est accepté : c'est ainsi que l'API le présente.
 *
 * La fonction est pure et sans dépendance : le service worker (et donc
 * `quasar.config.ts`) s'en sert pour juger l'expiration d'une réponse mise en
 * cache.
 */
export function decoderChargeUtile(jeton: string): ChargeJeton | null {
  try {
    const brut = jeton.startsWith('Bearer ') ? jeton.slice('Bearer '.length) : jeton;
    const partie = brut.split('.')[1];
    if (!partie) return null;
    const base64 = partie.replace(/-/g, '+').replace(/_/g, '/');
    const complete = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const charge = JSON.parse(atob(complete)) as ChargeJeton;
    return charge && typeof charge === 'object' ? charge : null;
  } catch {
    return null;
  }
}

/** Identifiant du compte porté par un jeton (vide si le jeton est illisible). */
export function proprietaireDepuisToken(jeton: string): string {
  const charge = decoderChargeUtile(jeton);
  return typeof charge?.sub === 'string' ? charge.sub : '';
}
