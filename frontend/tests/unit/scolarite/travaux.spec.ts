import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { travauxService } from '../../../src/features/scolarite/services/travaux';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/scolarite/services/travaux', () => {
  it('liste les travaux encadrés et rend un tableau', async () => {
    api.get.mockResolvedValue({ data: [{ id: 't1', intitule: 'Stage' }] });

    const resultat = await travauxService.liste({ all: '1', type: 'STAGE' });

    expect(resultat).toEqual([{ id: 't1', intitule: 'Stage' }]);
    expect(api.get).toHaveBeenCalledWith('/travaux-encadres', { params: { all: '1', type: 'STAGE' } });
  });

  it('déballe une réponse paginée', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 't1' }], total: 1, page: 1, pageSize: 50 } });

    await expect(travauxService.liste({ all: '1' })).resolves.toEqual([{ id: 't1' }]);
  });

  it('lit un travail puis le modifie', async () => {
    api.get.mockResolvedValue({ data: { id: 't1' } });
    api.put.mockResolvedValue({ data: { id: 't1', rapportRendu: true } });

    await expect(travauxService.lire('t1')).resolves.toEqual({ id: 't1' });
    await travauxService.modifier('t1', { rapportRendu: true });

    expect(api.get).toHaveBeenCalledWith('/travaux-encadres/t1', { params: undefined });
    expect(api.put).toHaveBeenCalledWith('/travaux-encadres/t1', { rapportRendu: true }, {});
  });

  it('déclare un travail et fait avancer son statut', async () => {
    api.post.mockResolvedValue({ data: { id: 't2', statut: 'PROPOSE' } });

    await travauxService.creer({ intitule: 'Mémoire' });
    await travauxService.transition('t1', 'VALIDE');

    expect(api.post).toHaveBeenNthCalledWith(1, '/travaux-encadres', { intitule: 'Mémoire' }, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/travaux-encadres/t1/transition', { statut: 'VALIDE' }, {});
  });

  it('supprime un travail', async () => {
    api.delete.mockResolvedValue({ data: null });

    await travauxService.supprimer('t1');

    expect(api.delete).toHaveBeenCalledWith('/travaux-encadres/t1', {});
  });
});
