import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn() }));

// Le service de chiffrement est le sujet : i18n, Quasar et l'API sont simulés,
// la clé AES-GCM et le stockage local sont rejoués fidèlement.
vi.mock('../../src/boot/axios', () => ({ api }));
vi.mock('quasar', () => ({ Notify: { create: vi.fn() } }));
vi.mock('../../src/boot/i18n', () => ({ i18n: { global: { t: (cle: string) => cle } } }));
vi.mock('../../src/stores/seances', () => ({ useSeancesStore: () => ({ synchroniser: vi.fn() }) }));

const PROPRIETAIRE = 'agent-test';
const CLE_FILE = 'unipresence_file_pointages';
const CLE_FILE_PROPRIETAIRE = `${CLE_FILE}_${PROPRIETAIRE}`;

interface FauxRequete {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
  result: unknown;
  error: unknown;
}

/**
 * IndexedDB minimal : le service y conserve la clé AES-GCM du compte, avec la
 * seule exigence d'`extractable: false` — la clé n'est jamais lisible.
 */
function creerIndexedDbFaux() {
  const bases = new Map<string, Map<string, Map<string, unknown>>>();
  return {
    open(base: string) {
      const requete: FauxRequete = { onsuccess: null, onerror: null, result: null, error: null };
      queueMicrotask(() => {
        const magasins = bases.get(base) ?? new Map<string, Map<string, unknown>>();
        bases.set(base, magasins);
        requete.result = {
          objectStoreNames: { contains: (nom: string) => magasins.has(nom) },
          createObjectStore: (nom: string) => {
            magasins.set(nom, new Map<string, unknown>());
            return nom;
          },
          transaction: (nom: string) => {
            const tx = {
              oncomplete: null as (() => void) | null,
              onerror: null as (() => void) | null,
              onabort: null as (() => void) | null,
              objectStore: () => ({
                get(cle: string) {
                  const lecture: FauxRequete = { onsuccess: null, onerror: null, result: undefined, error: null };
                  queueMicrotask(() => {
                    lecture.result = magasins.get(nom)?.get(cle);
                    lecture.onsuccess?.();
                  });
                  return lecture;
                },
                put(valeur: { proprietaire: string }) {
                  magasins.get(nom)?.set(valeur.proprietaire, valeur);
                },
              }),
            };
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          },
          close: () => undefined,
        };
        requete.onupgradeneeded?.();
        requete.onsuccess?.();
      });
      return requete;
    },
  };
}

function creerLocalStorageFaux() {
  const valeurs = new Map<string, string>();
  return {
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => {
      valeurs.set(cle, valeur);
    },
    removeItem: (cle: string) => {
      valeurs.delete(cle);
    },
    clear: () => valeurs.clear(),
  };
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', creerLocalStorageFaux());
  vi.stubGlobal('indexedDB', creerIndexedDbFaux());
  localStorage.setItem(
    'unipresence_token',
    `e30.${Buffer.from(JSON.stringify({ sub: PROPRIETAIRE })).toString('base64')}.signature-de-recette`,
  );
  api.post.mockReset();
  // Chaque scénario repart d'une application neuve : le cache de clé du
  // service et l'instance Pinia ne doivent pas survivre d'un test à l'autre.
  vi.resetModules();
  const { createPinia, setActivePinia } = await import('pinia');
  setActivePinia(createPinia());
});

describe('shared/services/file-chiffree', () => {
  it('chiffre la file avant persistance et n’expose ni signature ni PIN', async () => {
    const { ecrireFileChiffree } = await import('../../src/shared/services/file-chiffree');

    await ecrireFileChiffree(CLE_FILE_PROPRIETAIRE, PROPRIETAIRE, [
      { seanceId: 'seance-1', signatureBase64: 'SIGNATURE_MANUSCRITE', codePinEnseignant: 'PIN_SECRET' },
    ]);

    const stocke = localStorage.getItem(CLE_FILE_PROPRIETAIRE) ?? '';

    expect(stocke.startsWith('upf1:')).toBe(true);
    expect(stocke).not.toContain('SIGNATURE_MANUSCRITE');
    expect(stocke).not.toContain('PIN_SECRET');
  });

  it('décrypte la file après rechargement, la clé étant relue dans IndexedDB', async () => {
    const { ecrireFileChiffree } = await import('../../src/shared/services/file-chiffree');
    await ecrireFileChiffree(CLE_FILE_PROPRIETAIRE, PROPRIETAIRE, [{ seanceId: 'seance-1' }]);

    // Rechargement : le module est réinstancié, son cache de clé est vide et la
    // clé est relue dans IndexedDB.
    vi.resetModules();
    const service = await import('../../src/shared/services/file-chiffree');

    await expect(service.lireFileChiffree(CLE_FILE_PROPRIETAIRE, PROPRIETAIRE, [])).resolves.toEqual([
      { seanceId: 'seance-1' },
    ]);
  });

  it('migre les anciennes files en clair vers le chiffrement', async () => {
    const { lireFileChiffree } = await import('../../src/shared/services/file-chiffree');
    localStorage.setItem(CLE_FILE, JSON.stringify([{ seanceId: 'ancienne' }]));

    const relu = await lireFileChiffree<Array<{ seanceId: string }>>(CLE_FILE, 'ancienne-file-sans-proprietaire', []);
    const stocke = localStorage.getItem(CLE_FILE) ?? '';

    expect(relu).toEqual([{ seanceId: 'ancienne' }]);
    expect(stocke.startsWith('upf1:')).toBe(true);
    expect(stocke).not.toContain('ancienne');
  });

  it('refuse la lecture d’une file chiffrée par un autre compte', async () => {
    const { ecrireFileChiffree, lireFileChiffree } = await import('../../src/shared/services/file-chiffree');
    await ecrireFileChiffree(CLE_FILE_PROPRIETAIRE, PROPRIETAIRE, [{ seanceId: 'seance-1' }]);

    await expect(lireFileChiffree(CLE_FILE_PROPRIETAIRE, 'autre-compte', [])).rejects.toThrow();
  });
});

describe('stores/pointages', () => {
  it('retire le PIN de la file avant son écriture', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();

    await store.mettreEnFile({
      seanceId: 'seance-1',
      statut: 'PRESENT',
      signatureBase64: 'SIGNATURE_MANUSCRITE',
      codePinEnseignant: 'PIN_SECRET',
      horodatage: new Date().toISOString(),
    });

    expect(store.file[0]?.codePinEnseignant).toBeUndefined();
    expect(localStorage.getItem(CLE_FILE_PROPRIETAIRE) ?? '').not.toContain('PIN_SECRET');
  });

  it('retire de la file les pointages acceptés par le serveur', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const { lireFileChiffree } = await import('../../src/shared/services/file-chiffree');
    const store = usePointagesStore();
    store.enLigne = true;
    await store.chargerProprietaire();
    await store.mettreEnFile({
      seanceId: 'seance-1',
      statut: 'PRESENT',
      signatureBase64: 'SIGNATURE_MANUSCRITE',
      horodatage: new Date().toISOString(),
    });
    api.post.mockResolvedValue({ data: { recus: 1, synchronises: 1, echecs: [] } });

    await store.synchroniser();

    expect(store.file).toEqual([]);
    await expect(lireFileChiffree(CLE_FILE_PROPRIETAIRE, PROPRIETAIRE, [])).resolves.toEqual([]);
  });
});
