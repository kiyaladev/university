import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn() }));

// Le service de chiffrement est le sujet : i18n, Quasar et l'API sont simulés,
// la clé AES-GCM et le stockage local sont rejoués fidèlement.
vi.mock('../../src/boot/axios', () => ({ api }));
vi.mock('quasar', () => ({ Notify: { create: vi.fn() } }));
vi.mock('../../src/boot/i18n', () => ({ i18n: { global: { t: (cle: string) => cle } } }));
vi.mock('../../src/stores/seances', () => ({ useSeancesStore: () => ({ synchroniser: vi.fn() }) }));

import { creerIndexedDbFaux, creerStockageFaux, jetonPour } from './stockage-outil';

const PROPRIETAIRE = 'agent-test';
const CLE_FILE = 'university_file_pointages';
const CLE_FILE_PROPRIETAIRE = `${CLE_FILE}_${PROPRIETAIRE}`;

beforeEach(async () => {
  vi.stubGlobal('localStorage', creerStockageFaux());
  vi.stubGlobal('sessionStorage', creerStockageFaux());
  vi.stubGlobal('indexedDB', creerIndexedDbFaux());
  localStorage.setItem('university_token', jetonPour(PROPRIETAIRE));
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
