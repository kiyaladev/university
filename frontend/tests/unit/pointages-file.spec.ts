/**
 * File hors ligne des pointages : l'identifiant client et les échecs
 * définitifs.
 *
 * Un pointage hors ligne peut être renvoyé après une réponse perdue : le même
 * identifiant client prouve à l'API qu'il s'agit du même pointage. À
 * l'inverse, un pointage refusé pour une preuve déjà utilisée ne sera jamais
 * accepté : il doit quitter la file, faute de quoi il est réessayé à chaque
 * synchronisation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock('../../src/boot/axios', () => ({ api }));
const notify = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('quasar', () => ({ Notify: notify }));
vi.mock('../../src/boot/i18n', () => ({ i18n: { global: { t: (cle: string) => cle } } }));

import { creerIndexedDbFaux, creerStockageFaux, jetonPour } from './stockage-outil';

const PROPRIETAIRE = 'agent-test';
const fauxNavigator = { onLine: true };

beforeEach(async () => {
  vi.stubGlobal('localStorage', creerStockageFaux());
  vi.stubGlobal('sessionStorage', creerStockageFaux());
  vi.stubGlobal('indexedDB', creerIndexedDbFaux());
  fauxNavigator.onLine = true;
  vi.stubGlobal('navigator', fauxNavigator);
  localStorage.setItem('university_token', jetonPour(PROPRIETAIRE));
  api.post.mockReset();
  notify.create.mockReset();
  vi.resetModules();
  const { createPinia, setActivePinia } = await import('pinia');
  setActivePinia(createPinia());
});

/** Pointage prêt à partir en file. */
const POINTAGE = {
  seanceId: 'seance-1',
  statut: 'PRESENT' as const,
  signatureBase64: 'SIGNATURE_MANUSCRITE',
  horodatage: new Date().toISOString(),
};

describe('services/file-hors-ligne — échecs définitifs', () => {
  it('reconnaît le conflit « preuve déjà utilisée »', async () => {
    const { echecDefinitif, CODE_PREUVE_DEJA_UTILISEE } = await import('../../src/shared/services/file-hors-ligne');

    expect(CODE_PREUVE_DEJA_UTILISEE).toBe('PREUVE_DEJA_UTILISEE');
    expect(echecDefinitif({ seanceId: 'seance-1', code: CODE_PREUVE_DEJA_UTILISEE })).toBe(true);
    expect(echecDefinitif({ seanceId: 'seance-1', erreur: 'Constat d’un autre agent' })).toBe(false);
    expect(echecDefinitif({ seanceId: 'seance-1', code: 'AUTRE_CONFLIT' })).toBe(false);
  });
});

describe('stores/pointages — identifiant client', () => {
  it('attribue un identifiant client au pointage mis en file', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();

    await store.mettreEnFile(POINTAGE);

    expect(store.file).toHaveLength(1);
    expect(store.file[0].idClient).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('renvoie le même identifiant client quand l’envoi en ligne échoue', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();

    // La réponse se perd : le pointage part en file, il sera renvoyé.
    api.post.mockRejectedValueOnce(new Error('réseau indisponible'));
    const accepte = await store.envoyer(POINTAGE);

    expect(accepte).toBe(false);
    expect(store.file).toHaveLength(1);
    const envoye = api.post.mock.calls[0][1] as { idClient?: string };
    expect(envoye.idClient).toBeTruthy();
    // Le renvoi portera le même identifiant : l'API reconnaîtra le pointage.
    expect(store.file[0].idClient).toBe(envoye.idClient);
  });

  it('laisse l’identifiant client déjà connu', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();

    await store.mettreEnFile({ ...POINTAGE, idClient: 'uuid-deja-la' });

    expect(store.file[0].idClient).toBe('uuid-deja-la');
  });
});

describe('stores/pointages — synchronisation', () => {
  async function fileAvecUnPointage() {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();
    await store.mettreEnFile(POINTAGE);
    return store;
  }

  it('vide la file quand le serveur reconnaît le pointage (renvoi idempotent)', async () => {
    const store = await fileAvecUnPointage();
    fauxNavigator.onLine = true;
    api.post.mockResolvedValue({ data: { recus: 1, synchronises: 1, echecs: [] } });

    await store.synchroniser();

    expect(store.file).toHaveLength(0);
  });

  it('retire de la file un pointage refusé pour une preuve déjà utilisée', async () => {
    const store = await fileAvecUnPointage();
    fauxNavigator.onLine = true;
    api.post.mockResolvedValue({
      data: {
        recus: 1,
        synchronises: 0,
        echecs: [
          {
            seanceId: 'seance-1',
            ok: false,
            erreur: 'Preuve déjà utilisée : refaites la lecture de l’empreinte',
            code: 'PREUVE_DEJA_UTILISEE',
          },
        ],
      },
    });

    await store.synchroniser();

    // L'échec est définitif : le pointage ne reste pas en file, il ne sera
    // jamais réessayé.
    expect(store.file).toHaveLength(0);
    expect(store.erreurs['seance-1']).toBeUndefined();
    const messages = notify.create.mock.calls.map((c) => c[0].message);
    expect(messages).toContain('filePointages.proofUsed');
  });

  it('conserve en file un échec qui peut encore aboutir', async () => {
    const store = await fileAvecUnPointage();
    fauxNavigator.onLine = true;
    api.post.mockResolvedValue({
      data: {
        recus: 1,
        synchronises: 0,
        echecs: [{ seanceId: 'seance-1', ok: false, erreur: 'Constat d’un autre agent' }],
      },
    });

    await store.synchroniser();

    expect(store.file).toHaveLength(1);
    expect(store.erreurs['seance-1']).toBe('Constat d’un autre agent');
  });

  it('conserve la file quand le serveur est injoignable', async () => {
    const store = await fileAvecUnPointage();
    fauxNavigator.onLine = true;
    api.post.mockRejectedValue(new Error('réseau indisponible'));

    await store.synchroniser();

    expect(store.file).toHaveLength(1);
  });
});
