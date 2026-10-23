import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref, type EffectScope } from 'vue';
import type { LocationQuery } from 'vue-router';

// Faux routeur : une route réactive dont `replace` remplace la query, comme
// le vrai (de façon asynchrone).
const routeur = vi.hoisted(() => ({
  route: null as unknown as { path: string; query: LocationQuery },
  replace: null as unknown as ReturnType<typeof vi.fn>,
}));
vi.mock('vue-router', () => ({
  useRoute: () => routeur.route,
  useRouter: () => ({ replace: routeur.replace }),
}));

import { useListePaginee, type ParamsListe } from '../../src/composables/useListePaginee';

type Filtres = { recherche: string; statut: string | null };

async function attendre() {
  for (let i = 0; i < 5; i++) {
    await nextTick();
    await Promise.resolve();
  }
}

let portee: EffectScope;
let charger: ReturnType<typeof vi.fn<(p: ParamsListe<Filtres>) => Promise<{ data: number[]; total: number }>>>;

function creer(query: LocationQuery = {}) {
  routeur.route.query = query;
  const filtres = ref<Filtres>({ recherche: '', statut: null });
  const liste = portee.run(() => useListePaginee<number, Filtres>({ filtres, syncUrl: true, charger }))!;
  return { filtres, liste };
}

beforeEach(() => {
  vi.useFakeTimers();
  routeur.route = reactive({ path: '/tickets', query: {} as LocationQuery });
  routeur.replace = vi.fn(({ query }: { query: LocationQuery }) => {
    routeur.route.query = query;
    return Promise.resolve();
  });
  charger = vi.fn(async () => ({ data: [1, 2, 3], total: 45 }));
  portee = effectScope();
});

afterEach(() => {
  portee.stop();
  vi.useRealTimers();
});

describe('useListePaginee', () => {
  it('relit filtres et page de l’URL à la création', async () => {
    const { filtres, liste } = creer({ statut: 'OUVERT', page: '3', autre: 'x' });
    await attendre();
    expect(filtres.value).toEqual({ recherche: '', statut: 'OUVERT' });
    expect(liste.page.value).toBe(3);
    expect(charger).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, pageSize: 20, filtres: { recherche: '', statut: 'OUVERT' } }),
    );
  });

  it('écrit les filtres dans l’URL sans toucher aux clés des autres', async () => {
    const { filtres } = creer({ autre: 'x' });
    await attendre();
    filtres.value.statut = 'CLOS';
    await attendre();
    expect(routeur.replace).toHaveBeenCalledOnce();
    expect(routeur.route.query).toEqual({ autre: 'x', statut: 'CLOS' });
  });

  it('un filtre qui change ramène en page 1', async () => {
    const { filtres, liste } = creer({ page: '4' });
    await attendre();
    expect(liste.page.value).toBe(4);
    filtres.value.statut = 'CLOS';
    await attendre();
    expect(liste.page.value).toBe(1);
    expect(routeur.route.query).toEqual({ statut: 'CLOS' });
    expect(charger).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('la recherche attend 300 ms de silence', async () => {
    const { filtres } = creer();
    await attendre();
    charger.mockClear();
    filtres.value.recherche = 'dia';
    await attendre();
    expect(charger).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await attendre();
    expect(charger).toHaveBeenCalledOnce();
    expect(routeur.route.query).toEqual({ recherche: 'dia' });
  });

  it('relit la query quand seule elle change (précédent / suivant), sans boucle', async () => {
    const { filtres, liste } = creer({ statut: 'OUVERT' });
    await attendre();
    charger.mockClear();

    // Navigation arrière vers un autre état de filtres, en page 2.
    routeur.route.query = { statut: 'CLOS', page: '2' };
    await attendre();
    expect(filtres.value.statut).toBe('CLOS');
    expect(liste.page.value).toBe(2);
    expect(charger).toHaveBeenCalledOnce();
    expect(charger).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    // Puis vers un état sans filtre : la valeur initiale revient.
    routeur.route.query = {};
    await attendre();
    expect(filtres.value.statut).toBeNull();
    expect(liste.page.value).toBe(1);
    expect(charger).toHaveBeenCalledTimes(2);
    // L'URL suit déjà : aucune réécriture.
    expect(routeur.replace).not.toHaveBeenCalled();
  });

  it('ignore l’écho de ses propres router.replace et les query des autres listes', async () => {
    const { filtres } = creer();
    await attendre();
    filtres.value.statut = 'CLOS';
    await attendre();
    charger.mockClear();
    expect(routeur.replace).toHaveBeenCalledOnce();

    routeur.route.query = { ...routeur.route.query, 'att.statut': 'X' };
    await attendre();
    expect(charger).not.toHaveBeenCalled();
    expect(filtres.value.statut).toBe('CLOS');
  });

  it('ne relit rien une fois la page quittée', async () => {
    const { filtres } = creer({ statut: 'OUVERT' });
    await attendre();
    routeur.route.path = '/ailleurs';
    routeur.route.query = { statut: 'CLOS' };
    await attendre();
    expect(filtres.value.statut).toBe('OUVERT');
  });

  it('toutAfficher passe à une seule page de la taille du total', async () => {
    const { liste } = creer({ page: '2' });
    await attendre();
    liste.toutAfficher();
    await attendre();
    expect(liste.page.value).toBe(1);
    expect(liste.pageSize.value).toBe(45);
    expect(charger).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 45 }));
  });
});
