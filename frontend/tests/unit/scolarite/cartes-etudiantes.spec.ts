import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { cartesEtudiantesService } from '../../../src/features/scolarite/services/cartes-etudiantes';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('features/scolarite/services/cartes-etudiantes', () => {
  it('liste le registre des cartes', async () => {
    const page = { data: [{ id: 'c1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await cartesEtudiantesService.liste({ etudiantId: 'e1', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/cartes-etudiantes', { params: { etudiantId: 'e1', page: 1, pageSize: 20 } });
  });

  it('lit la carte de l’étudiant connecté', async () => {
    api.get.mockResolvedValue({ data: { id: 'c1', statut: 'EMIS' } });

    await expect(cartesEtudiantesService.maCarte()).resolves.toEqual({ id: 'c1', statut: 'EMIS' });
    expect(api.get).toHaveBeenCalledWith('/cartes-etudiantes/me', { params: undefined });
  });

  it('définit le NIP de la carte', async () => {
    api.post.mockResolvedValue({ data: { id: 'c1' } });

    await cartesEtudiantesService.definirNip('c1', '1234');

    expect(api.post).toHaveBeenCalledWith('/cartes-etudiantes/c1/nip', { nip: '1234' }, {});
  });

  it('révoque une carte avec son motif', async () => {
    api.post.mockResolvedValue({ data: { id: 'c1', statut: 'REVOQUE' } });

    await cartesEtudiantesService.revoquer('c1', 'Carte perdue');

    expect(api.post).toHaveBeenCalledWith('/cartes-etudiantes/c1/revoquer', { motif: 'Carte perdue' }, {});
  });
});
