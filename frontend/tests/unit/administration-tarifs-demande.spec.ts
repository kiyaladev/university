import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { tarifsDemandeService, tarifsDepuis } from '../../src/features/administration/services/tarifs-demande';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const tarif = {
  id: 't1',
  type: 'ATTESTATION_SCOLARITE',
  montant: 25000,
  devise: 'GNF',
  delaiHeures: 72,
  createdAt: '2026-01-10T08:00:00.000Z',
  updatedAt: '2026-01-10T08:00:00.000Z',
};

describe('features/administration/services/tarifs-demande', () => {
  it('liste la grille des tarifs', async () => {
    api.get.mockResolvedValue({ data: [tarif] });

    const resultat = await tarifsDemandeService.liste();

    expect(resultat).toEqual([tarif]);
    expect(api.get).toHaveBeenCalledWith('/documents-demande/tarifs', { params: undefined });
  });

  it('crée un tarif', async () => {
    api.post.mockResolvedValue({ data: tarif });

    const corps = { type: 'ATTESTATION_SCOLARITE' as const, montant: 25000, delaiHeures: 72 };
    await tarifsDemandeService.creer(corps);

    expect(api.post).toHaveBeenCalledWith('/documents-demande/tarifs', corps, {});
  });

  it('modifie un tarif par son identifiant', async () => {
    api.put.mockResolvedValue({ data: tarif });

    await tarifsDemandeService.modifier('t1', { montant: 30000, delaiHeures: 48 });

    expect(api.put).toHaveBeenCalledWith('/documents-demande/tarifs/t1', { montant: 30000, delaiHeures: 48 }, {});
  });

  it('accepte une grille en tableau ou enveloppée dans data', () => {
    expect(tarifsDepuis([tarif])).toEqual([tarif]);
    expect(tarifsDepuis({ data: [tarif] })).toEqual([tarif]);
    expect(tarifsDepuis({})).toEqual([]);
    expect(tarifsDepuis(null)).toEqual([]);
  });
});
