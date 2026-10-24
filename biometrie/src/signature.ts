/**
 * Primitives de signature de la passerelle.
 *
 * Le format des charges signées est imposed par l'API : elle les reconstruit
 * caractère par caractère dans
 * `backend/src/modules/presence/presence-preuves/presence-preuves.service.ts`
 * (`enrolement|…`, `verification|…`). La moindre divergence — un champ mal
 * placé, un séparateur oublié — fait rejeter la preuve. Les fonctions sont donc
 * volontairement littérales, et regroupées ici pour être vérifiées sur des
 * vecteurs de test fixes.
 *
 * Deux chemins coexistent :
 *   • par appareil — la charge nomme l'appareil et la clé est celle de
 *     l'appareil enrôlé (`POST /attestation/appareils`) ;
 *   • par secret partagé — l'ancien chemin, sans appareil dans la charge.
 */
import { createHash, createHmac } from 'node:crypto';

/** Algorithme de signature : HMAC-SHA256, sortie hexadécimale. */
export const ALGORITHME = 'sha256';

/**
 * Empreinte SHA-256 du gabarit comparé. L'API la recalcule à partir du gabarit
 * qu'elle a enrôlé : l'inclure dans la signature empêche un client de faire
 * comparer le doigt à un gabarit de son choix.
 */
export function empreinteGabarit(template: string): string {
  return createHash(ALGORITHME).update(template).digest('hex');
}

/** Charge signée d'un enrôlement d'empreinte. */
export function chargeEnrolement(params: {
  appareilId?: string | null;
  enseignantId: string;
  template: string;
  horodatage: string;
}): string {
  return params.appareilId
    ? `enrolement|${params.appareilId}|${params.enseignantId}|${params.template}|${params.horodatage}`
    : `enrolement|${params.enseignantId}|${params.template}|${params.horodatage}`;
}

/**
 * Charge signée d'une vérification d'empreinte.
 *
 * Le nonce de la tentative (`tentativeId`) est signé quand le client en
 * fournit un : l'API accepte le nonce en fin de charge (comme juste avant
 * l'horodatage) et s'en sert alors pour identifier la preuve, plutôt que
 * l'empreinte de la signature. Une passerelle qui ne signe pas de nonce
 * reste acceptée par l'API.
 */
export function chargeVerification(params: {
  appareilId?: string | null;
  enseignantId: string;
  /** Empreinte du gabarit comparé, pas le gabarit lui-même. */
  gabarit: string;
  score: number;
  horodatage: string;
  tentativeId?: string | null;
}): string {
  const base = params.appareilId
    ? `verification|${params.appareilId}|${params.enseignantId}|${params.gabarit}|${params.score}`
    : `verification|${params.enseignantId}|${params.gabarit}|${params.score}`;
  return params.tentativeId
    ? `${base}|${params.horodatage}|${params.tentativeId}`
    : `${base}|${params.horodatage}`;
}

/** Signe une charge : hexadécimal minuscule, comme l'API l'attend. */
export function signer(secret: string, charge: string): string {
  return createHmac(ALGORITHME, secret).update(charge).digest('hex');
}

/**
 * Fenêtre d'acceptation d'un résultat signé, en millisecondes.
 * C'est la valeur que l'API applique (5 minutes, avec une tolérance de 60
 * secondes sur l'horloge) : la passerelle s'aligne dessus pour ne jamais
 * produire une preuve que l'API refusera.
 */
export const FRAICHEUR_RESULTAT_MS = 5 * 60 * 1000;

/** Tolérance d'horloge acceptée par l'API (un résultat légèrement dans le futur
 *  est accepté, parce que les horloges des postes ne sont pas synchronisées). */
export const TOLERANCE_HORLOGE_MS = 60 * 1000;

/**
 * Un horodatage est-il dans la fenêtre que l'API acceptera ? La passerelle
 * refuse de signer une preuve qui serait rejetée à la réception.
 */
export function horodatageAcceptable(horodatage: string, maintenant: number): boolean {
  const instant = new Date(horodatage).getTime();
  if (!Number.isFinite(instant)) return false;
  const age = maintenant - instant;
  return age >= -TOLERANCE_HORLOGE_MS && age <= FRAICHEUR_RESULTAT_MS;
}
