import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { fraisScolariteService } from '../../../src/features/scolarite/services/frais';

beforeEach(() => {
  api.get.mockReset();
});

describe('features/scolarite/services/frais', () => {
  it('lit le barème d’une promotion et le rend en tableau', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'f1', montant: 250000, devise: 'GNF' }] });

    const resultat = await fraisScolariteService.liste({ all: '1', promotionId: 'p1' });

    expect(resultat).toEqual([{ id: 'f1', montant: 250000, devise: 'GNF' }]);
    expect(api.get).toHaveBeenCalledWith('/frais', { params: { all: '1', promotionId: 'p1' } });
  });

  it('déballe une réponse paginée', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'f1' }], total: 1, page: 1, pageSize: 50 } });

    await expect(fraisScolariteService.liste({ promotionId: 'p1' })).resolves.toEqual([{ id: 'f1' }]);
  });
});
