import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { sallesService } from '../../src/features/administration/services/salles';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/salles', () => {
  it('liste les salles avec les filtres demandés', async () => {
    const page = { data: [{ id: 's1', code: 'A1' }], total: 1, page: 2, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await sallesService.liste({ page: 2, pageSize: 20, search: 'A1' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/salles', { params: { page: 2, pageSize: 20, search: 'A1' } });
  });

  it('crée une salle', async () => {
    api.post.mockResolvedValue({ data: { id: 's1' } });

    await sallesService.creer({ code: 'A1', nom: 'Amphi 1', capacite: 120, actif: true });

    expect(api.post).toHaveBeenCalledWith('/salles', { code: 'A1', nom: 'Amphi 1', capacite: 120, actif: true }, {});
  });

  it('modifie une salle par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 's1' } });

    await sallesService.modifier('s1', { capacite: 80 });

    expect(api.put).toHaveBeenCalledWith('/salles/s1', { capacite: 80 }, {});
  });

  it('régénère le jeton QR d’une salle', async () => {
    api.post.mockResolvedValue({ data: { id: 's1', qrToken: 'UP-abc' } });

    await sallesService.regenererQr('s1');

    expect(api.post).toHaveBeenCalledWith('/salles/s1/qr', undefined, {});
  });
});
