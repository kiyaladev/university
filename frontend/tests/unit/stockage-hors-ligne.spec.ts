import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

// Les files hors ligne sont le sujet : i18n, Quasar et l'API sont simulés, la
// clé AES-GCM et le stockage local sont rejoués fidèlement.
vi.mock('../../src/boot/axios', () => ({ api }));
vi.mock('quasar', () => ({ Notify: { create: vi.fn() } }));
vi.mock('../../src/boot/i18n', () => ({ i18n: { global: { t: (cle: string) => cle } } }));

import { creerIndexedDbFaux, creerStockageFaux, jetonPour } from './stockage-outil';
import type { Affectation } from '../../src/types';

const PROPRIETAIRE = 'agent-test';
const AUTRE_PROPRIETAIRE = 'autre-agent';
const CLE_FILE = 'university_file_seances';
const CLE_FICHIER = `${CLE_FILE}_${PROPRIETAIRE}`;

const fauxNavigator = { onLine: true };

function affectation(): Affectation {
  return { id: 'aff-1', anneeId: 'annee-1', promotionId: 'promo-1' } as Affectation;
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', creerStockageFaux());
  vi.stubGlobal('sessionStorage', creerStockageFaux());
  vi.stubGlobal('indexedDB', creerIndexedDbFaux());
  fauxNavigator.onLine = true;
  vi.stubGlobal('navigator', fauxNavigator);
  localStorage.setItem('university_token', jetonPour(PROPRIETAIRE));
  api.post.mockReset();
  // Chaque scénario repart d'une application neuve : le cache de clé du
  // service et l'instance Pinia ne doivent pas survivre d'un test à l'autre.
  vi.resetModules();
  const { createPinia, setActivePinia } = await import('pinia');
  setActivePinia(createPinia());
});

