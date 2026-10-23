import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { inscriptionsService } from '../../../src/features/scolarite/services/inscriptions';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/inscriptions', () => {
  it('liste les dossiers avec pagination', async () => {
    const page = { data: [{ id: 'i1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await inscriptionsService.liste({ statut: 'PAYE', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/inscriptions', { params: { statut: 'PAYE', page: 1, pageSize: 20 } });
  });

  it('normalise la liste complète des dossiers d’un étudiant', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'i1' }], total: 1, page: 1, pageSize: 50 } });

    await expect(inscriptionsService.tous({ all: '1', etudiantId: 'e1' })).resolves.toEqual([{ id: 'i1' }]);
    expect(api.get).toHaveBeenCalledWith('/inscriptions', { params: { all: '1', etudiantId: 'e1' } });
  });

  it('valide puis annule un dossier', async () => {
    api.put.mockResolvedValue({ data: { id: 'i1', statut: 'VALIDE' } });

    await inscriptionsService.valider('i1');
    await inscriptionsService.annuler('i1');

    expect(api.put).toHaveBeenNthCalledWith(1, '/inscriptions/i1/valider', undefined, {});
    expect(api.put).toHaveBeenNthCalledWith(2, '/inscriptions/i1/annuler', undefined, {});
  });

  it('ouvre un dossier d’inscription', async () => {
    api.post.mockResolvedValue({ data: { id: 'i2' } });

    await inscriptionsService.creer({ etudiantId: 'e1', promotionId: 'p1' });

    expect(api.post).toHaveBeenCalledWith('/inscriptions', { etudiantId: 'e1', promotionId: 'p1' }, {});
  });
});
