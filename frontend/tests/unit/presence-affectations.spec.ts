import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { affectationsService, libelleAffectation } from '../../src/features/presence/services/affectations';
import type { Affectation } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const affectation = {
  id: 'a1',
  enseignantId: 'e1',
  matiereId: 'm1',
  promotionId: 'p1',
  anneeId: 'an1',
  volumeHorairePrevu: 60,
  enseignant: { id: 'e1', nom: 'Koné', prenom: 'Awa' },
  matiere: { id: 'm1', code: 'MATH1', intitule: 'Mathématiques' },
  promotion: { id: 'p1', nom: 'Licence 1' },
} as unknown as Affectation;

describe('features/presence/services/affectations', () => {
  it('liste les affectations filtrées', async () => {
    api.get.mockResolvedValue({ data: { data: [affectation], total: 1, page: 1, pageSize: 50 } });

    const page = await affectationsService.liste({ enseignantId: 'e1' });

    expect(page.data).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/affectations', { params: { enseignantId: 'e1' } });
  });

  it('demande toutes les affectations en un seul appel', async () => {
    api.get.mockResolvedValue({ data: { data: [affectation], total: 1, page: 1, pageSize: 50 } });

    await affectationsService.toutes();

    expect(api.get).toHaveBeenCalledWith('/affectations', { params: { all: '1' } });
  });

  it('compose un libellé lisible : enseignant · matière · promotion', () => {
    expect(libelleAffectation(affectation)).toBe('Koné Awa · MATH1 · Licence 1');
  });
});
