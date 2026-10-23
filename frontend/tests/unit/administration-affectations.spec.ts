import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { affectationsService } from '../../src/features/administration/services/affectations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/affectations', () => {
  it('liste les charges avec pagination et filtres', async () => {
    const page = { data: [{ id: 'c1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await affectationsService.liste({
      page: 1,
      pageSize: 20,
      search: 'algo',
      enseignantId: 'e1',
      matiereId: 'm1',
      promotionId: 'p1',
      anneeId: 'a1',
    });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/affectations', {
      params: {
        page: 1,
        pageSize: 20,
        search: 'algo',
        enseignantId: 'e1',
        matiereId: 'm1',
        promotionId: 'p1',
        anneeId: 'a1',
      },
    });
  });

  it('crée une charge d’enseignement', async () => {
    api.post.mockResolvedValue({ data: { id: 'c1' } });

    await affectationsService.creer({
      enseignantId: 'e1',
      matiereId: 'm1',
      promotionId: 'p1',
      anneeId: 'a1',
      volumeHorairePrevu: 50,
    });

    expect(api.post).toHaveBeenCalledWith(
      '/affectations',
      { enseignantId: 'e1', matiereId: 'm1', promotionId: 'p1', anneeId: 'a1', volumeHorairePrevu: 50 },
      {},
    );
  });

  it('modifie une charge par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'c1' } });

    await affectationsService.modifier('c1', { volumeHorairePrevu: 60 });

    expect(api.put).toHaveBeenCalledWith('/affectations/c1', { volumeHorairePrevu: 60 }, {});
  });
});
