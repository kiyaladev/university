import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { examensService } from '../../../src/features/scolarite/services/examens';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/examens', () => {
  it('liste les examens filtrés', async () => {
    const page = { data: [{ id: 'x1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await examensService.liste({ statut: 'PLANIFIE', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/examens', { params: { statut: 'PLANIFIE', page: 1, pageSize: 20 } });
  });

  it('normalise la liste des examens en tableau', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'x1' }], total: 1, page: 1, pageSize: 50 } });

    await expect(examensService.tous({ statut: 'PLANIFIE' })).resolves.toEqual([{ id: 'x1' }]);
  });

  it('lit une fiche, ses scans et ses statistiques', async () => {
    api.get.mockResolvedValue({ data: { id: 'x1' } });

    await expect(examensService.lire('x1')).resolves.toEqual({ id: 'x1' });
    await examensService.scans('x1');
    await examensService.stats('x1');

    expect(api.get).toHaveBeenCalledWith('/examens/x1', { params: undefined });
    expect(api.get).toHaveBeenCalledWith('/examens/x1/scans', { params: undefined });
    expect(api.get).toHaveBeenCalledWith('/examens/x1/stats', { params: undefined });
  });

  it('planifie un examen', async () => {
    api.post.mockResolvedValue({ data: { id: 'x2' } });

    await examensService.creer({ intitule: 'Partiel' });

    expect(api.post).toHaveBeenCalledWith('/examens', { intitule: 'Partiel' }, {});
  });

  it('change le statut et exécute une action de cycle de vie', async () => {
    api.put.mockResolvedValue({ data: { id: 'x1', statut: 'ANNULE' } });
    api.post.mockResolvedValue({ data: { id: 'x1', statut: 'EN_COURS' } });

    await examensService.changerStatut('x1', 'ANNULE');
    await examensService.action('x1', 'demarrer');

    expect(api.put).toHaveBeenCalledWith('/examens/x1/statut', { statut: 'ANNULE' }, {});
    expect(api.post).toHaveBeenCalledWith('/examens/x1/demarrer', undefined, {});
  });

  it('enregistre un scan de présence', async () => {
    api.post.mockResolvedValue({ data: { id: 's1' } });

    await examensService.scanner({ examenId: 'x1', code: 'EX-1' });

    expect(api.post).toHaveBeenCalledWith('/examens/scan', { examenId: 'x1', code: 'EX-1' }, {});
  });
});
