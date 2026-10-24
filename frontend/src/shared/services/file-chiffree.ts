/**
 * Chiffrement au repos des files hors ligne. La clé AES-GCM non extractible
 * est conservée dans IndexedDB ; le contenu JSON chiffré reste dans
 * localStorage pour garder une purge simple par compte.
 *
 * La clé est repérée par le seul propriétaire (le compte) : le nom de la clé
 * de stockage n'entre pas dans la dérivation. Renommer une clé de stockage ne
 * rend donc pas une file illisible. En revanche, la base IndexedDB elle-même
 * porte un nom : elle est renommée, et les clés de chiffrement qu'elle
 * contient sont reprises depuis l'ancienne base, sans quoi les files déjà
 * écrites deviendraient indéchiffrables.
 */
import { i18n } from '@/boot/i18n';
import { BASE_CRYPTO, BASE_CRYPTO_LEGACY } from './cles-stockage';

const BASE = BASE_CRYPTO;
const BASE_LEGACY = BASE_CRYPTO_LEGACY;
const STORE = 'cles';
const PREFIXE = 'upf1:';

interface EntreeCle {
  proprietaire: string;
  cle: CryptoKey;
}

const ouvertures = new Map<string, Promise<CryptoKey>>();

function ouvrirBase(nom = BASE): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error(i18n.global.t('filePointages.chiffrement.unavailable')));
  return new Promise((resolve, reject) => {
    const demande = indexedDB.open(nom, 1);
    demande.onupgradeneeded = () => {
      if (!demande.result.objectStoreNames.contains(STORE)) {
        demande.result.createObjectStore(STORE, { keyPath: 'proprietaire' });
      }
    };
    demande.onsuccess = () => resolve(demande.result);
    demande.onerror = () => reject(demande.error ?? new Error(i18n.global.t('filePointages.chiffrement.openFailed')));
  });
}

async function lireEntree(db: IDBDatabase, proprietaire: string): Promise<EntreeCle | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const lecture = tx.objectStore(STORE).get(proprietaire);
    lecture.onsuccess = () => resolve(lecture.result as EntreeCle | undefined);
    lecture.onerror = () =>
      reject(lecture.error ?? new Error(i18n.global.t('filePointages.chiffrement.keyReadFailed')));
  });
}

async function ecrireEntree(db: IDBDatabase, proprietaire: string, cle: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ proprietaire, cle } satisfies EntreeCle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(i18n.global.t('filePointages.chiffrement.keySaveFailed')));
    tx.onabort = () => reject(tx.error ?? new Error(i18n.global.t('filePointages.chiffrement.keySaveAborted')));
  });
}

/** La base existe-t-elle déjà ? (évite d'en créer une vide par megarde) */
async function baseExiste(nom: string): Promise<boolean> {
  const indexed = globalThis.indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
  if (typeof indexed?.databases !== 'function') return true;
  try {
    const bases = await indexed.databases();
    return bases.some((base) => base.name === nom);
  } catch {
    return true;
  }
}

/**
 * Reprise d'une clé de chiffrement conservée dans l'ancienne base : elle est
 * copiée dans la base courante, qui devient la seule référence. Sans cette
 * reprise, une file chiffrée avant la mise à jour ne pourrait plus être
 * déchiffrée.
 */
async function importerCleLegacy(proprietaire: string, courante: IDBDatabase): Promise<EntreeCle | undefined> {
  let legacy: IDBDatabase | undefined;
  try {
    if (!(await baseExiste(BASE_LEGACY))) return undefined;
    legacy = await ouvrirBase(BASE_LEGACY);
    const entree = await lireEntree(legacy, proprietaire);
    if (!entree?.cle) return undefined;
    await ecrireEntree(courante, proprietaire, entree.cle);
    return entree;
  } catch {
    // L'ancienne base peut ne pas exister : rien à reprendre.
    return undefined;
  } finally {
    legacy?.close();
  }
}

/**
 * Copie toutes les clés de chiffrement de l'ancienne base vers la nouvelle.
 * L'ancienne base est conservée (quelques octets) : elle reste un recours si
 * une file chiffrée avec une ancienne clé réapparaît. La reprise est
 * idempotente : la rejouer ne perd aucune clé.
 */
