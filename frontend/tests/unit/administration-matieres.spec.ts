import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { matieresService } from '../../src/features/administration/services/matieres';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/matieres', () => {
  it('liste les matières avec pagination et filtres', async () => {
    const page = { data: [{ id: 'm1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await matieresService.liste({ page: 1, pageSize: 20, search: 'algo', departementId: 'd1' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/matieres', {
      params: { page: 1, pageSize: 20, search: 'algo', departementId: 'd1' },
    });
  });

  it('crée une matière', async () => {
    api.post.mockResolvedValue({ data: { id: 'm1' } });

    await matieresService.creer({
      code: 'ALGO',
      intitule: 'Algorithmique',
      volumeHoraireTotal: 50,
      credits: 4,
      departementId: 'd1',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/matieres',
      { code: 'ALGO', intitule: 'Algorithmique', volumeHoraireTotal: 50, credits: 4, departementId: 'd1' },
      {},
    );
  });

  it('modifie une matière par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'm1' } });

    await matieresService.modifier('m1', { credits: 6 });

    expect(api.put).toHaveBeenCalledWith('/matieres/m1', { credits: 6 }, {});
  });
});
