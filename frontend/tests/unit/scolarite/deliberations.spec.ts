import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { deliberationsService } from '../../../src/features/scolarite/services/deliberations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('features/scolarite/services/deliberations', () => {
  it('liste les délibérations d’une année', async () => {
    const page = { data: [{ id: 'd1' }], total: 1, page: 1, pageSize: 50 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await deliberationsService.liste({ all: '1', anneeId: 'a1' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/deliberations', { params: { all: '1', anneeId: 'a1' } });
  });

  it('lit le détail d’une délibération', async () => {
    api.get.mockResolvedValue({ data: { id: 'd1', lignes: [] } });

    await expect(deliberationsService.lire('d1')).resolves.toEqual({ id: 'd1', lignes: [] });
    expect(api.get).toHaveBeenCalledWith('/deliberations/d1', { params: undefined });
  });

  it('ouvre une session de délibération', async () => {
    api.post.mockResolvedValue({ data: { id: 'd2' } });

    await deliberationsService.creer({ anneeId: 'a1', promotionId: 'p1', session: 'NORMALE' });

    expect(api.post).toHaveBeenCalledWith('/deliberations', { anneeId: 'a1', promotionId: 'p1', session: 'NORMALE' }, {});
  });

  it('calcule puis valide une délibération', async () => {
    api.post.mockResolvedValue({ data: { id: 'd1' } });

    await deliberationsService.action('d1', 'calculer');
    await deliberationsService.action('d1', 'valider');

    expect(api.post).toHaveBeenNthCalledWith(1, '/deliberations/d1/calculer', undefined, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/deliberations/d1/valider', undefined, {});
  });
});