export async function migrerBaseCrypto(): Promise<number> {
  if (!(await baseExiste(BASE_LEGACY))) return 0;
  let legacy: IDBDatabase;
  try {
    legacy = await ouvrirBase(BASE_LEGACY);
  } catch {
    return 0;
  }
  try {
    const entrees = await new Promise<EntreeCle[]>((resolve, reject) => {
      const tx = legacy.transaction(STORE, 'readonly');
      const lecture = tx.objectStore(STORE).getAll();
      lecture.onsuccess = () => resolve((lecture.result ?? []) as EntreeCle[]);
      lecture.onerror = () =>
        reject(lecture.error ?? new Error(i18n.global.t('filePointages.chiffrement.keyReadFailed')));
    });
    let reprises = 0;
    for (const entree of entrees) {
      if (!entree?.cle) continue;
      const courante = await ouvrirBase();
      try {
        const existante = await lireEntree(courante, entree.proprietaire);
        // La base courante peut déjà contenir une clé pour ce compte : c'est
        // elle qui fait foi, l'ancienne ne l'écrase pas.
        if (!existante?.cle) {
          await ecrireEntree(courante, entree.proprietaire, entree.cle);
          reprises++;
        }
      } finally {
        courante.close();
      }
    }
    legacy.close();
    return reprises;
  } catch {
    legacy.close();
    return 0;
  }
}

async function obtenirCle(proprietaire: string): Promise<CryptoKey> {
  if (!proprietaire || !globalThis.crypto?.subtle)
    throw new Error(i18n.global.t('filePointages.chiffrement.unavailable'));
  const existante = ouvertures.get(proprietaire);
  if (existante) return existante;

  const ouverture = (async () => {
    const db = await ouvrirBase();
    try {
      const entree = await lireEntree(db, proprietaire);
      if (entree?.cle) return entree.cle;
      // La clé peut dater d'avant le renommage de la base : sans elle, la
      // file déjà écrite deviendrait indéchiffrable.
      const importee = await importerCleLegacy(proprietaire, db);
      if (importee?.cle) return importee.cle;
      const generee = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await ecrireEntree(db, proprietaire, generee);
      return generee;
    } finally {
      db.close();
    }
  })();
  ouvertures.set(proprietaire, ouverture);
  try {
    return await ouverture;
  } catch (error) {
    ouvertures.delete(proprietaire);
    throw error;
  }
}

async function chargerCle(proprietaire: string): Promise<CryptoKey> {
  const enMemoire = ouvertures.get(proprietaire);
  if (enMemoire) return enMemoire;
  const db = await ouvrirBase();
  try {
    const entree = await lireEntree(db, proprietaire);
    if (entree?.cle) return entree.cle;
    const importee = await importerCleLegacy(proprietaire, db);
    if (importee?.cle) return importee.cle;
    throw new Error(i18n.global.t('filePointages.chiffrement.decryptKeyMissing'));
  } finally {
    db.close();
  }
}

function encoderBase64(octets: Uint8Array): string {
  let binaire = '';
  const lot = 0x8000;
  for (let i = 0; i < octets.length; i += lot) {
    binaire += String.fromCharCode(...octets.subarray(i, i + lot));
  }
  return btoa(binaire);
}

function decoderBase64(texte: string): Uint8Array {
  const binaire = atob(texte);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function bufferStable(octets: Uint8Array): ArrayBuffer {
  const copie = new Uint8Array(octets.length);
  copie.set(octets);
  return copie.buffer;
}

export async function ecrireFileChiffree<T>(cleStockage: string, proprietaire: string, valeur: T): Promise<void> {
  const cle = await obtenirCle(proprietaire);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const clair = new TextEncoder().encode(JSON.stringify(valeur));
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cle, clair);
  localStorage.setItem(cleStockage, `${PREFIXE}${encoderBase64(nonce)}:${encoderBase64(new Uint8Array(chiffre))}`);
}

/**
 * Lit les formats chiffrés et migre au premier accès les anciennes files JSON
 * en clair. Une donnée chiffrée illisible est signalée sans être supprimée.
 */
export async function lireFileChiffree<T>(cleStockage: string, proprietaire: string, valeurVide: T): Promise<T> {
  const brut = localStorage.getItem(cleStockage);
  if (brut === null) return valeurVide;
  if (!brut.startsWith(PREFIXE)) {
    const ancien = JSON.parse(brut) as T;
    await ecrireFileChiffree(cleStockage, proprietaire, ancien);
    return ancien;
  }

  const [nonceBase64, chiffreBase64, reste] = brut.slice(PREFIXE.length).split(':');
  if (!nonceBase64 || !chiffreBase64 || reste)
    throw new Error(i18n.global.t('filePointages.chiffrement.invalidFormat'));
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bufferStable(decoderBase64(nonceBase64)) },
    await chargerCle(proprietaire),
    bufferStable(decoderBase64(chiffreBase64)),
  );
  return JSON.parse(new TextDecoder().decode(clair)) as T;
}
