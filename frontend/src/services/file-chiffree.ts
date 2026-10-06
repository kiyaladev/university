/**
 * Chiffrement au repos des files hors ligne. La clé AES-GCM non extractible
 * est conservée dans IndexedDB ; le contenu JSON chiffré reste dans
 * localStorage pour garder une purge simple par compte.
 */
const BASE = 'unipresence-file-crypto-v1';
const STORE = 'cles';
const PREFIXE = 'upf1:';

interface EntreeCle {
  proprietaire: string;
  cle: CryptoKey;
}

const ouvertures = new Map<string, Promise<CryptoKey>>();

function ouvrirBase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Chiffrement hors ligne indisponible'));
  return new Promise((resolve, reject) => {
    const demande = indexedDB.open(BASE, 1);
    demande.onupgradeneeded = () => {
      if (!demande.result.objectStoreNames.contains(STORE)) {
        demande.result.createObjectStore(STORE, { keyPath: 'proprietaire' });
      }
    };
    demande.onsuccess = () => resolve(demande.result);
    demande.onerror = () => reject(demande.error ?? new Error('Ouverture du coffre hors ligne impossible'));
  });
}

async function obtenirCle(proprietaire: string): Promise<CryptoKey> {
  if (!proprietaire || !globalThis.crypto?.subtle) throw new Error('Chiffrement hors ligne indisponible');
  const existante = ouvertures.get(proprietaire);
  if (existante) return existante;

  const ouverture = (async () => {
    const db = await ouvrirBase();
    try {
      const generee = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      return await new Promise<CryptoKey>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        let resultat: CryptoKey | undefined;
        const lecture = store.get(proprietaire);
        lecture.onsuccess = () => {
          const entree = lecture.result as EntreeCle | undefined;
          if (entree?.cle) resultat = entree.cle;
          else {
            resultat = generee;
            store.put({ proprietaire, cle: generee } satisfies EntreeCle);
          }
        };
        tx.oncomplete = () => resultat ? resolve(resultat) : reject(new Error('Clé hors ligne absente'));
        tx.onerror = () => reject(tx.error ?? new Error('Enregistrement de la clé hors ligne impossible'));
        tx.onabort = () => reject(tx.error ?? new Error('Enregistrement de la clé hors ligne annulé'));
      });
    } finally {
      db.close();
    }
  })();
  ouvertures.set(proprietaire, ouverture);
  try { return await ouverture; }
  catch (error) { ouvertures.delete(proprietaire); throw error; }
}

async function chargerCle(proprietaire: string): Promise<CryptoKey> {
  const enMemoire = ouvertures.get(proprietaire);
  if (enMemoire) return enMemoire;
  const db = await ouvrirBase();
  try {
    const entree = await new Promise<EntreeCle | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const lecture = tx.objectStore(STORE).get(proprietaire);
      lecture.onsuccess = () => resolve(lecture.result as EntreeCle | undefined);
      lecture.onerror = () => reject(lecture.error ?? new Error('Lecture de la clé hors ligne impossible'));
    });
    if (!entree?.cle) throw new Error('Clé de déchiffrement hors ligne absente');
    return entree.cle;
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
  if (!nonceBase64 || !chiffreBase64 || reste) throw new Error('Format de file hors ligne invalide');
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bufferStable(decoderBase64(nonceBase64)) },
    await chargerCle(proprietaire),
    bufferStable(decoderBase64(chiffreBase64)),
  );
  return JSON.parse(new TextDecoder().decode(clair)) as T;
}
