import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { recettesService, type RecetteSaisie } from '../../src/features/finances/services/recettes';
import type { RecetteExterne } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const recette = {
  id: 'r1',
  numero: 'REC-2026-001',
  type: 'PRESTATION_FORMATION',
  libelle: 'Formation alumni',
  montant: 500000,
  devise: 'GNF',
  date: '2026-03-01',
  createdAt: '2026-03-01T10:00:00.000Z',
} as RecetteExterne;

const saisie: RecetteSaisie = {
  type: 'PRESTATION_FORMATION',
  libelle: 'Formation alumni',
  description: null,
  montant: 500000,
  devise: 'GNF',
  date: '2026-03-01',
  client: null,
  factureNum: null,
};

describe('features/finances/services/recettes', () => {
  it('liste le registre paginé avec ses filtres', async () => {
    const page = { data: [recette], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await recettesService.liste({
      page: 1,
      pageSize: 20,
      search: 'alumni',
      type: 'PRESTATION_FORMATION',
      paiementStatut: 'A_ENCAISSER',
      dateDebut: '2026-02-01',
      dateFin: '2026-03-01',
    });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/recettes', {
      params: {
        page: 1,
        pageSize: 20,
        search: 'alumni',
        type: 'PRESTATION_FORMATION',
        paiementStatut: 'A_ENCAISSER',
        dateDebut: '2026-02-01',
        dateFin: '2026-03-01',
      },
    });
  });

  it('lit les totaux du tableau de bord', async () => {
    const kpis = { annee: 2026, totalMois: 1200000, totalAnnee: 9000000, top3: [] };
    api.get.mockResolvedValue({ data: kpis });

    const resultat = await recettesService.dashboard();

    expect(resultat).toBe(kpis);
    expect(api.get).toHaveBeenCalledWith('/recettes/dashboard', { params: undefined });
  });

  it('émet une recette avec son numéro', async () => {
    api.post.mockResolvedValue({ data: recette });

    await recettesService.creer({ numero: 'REC-2026-001', ...saisie });

    expect(api.post).toHaveBeenCalledWith('/recettes', { numero: 'REC-2026-001', ...saisie }, {});
  });

  it('modifie une recette par son identifiant', async () => {
    api.put.mockResolvedValue({ data: recette });

    await recettesService.modifier('r1', saisie);

    expect(api.put).toHaveBeenCalledWith('/recettes/r1', saisie, {});
  });

  it('encaisse une recette', async () => {
    api.post.mockResolvedValue({ data: { ...recette, paiementId: 'p1' } });

    await recettesService.encaisser('r1');

    expect(api.post).toHaveBeenCalledWith('/recettes/r1/encaisser', {}, {});
  });
});
