import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { evaluationsService } from '../../../src/features/scolarite/services/evaluations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/evaluations', () => {
  it('liste les évaluations avec leurs filtres', async () => {
    const page = { data: [{ id: 'ev1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await evaluationsService.liste({ promotionId: 'p1', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/evaluations', { params: { promotionId: 'p1', page: 1, pageSize: 20 } });
  });

  it('lit, crée et modifie une évaluation', async () => {
    api.get.mockResolvedValue({ data: { id: 'ev1' } });
    api.post.mockResolvedValue({ data: { id: 'ev2' } });
    api.put.mockResolvedValue({ data: { id: 'ev1', intitule: 'CC1' } });

    await expect(evaluationsService.lire('ev1')).resolves.toEqual({ id: 'ev1' });
    await evaluationsService.creer({ intitule: 'CC1' });
    await evaluationsService.modifier('ev1', { intitule: 'CC1' });

    expect(api.get).toHaveBeenCalledWith('/evaluations/ev1', { params: undefined });
    expect(api.post).toHaveBeenCalledWith('/evaluations', { intitule: 'CC1' }, {});
    expect(api.put).toHaveBeenCalledWith('/evaluations/ev1', { intitule: 'CC1' }, {});
  });

  it('clôture une évaluation', async () => {
    api.post.mockResolvedValue({ data: { id: 'ev1', statut: 'CLOTURE' } });

    await evaluationsService.cloturer('ev1');

    expect(api.post).toHaveBeenCalledWith('/evaluations/ev1/cloturer', undefined, {});
  });

  it('extrait les inscrits de la réponse { lignes }', async () => {
    api.get.mockResolvedValue({ data: { lignes: [{ inscriptionId: 'i1', note: 12 }] } });

    await expect(evaluationsService.etudiants('ev1')).resolves.toEqual([{ inscriptionId: 'i1', note: 12 }]);
    expect(api.get).toHaveBeenCalledWith('/evaluations/ev1/etudiants', { params: undefined });
  });

  it('accepte un tableau nu pour les inscrits', async () => {
    api.get.mockResolvedValue({ data: [{ inscriptionId: 'i2' }] });

    await expect(evaluationsService.etudiants('ev1')).resolves.toEqual([{ inscriptionId: 'i2' }]);
  });
});
