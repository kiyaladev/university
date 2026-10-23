import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { tirageService } from '../../../src/features/scolarite/services/tirage';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('features/scolarite/services/tirage', () => {
  it('liste les tirages filtrés', async () => {
    const page = { data: [{ id: 't1' }], total: 1, page: 1, pageSize: 50 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await tirageService.liste({ examenId: 'x1', page: 1, pageSize: 50 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/tirage', { params: { examenId: 'x1', page: 1, pageSize: 50 } });
  });

  it('crée un tirage', async () => {
    api.post.mockResolvedValue({ data: { id: 't1' } });

    await tirageService.creer({ examenId: 'x1', empreinteSource: 'empreinte' });

    expect(api.post).toHaveBeenCalledWith('/tirage', { examenId: 'x1', empreinteSource: 'empreinte' }, {});
  });

  it('lit un tirage', async () => {
    api.get.mockResolvedValue({ data: { id: 't1' } });

    await expect(tirageService.lire('t1')).resolves.toEqual({ id: 't1' });
    expect(api.get).toHaveBeenCalledWith('/tirage/t1', { params: undefined });
  });

  it('avance le tirage avec son stade', async () => {
    api.post.mockResolvedValue({ data: { id: 't1', stade: 'CONVOQUE' } });

    await tirageService.avancer('t1', 'convoquer', 'CONVOQUE');

    expect(api.post).toHaveBeenCalledWith('/tirage/t1/convoquer', { stade: 'CONVOQUE' }, {});
  });

  it('annule un tirage', async () => {
    api.post.mockResolvedValue({ data: { id: 't1' } });

    await tirageService.annuler('t1');

    expect(api.post).toHaveBeenCalledWith('/tirage/t1/annuler', undefined, {});
  });

  it('marque le tirage comme imprimé', async () => {
    api.post.mockResolvedValue({ data: { id: 't1' } });

    await tirageService.imprimer('t1', 'empreinte-opérateur');

    expect(api.post).toHaveBeenCalledWith('/tirage/t1/imprimer', { empreinteSource: 'empreinte-opérateur' }, {});
  });
});
