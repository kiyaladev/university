import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { utilisateursService } from '../../src/features/administration/services/utilisateurs';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/utilisateurs', () => {
  it('liste les comptes avec pagination et filtres', async () => {
    const page = { data: [{ id: 'u1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await utilisateursService.liste({
      page: 1,
      pageSize: 20,
      search: 'diallo',
      role: 'ENSEIGNANT',
      departementId: 'd1',
    });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/utilisateurs', {
      params: { page: 1, pageSize: 20, search: 'diallo', role: 'ENSEIGNANT', departementId: 'd1' },
    });
  });

  it('crée un compte', async () => {
    api.post.mockResolvedValue({ data: { id: 'u1' } });

    await utilisateursService.creer({
      nom: 'Diallo',
      prenom: 'Aminata',
      email: 'aminata.diallo@example.com',
      password: 'secret1',
      role: 'CONTROLEUR',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/utilisateurs',
      {
        nom: 'Diallo',
        prenom: 'Aminata',
        email: 'aminata.diallo@example.com',
        password: 'secret1',
        role: 'CONTROLEUR',
      },
      {},
    );
  });

  it('modifie un compte par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'u1' } });

    await utilisateursService.modifier('u1', { actif: false });

    expect(api.put).toHaveBeenCalledWith('/utilisateurs/u1', { actif: false }, {});
  });
});
