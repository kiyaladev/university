import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de la couche de services utilisée par les écrans VOD et badges.
 *
 * Chaque appel est vérifié sur trois points : l'URL appelée, les paramètres
 * transmis et la transformation du corps de la réponse (les services
 * renvoient le corps JSON, pas la réponse axios).
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { badgesService } from '../../src/features/campus/services/badges';
import { vodService } from '../../src/features/campus/services/vod';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('campus/services/vod (écrans catalogue et lecteur)', () => {
  it('liste le catalogue avec ses filtres de recherche', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'v1' }], total: 1 } });

    const resultat = await vodService.liste({ page: 2, pageSize: 20, search: 'math', type: 'VIDEO' });

    expect(api.get).toHaveBeenCalledWith('/vod', { params: { page: 2, pageSize: 20, search: 'math', type: 'VIDEO' } });
    // La transformation : le service rend le corps de la réponse, pas l'enveloppe axios.
    expect(resultat).toEqual({ data: [{ id: 'v1' }], total: 1 });
  });

  it("renvoie la collecte de l'étudiant telle quelle", async () => {
    const collecte = [{ id: 'v1', titre: 'Cours' }];
    api.get.mockResolvedValue({ data: collecte });

    await expect(vodService.maCollecte()).resolves.toBe(collecte);
    expect(api.get).toHaveBeenCalledWith('/vod/ma-collecte', { params: undefined });
  });

  it("lit la fiche d'une ressource pour le lecteur", async () => {
    api.get.mockResolvedValue({ data: { id: 'v1', titre: 'Cours', dureeSecondes: 600 } });

    const resultat = await vodService.detail('v1');

    expect(api.get).toHaveBeenCalledWith('/vod/v1', { params: undefined });
    expect(resultat).toEqual({ id: 'v1', titre: 'Cours', dureeSecondes: 600 });
  });

  it('crée puis modifie une ressource', async () => {
    api.post.mockResolvedValue({ data: { id: 'v1' } });
    api.put.mockResolvedValue({ data: { id: 'v1', titre: 'Cours 2' } });

    await expect(vodService.creer({ titre: 'Cours', type: 'VIDEO', url: 'https://media/cours.mp4' })).resolves.toEqual({
      id: 'v1',
    });
    await expect(vodService.modifier('v1', { titre: 'Cours 2' })).resolves.toEqual({ id: 'v1', titre: 'Cours 2' });

    expect(api.post).toHaveBeenCalledWith(
      '/vod',
      { titre: 'Cours', type: 'VIDEO', url: 'https://media/cours.mp4' },
      {},
    );
    expect(api.put).toHaveBeenCalledWith('/vod/v1', { titre: 'Cours 2' }, {});
  });

  it('met en ligne et archive une ressource', async () => {
    api.post.mockResolvedValue({ data: null });

    await vodService.publier('v1');
    await vodService.archiver('v1');

    expect(api.post).toHaveBeenNthCalledWith(1, '/vod/v1/publier', undefined, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/vod/v1/archiver', {}, {});
  });

  it('rapporte la position de lecture', async () => {
    api.post.mockResolvedValue({ data: null });

    await vodService.signalerVue('v1', { positionSecondes: 30, dureeSecondes: 600, termine: false });

    expect(api.post).toHaveBeenCalledWith(
      '/vod/v1/vue',
      { positionSecondes: 30, dureeSecondes: 600, termine: false },
      {},
    );
  });
});

describe('campus/services/badges (écrans badges)', () => {
  it('liste les badges avec leurs filtres', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'b1' }], total: 1 } });

    const resultat = await badgesService.liste({ page: 1, pageSize: 20, search: 'traoré', statut: 'ACTIF' });

    expect(api.get).toHaveBeenCalledWith('/badges', {
      params: { page: 1, pageSize: 20, search: 'traoré', statut: 'ACTIF' },
    });
    expect(resultat).toEqual({ data: [{ id: 'b1' }], total: 1 });
  });

  it('délivre puis corrige un badge', async () => {
    api.post.mockResolvedValue({ data: { id: 'b1' } });
    api.put.mockResolvedValue({ data: { id: 'b1', organisation: 'Université' } });

    await expect(badgesService.creer({ type: 'VISITEUR', nom: 'Traoré', prenom: 'Awa' })).resolves.toEqual({
      id: 'b1',
    });
    await expect(badgesService.modifier('b1', { organisation: 'Université' })).resolves.toEqual({
      id: 'b1',
      organisation: 'Université',
    });

    expect(api.post).toHaveBeenCalledWith('/badges', { type: 'VISITEUR', nom: 'Traoré', prenom: 'Awa' }, {});
    expect(api.put).toHaveBeenCalledWith('/badges/b1', { organisation: 'Université' }, {});
  });

  it('annule un badge avec son motif et prolonge sa validité', async () => {
    api.post.mockResolvedValue({ data: null });

    await badgesService.annuler('b1', 'Badge perdu');
    await badgesService.rallonger('b1', '2027-01-01');

    expect(api.post).toHaveBeenNthCalledWith(1, '/badges/b1/annuler', { motif: 'Badge perdu' }, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/badges/b1/rallonger', { dateValidite: '2027-01-01' }, {});
  });
});
