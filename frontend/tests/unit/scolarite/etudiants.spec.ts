import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { etudiantsService } from '../../../src/features/scolarite/services/etudiants';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/etudiants', () => {
  it('liste le registre avec ses filtres', async () => {
    const page = { data: [{ id: 'e1' }], total: 1, page: 1, pageSize: 50 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await etudiantsService.liste({ search: 'diallo', page: 2 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/etudiants', { params: { search: 'diallo', page: 2 } });
  });

  it('normalise la liste complète en tableau', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'e1' }], total: 1, page: 1, pageSize: 50 } });

    await expect(etudiantsService.tous({ search: 'di', all: '1' })).resolves.toEqual([{ id: 'e1' }]);
    expect(api.get).toHaveBeenCalledWith('/etudiants', { params: { search: 'di', all: '1' } });
  });

  it('lit une fiche puis la modifie', async () => {
    api.get.mockResolvedValue({ data: { id: 'e1' } });
    api.put.mockResolvedValue({ data: { id: 'e1', actif: false } });

    await expect(etudiantsService.lire('e1')).resolves.toEqual({ id: 'e1' });
    await expect(etudiantsService.modifier('e1', { actif: false })).resolves.toEqual({ id: 'e1', actif: false });

    expect(api.get).toHaveBeenCalledWith('/etudiants/e1', { params: undefined });
    expect(api.put).toHaveBeenCalledWith('/etudiants/e1', { actif: false }, {});
  });

  it('ouvre un dossier étudiant', async () => {
    api.post.mockResolvedValue({ data: { id: 'e2' } });

    await etudiantsService.creer({ nom: 'Bah', prenom: 'Aminata' });

    expect(api.post).toHaveBeenCalledWith('/etudiants', { nom: 'Bah', prenom: 'Aminata' }, {});
  });
});
