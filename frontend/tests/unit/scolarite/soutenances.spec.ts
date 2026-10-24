import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { soutenancesService } from '../../../src/features/scolarite/services/soutenances';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/soutenances', () => {
  it('lit le calendrier des soutenances', async () => {
    api.get.mockResolvedValue({ data: [{ id: 's1', date: '2026-01-10' }] });

    const resultat = await soutenancesService.liste();

    expect(resultat).toEqual([{ id: 's1', date: '2026-01-10' }]);
    expect(api.get).toHaveBeenCalledWith('/soutenances', { params: undefined });
  });

  it('planifie une soutenance', async () => {
    api.post.mockResolvedValue({ data: { id: 's2' } });

    await soutenancesService.creer({ travailEncadreId: 't1', date: '2026-01-10' });

    expect(api.post).toHaveBeenCalledWith('/soutenances', { travailEncadreId: 't1', date: '2026-01-10' }, {});
  });

  it('enregistre le constat du jury', async () => {
    api.put.mockResolvedValue({ data: { id: 's1', note: 15 } });

    await soutenancesService.hota('s1', { note: 15, mention: 'Bien' });

    expect(api.put).toHaveBeenCalledWith('/soutenances/s1/hota', { note: 15, mention: 'Bien' }, {});
  });
});
