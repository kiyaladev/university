import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ce fichier rejoue le chiffrement réel (AES-GCM) et recharge les modules à
// chaque scénario : il est plus lent que les autres, la marge de temps est
// donc élargie.
vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

// Les caches de tournée sont le sujet : i18n, Quasar et l'API sont simulés,
// la clé AES-GCM et le stockage local sont rejoués fidèlement.
vi.mock('../../src/boot/axios', () => ({ api }));
vi.mock('quasar', () => ({ Notify: { create: vi.fn() } }));
vi.mock('../../src/boot/i18n', () => ({ i18n: { global: { t: (cle: string) => cle } } }));

import { creerIndexedDbFaux, creerStockageFaux, jetonPour } from './stockage-outil';
import type { Affectation, Salle } from '../../src/types';

const PROPRIETAIRE = 'agent-test';
const AUTRE_PROPRIETAIRE = 'autre-agent';
const CLE_AFFECTATIONS = `university_affectations_tournee_${PROPRIETAIRE}`;
const CLE_SALLES = `university_salles_tournee_${PROPRIETAIRE}`;
const AGE_MAX = 24 * 3600 * 1000;

function affectation(): Affectation {
  return {
    id: 'aff-1',
    anneeId: 'annee-1',
    promotionId: 'promo-1',
    intitule: 'INTITULE_EN_CLAIR',
  } as unknown as Affectation;
}

function salle(): Salle {
  return { id: 'salle-1', code: 'CODE_EN_CLAIR', nom: 'NOM_EN_CLAIR' } as unknown as Salle;
}

/** Toutes les valeurs du stockage local, pour vérifier qu'aucune n'est en clair. */
function valeursStockees(): Array<{ cle: string; valeur: string }> {
  const entrees: Array<{ cle: string; valeur: string }> = [];
  for (let index = 0; index < localStorage.length; index++) {
    const cle = localStorage.key(index);
    if (cle === null) continue;
    entrees.push({ cle, valeur: localStorage.getItem(cle) ?? '' });
  }
  return entrees;
}

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

describe('stores/seances — caches de tournée chiffrés', () => {
  it('chiffre les caches des affectations et des salles', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();

    await store.enregistrerAffectations([affectation()]);
    await store.enregistrerSalles([salle()]);

    const stockeAffectations = localStorage.getItem(CLE_AFFECTATIONS) ?? '';
    const stockeSalles = localStorage.getItem(CLE_SALLES) ?? '';
    expect(stockeAffectations.startsWith('upf1:')).toBe(true);
    expect(stockeSalles.startsWith('upf1:')).toBe(true);
    expect(stockeAffectations).not.toContain('INTITULE_EN_CLAIR');
    expect(stockeSalles).not.toContain('CODE_EN_CLAIR');
    expect(stockeSalles).not.toContain('NOM_EN_CLAIR');
  });

  it('ne laisse aucune donnée métier en clair dans le stockage local', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();

    await store.enregistrerAffectations([affectation()]);
    await store.enregistrerSalles([salle()]);

    const marqueurs = ['INTITULE_EN_CLAIR', 'CODE_EN_CLAIR', 'NOM_EN_CLAIR', '"data"', '"enregistreesLe"'];
    for (const entree of valeursStockees()) {
      for (const marqueur of marqueurs) {
        expect(entree.valeur, `${entree.cle} contient « ${marqueur} »`).not.toContain(marqueur);
      }
    }
  });

  it('garde la copie déchiffrée en mémoire pour les lecteurs synchrones', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();

    await store.enregistrerAffectations([affectation()]);
    await store.enregistrerSalles([salle()]);

    expect(store.affectationsCache).toHaveLength(1);
    expect(store.sallesCache).toHaveLength(1);
  });

  it('reprend un cache en clair, le chiffre et efface la version en clair', async () => {
    localStorage.setItem(
      CLE_AFFECTATIONS,
      JSON.stringify({ enregistreesLe: new Date().toISOString(), data: [affectation()] }),
    );

    const { prechargerCachesHorsLigne } = await import('../../src/shared/services/file-hors-ligne');
    await prechargerCachesHorsLigne(PROPRIETAIRE);

    const stocke = localStorage.getItem(CLE_AFFECTATIONS) ?? '';
    expect(stocke.startsWith('upf1:')).toBe(true);
    expect(stocke).not.toContain('INTITULE_EN_CLAIR');
  });

  it('restaure les caches au démarrage, avant que les écrans ne les lisent', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.enregistrerAffectations([affectation()]);
    await store.enregistrerSalles([salle()]);

    // Rechargement de l'application : les modules sont rechargés, le cache
    // déchiffré est reconstitué au démarrage, comme le fait boot/stockage.ts.
    vi.resetModules();
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());
    const { prechargerCachesHorsLigne } = await import('../../src/shared/services/file-hors-ligne');
    await prechargerCachesHorsLigne(PROPRIETAIRE);

    const { useSeancesStore: storeRecharge } = await import('../../src/stores/seances');
    const recharge = storeRecharge();
    // La lecture est synchrone : elle n'attend aucun déchiffrement.
    expect(recharge.affectationsCache).toHaveLength(1);
    expect(recharge.sallesCache).toHaveLength(1);
  });

  it('ignore un cache trop ancien', async () => {
    localStorage.setItem(
      CLE_AFFECTATIONS,
      JSON.stringify({
        enregistreesLe: new Date(Date.now() - AGE_MAX - 60_000).toISOString(),
        data: [affectation()],
      }),
    );

    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.initialiser();

    expect(store.affectationsCache).toHaveLength(0);
  });

  it('ne montre pas les caches d’un compte à un autre', async () => {
    const { useSeancesStore } = await import('../../src/stores/seances');
    const store = useSeancesStore();
    await store.enregistrerAffectations([affectation()]);
    expect(store.affectationsCache).toHaveLength(1);

    // Un autre compte se connecte : le cache du précédent ne lui appartient pas.
    localStorage.setItem('university_token', jetonPour(AUTRE_PROPRIETAIRE));
    await store.chargerCaches();

    expect(store.affectationsCache).toHaveLength(0);
    expect(store.proprietaire).toBe(AUTRE_PROPRIETAIRE);
  });
});
