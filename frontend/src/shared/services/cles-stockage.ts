/**
 * Noms des clés de stockage : un seul endroit pour les connaître.
 *
 * L'application a porté le préfixe « unipresence_ » jusqu'ici. Le produit
 * s'appelle désormais University : les clés portent le préfixe
 * « university_ ». Les anciennes clés ne sont pas abandonnées : elles sont
 * reprises au démarrage (voir `boot/stockage.ts`), car des téléphones et des
 * navigateurs en service portent des sessions et des files hors ligne qui
 * n'ont jamais été synchronisées. Rien ne doit être perdu.
 */

/** Préfixe des clés de stockage current. */
export const PREFIXE = 'university_';

/** Préfixe historique, conservé pour la migration. */
export const PREFIXE_LEGACY = 'unipresence_';

/** Ancien nom de la clé de langue (clé nue, sans préfixe). */
export const CLE_LANGUE_LEGACY = 'lang';

/** Jeton de session. */
export const CLE_TOKEN = 'university_token';

/** Langue choisie par l'utilisateur. */
export const CLE_LANGUE = 'university_lang';

/** Files hors ligne des pointages (une file par compte, suffixée du propriétaire). */
export const CLE_FILE_POINTAGES = 'university_file_pointages';

/** File hors ligne des séances (une file par compte, suffixée du propriétaire). */
export const CLE_FILE_SEANCES = 'university_file_seances';

/** Cache local des affectations de la tournée. */
export const CLE_AFFECTATIONS = 'university_affectations_tournee';

/** Cache local des salles de la tournée. */
export const CLE_SALLES = 'university_salles_tournee';

/** Préfixe de la clé de tournée préparée (suffixée de l'identifiant du compte). */
export const CLE_TOURNEE_PREPAREE = 'university_tournee_preparee';

/** Adresse de la passerelle biométrique déclarée sur le poste. */
export const CLE_PASSERELLE = 'university_biometrie_url';

/** Identifiant de l'appareil enrôlé pour les attestations. */
export const CLE_APPAREIL = 'university_appareil_enrole';

/** Brouillon de l'inscription publique (stockage de session). */
export const CLE_BROUILLON_INSCRIPTION = 'university_inscription_publique_brouillon';

/** Cache HTTP du service worker pour les lectures de l'API. */
export const CACHE_API = 'university-api-v2';

/** Ancien cache HTTP (version 1), purgé au démarrage. */
export const CACHE_API_ANCIEN = 'university-api';

/** Caches historiques : aucune donnée unique, ils sont purgés au profit du nouveau. */
export const CACHES_LEGACY = ['unipresence-api', 'unipresence-api-v2'];

/** Base IndexedDB qui conserve les clés de chiffrement au repos. */
export const BASE_CRYPTO = 'university-file-crypto-v1';

/** Base IndexedDB historique : elle contient les clés de chiffrement à reprendre. */
export const BASE_CRYPTO_LEGACY = 'unipresence-file-crypto-v1';

/** Clé d'une file ou d'un cache appartenant à un compte. */
export function clePour(prefixe: string, proprietaire: string): string {
  return `${prefixe}_${proprietaire}`;
}

/** Clé de la tournée préparée pour un compte. */
export function cleTourneePreparee(utilisateurId: string): string {
  return `${CLE_TOURNEE_PREPAREE}_${utilisateurId}`;
}

/**
 * Nom de la clé qui remplace une clé historique, ou `null` si la clé est
 * déjà à jour. Toute clé « unipresence_* » est reprise sous « university_* » ;
 * la clé nue « lang » devient « university_lang ».
 */
export function nomMigre(cle: string): string | null {
  if (cle.startsWith(PREFIXE_LEGACY)) return PREFIXE + cle.slice(PREFIXE_LEGACY.length);
  if (cle === CLE_LANGUE_LEGACY) return CLE_LANGUE;
  return null;
}

/** Stockages locaux disponibles (le mode privé peut les refuser). */
function stockagesLocaux(): Storage[] {
  const liste: Storage[] = [];
  for (const nom of ['localStorage', 'sessionStorage'] as const) {
    try {
      const stockage = globalThis[nom];
      if (stockage) liste.push(stockage);
    } catch {
      /* stockage refusé : on passe à la suite */
    }
  }
  return liste;
}

/**
 * Reprise des anciennes clés de stockage : pour chaque clé historique
 * présente dont la nouvelle version est absente, la valeur est copiée puis
 * l'ancienne clé est supprimée. Si la nouvelle version existe déjà, elle
 * fait foi et l'ancienne clé est simplement retirée.
 *
 * La reprise est idempotente : la rejouer ne change rien et ne perd rien.
 */
export function migrerClesLocales(): string[] {
  const migrees: string[] = [];
  for (const stockage of stockagesLocaux()) {
    const cles: string[] = [];
    for (let i = 0; i < stockage.length; i++) {
      const cle = stockage.key(i);
      if (cle !== null) cles.push(cle);
    }
    for (const cle of cles) {
      const cible = nomMigre(cle);
      if (!cible || cible === cle) continue;
      const valeur = stockage.getItem(cle);
      if (valeur === null) continue;
      if (stockage.getItem(cible) === null) {
        stockage.setItem(cible, valeur);
        migrees.push(cible);
      }
      stockage.removeItem(cle);
    }
  }
  return migrees;
}

/**
 * Purge des caches du service worker portant l'ancien nom. Ces caches
 * ne contiennent que des réponses HTTP de l'API, sans donnée unique : le
 * cache au nouveau nom les remplace.
 */
export async function migrerCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await Promise.all(CACHES_LEGACY.map((nom) => caches.delete(nom)));
}