describe('stores/seances — file hors ligne', () => {
  it('chiffre la file des séances : rien ne reste lisible dans le stockage', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();
    fauxNavigator.onLine = false;

    await store.creer(
      { affectationId: 'aff-1', date: '2026-10-06', heureDebut: '08:00', heureFin: '10:00', type: 'CM', salleId: null },
      affectation(),
      null,
    );

    const stocke = localStorage.getItem(CLE_FICHIER) ?? '';
    expect(stocke.startsWith('upf1:')).toBe(true);
    expect(stocke).not.toContain('2026-10-06');
    expect(store.file).toHaveLength(1);
  });

  it('reprend une file en clair, la chiffre et efface la version en clair', async () => {
    localStorage.setItem(CLE_FICHIER, JSON.stringify([{ idClient: 'a', enfileeLe: new Date().toISOString() }]));

    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();

    const stocke = localStorage.getItem(CLE_FICHIER) ?? '';
    expect(store.file).toHaveLength(1);
    expect(stocke.startsWith('upf1:')).toBe(true);
    expect(stocke).not.toContain('enfileeLe');
  });

  it('reprend une file en clair rangée sous l’ancien nom de clé', async () => {
    localStorage.setItem(
      `unipresence_file_seances_${PROPRIETAIRE}`,
      JSON.stringify([{ idClient: 'a', enfileeLe: new Date().toISOString() }]),
    );
    const { migrerClesLocales } = await import('../../src/shared/services/cles-stockage');
    migrerClesLocales();

    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();

    expect(store.file).toHaveLength(1);
    expect(localStorage.getItem(`unipresence_file_seances_${PROPRIETAIRE}`)).toBeNull();
    expect((localStorage.getItem(CLE_FICHIER) ?? '').startsWith('upf1:')).toBe(true);
  });

  it('purge les entrées trop anciennes et garde les autres', async () => {
    const vieille = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    const recente = new Date().toISOString();
    localStorage.setItem(
      CLE_FICHIER,
      JSON.stringify([
        { idClient: 'vieille', enfileeLe: vieille },
        { idClient: 'recente', enfileeLe: recente },
      ]),
    );

    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();

    expect(store.file.map((s) => s.idClient)).toEqual(['recente']);
  });

  it('écarte les entrées sans identifiant client', async () => {
    localStorage.setItem(
      CLE_FICHIER,
      JSON.stringify([{ enfileeLe: new Date().toISOString() }, { idClient: 'a', enfileeLe: new Date().toISOString() }]),
    );

    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();

    expect(store.file.map((s) => s.idClient)).toEqual(['a']);
  });

  it('ne montre pas la file d’un compte à un autre', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();
    fauxNavigator.onLine = false;
    await store.creer(
      { affectationId: 'aff-1', date: '2026-10-06', heureDebut: '08:00', heureFin: '10:00', type: 'CM', salleId: null },
      affectation(),
      null,
    );
    expect(store.file).toHaveLength(1);

    // Un autre compte se connecte : la file du précédent ne lui appartient pas.
    localStorage.setItem('university_token', jetonPour(AUTRE_PROPRIETAIRE));
    await store.chargerProprietaire();

    expect(store.file).toHaveLength(0);
    expect(store.proprietaire).toBe(AUTRE_PROPRIETAIRE);
  });

  it('défile la file : le serveur accepté vide la file et le stockage', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();
    fauxNavigator.onLine = false;
    await store.creer(
      { affectationId: 'aff-1', date: '2026-10-06', heureDebut: '08:00', heureFin: '10:00', type: 'CM', salleId: null },
      affectation(),
      null,
    );
    const { idClient } = store.file[0];

    fauxNavigator.onLine = true;
    api.post.mockResolvedValue({ data: { resultats: [{ idClient, ok: true }] } });
    await store.synchroniser();

    expect(store.file).toHaveLength(0);
    const { lireFileChiffree } = await import('../../src/shared/services/file-chiffree');
    await expect(lireFileChiffree(CLE_FICHIER, PROPRIETAIRE, [])).resolves.toEqual([]);
  });

  it('conserve la file en cas d’échec du serveur', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();
    fauxNavigator.onLine = false;
    await store.creer(
      { affectationId: 'aff-1', date: '2026-10-06', heureDebut: '08:00', heureFin: '10:00', type: 'CM', salleId: null },
      affectation(),
      null,
    );

    fauxNavigator.onLine = true;
    api.post.mockRejectedValue(new Error('réseau indisponible'));
    await store.synchroniser();

    expect(store.file).toHaveLength(1);
  });
});

describe('stores/pointages — file hors ligne', () => {
  it('chiffre la file des pointages sous le nouveau nom de clé', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();

    await store.mettreEnFile({
      seanceId: 'seance-1',
      statut: 'PRESENT',
      signatureBase64: 'SIGNATURE_MANUSCRITE',
      horodatage: new Date().toISOString(),
    });

    const stocke = localStorage.getItem(`university_file_pointages_${PROPRIETAIRE}`) ?? '';
    expect(stocke.startsWith('upf1:')).toBe(true);
    expect(stocke).not.toContain('SIGNATURE_MANUSCRITE');
  });

  it('purge les pointages trop anciens', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();
    await store.mettreEnFile({
      seanceId: 'seance-1',
      statut: 'PRESENT',
      horodatage: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    });

    // Rechargement de l'application : la file est relue depuis le stockage,
    // et la péremption s'applique.
    vi.resetModules();
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());
    const { usePointagesStore: storeRecharge } = await import('../../src/stores/pointages');
    const recharge = storeRecharge();
    await recharge.chargerProprietaire();

    expect(recharge.file).toHaveLength(0);
  });

  it('n’expose pas la file d’un compte à un autre', async () => {
    const { usePointagesStore } = await import('../../src/stores/pointages');
    const store = usePointagesStore();
    await store.chargerProprietaire();
    await store.mettreEnFile({
      seanceId: 'seance-1',
      statut: 'PRESENT',
      horodatage: new Date().toISOString(),
    });
    expect(store.file).toHaveLength(1);

    localStorage.setItem('university_token', jetonPour(AUTRE_PROPRIETAIRE));
    await store.chargerProprietaire();

    expect(store.file).toHaveLength(0);
  });
});
