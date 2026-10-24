import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  bibliothequePubliqueService,
  optionsDepartements,
} from '../../src/features/public/services/bibliotheque-publique';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const departement = { id: 'd1', code: 'MATH', nom: 'Mathématiques', faculte: null };

describe('features/public/services/bibliotheque-publique', () => {
  it('charge les départements du filtre en silence', async () => {
    api.get.mockResolvedValue({ data: [departement] });

    const resultat = await bibliothequePubliqueService.departements();

    expect(resultat).toEqual([departement]);
    expect(api.get).toHaveBeenCalledWith('/departements/public', { silencieux: true, params: {} });
  });

  it('accepte un tableau enveloppé dans `data`', async () => {
    api.get.mockResolvedValue({ data: { data: [departement] } });

    await expect(bibliothequePubliqueService.departements()).resolves.toEqual([departement]);
  });

  it('renvoie une liste vide si le backend ne rend rien d’exploitable', async () => {
    api.get.mockResolvedValue({ data: {} });

    await expect(bibliothequePubliqueService.departements()).resolves.toEqual([]);
  });

  it('transforme les départements en options du sélecteur', () => {
    expect(optionsDepartements([departement])).toEqual([{ label: 'Mathématiques', value: 'd1' }]);
    expect(optionsDepartements([])).toEqual([]);
  });
});
