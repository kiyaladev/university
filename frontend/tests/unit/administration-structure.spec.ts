import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { structureService } from '../../src/features/administration/services/structure';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/structure', () => {
  it('charge toutes les filières en une requête', async () => {
    const page = { data: [{ id: 'f1', code: 'LIC', nom: 'Licence' }], total: 1, page: 1, pageSize: 1 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await structureService.filieres();

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/filieres', { params: { all: '1' } });
  });

  it('crée une année académique', async () => {
    api.post.mockResolvedValue({ data: { id: 'a1' } });

    await structureService.creerAnnee({ libelle: '2025-2026', dateDebut: '2025-10-01', dateFin: '2026-07-31' });

    expect(api.post).toHaveBeenCalledWith(
      '/annees',
      { libelle: '2025-2026', dateDebut: '2025-10-01', dateFin: '2026-07-31' },
      {},
    );
  });

  it('modifie une année académique par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'a1' } });

    await structureService.modifierAnnee('a1', { active: true });

    expect(api.put).toHaveBeenCalledWith('/annees/a1', { active: true }, {});
  });

  it('crée un département', async () => {
    api.post.mockResolvedValue({ data: { id: 'd1' } });

    await structureService.creerDepartement({ code: 'SCI', nom: 'Sciences', faculte: 'F1' });

    expect(api.post).toHaveBeenCalledWith('/departements', { code: 'SCI', nom: 'Sciences', faculte: 'F1' }, {});
  });

  it('modifie un département par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'd1' } });

    await structureService.modifierDepartement('d1', { nom: 'Sciences et Techniques' });

    expect(api.put).toHaveBeenCalledWith('/departements/d1', { nom: 'Sciences et Techniques' }, {});
  });

  it('crée une filière', async () => {
    api.post.mockResolvedValue({ data: { id: 'f1' } });

    await structureService.creerFiliere({ code: 'LIC', nom: 'Licence', departementId: 'd1' });

    expect(api.post).toHaveBeenCalledWith('/filieres', { code: 'LIC', nom: 'Licence', departementId: 'd1' }, {});
  });

  it('modifie une filière par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'f1' } });

    await structureService.modifierFiliere('f1', { nom: 'Licence A' });

    expect(api.put).toHaveBeenCalledWith('/filieres/f1', { nom: 'Licence A' }, {});
  });

  it('crée une promotion', async () => {
    api.post.mockResolvedValue({ data: { id: 'p1' } });

    await structureService.creerPromotion({
      nom: 'Licence 1 A',
      niveau: 'L1',
      effectif: 120,
      filiereId: 'f1',
      anneeId: 'a1',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/promotions',
      { nom: 'Licence 1 A', niveau: 'L1', effectif: 120, filiereId: 'f1', anneeId: 'a1' },
      {},
    );
  });

  it('modifie une promotion par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'p1' } });

    await structureService.modifierPromotion('p1', { effectif: 130 });

    expect(api.put).toHaveBeenCalledWith('/promotions/p1', { effectif: 130 }, {});
  });
});
