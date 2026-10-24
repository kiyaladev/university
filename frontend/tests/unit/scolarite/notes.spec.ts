import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { notesService } from '../../../src/features/scolarite/services/notes';

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/notes', () => {
  it('lit le registre des notes d’une évaluation', async () => {
    api.get.mockResolvedValue({ data: { evaluation: { id: 'ev1' }, lignes: [{ inscriptionId: 'i1', note: 10 }] } });

    const resultat = await notesService.evaluation('ev1');

    expect(resultat.evaluation).toEqual({ id: 'ev1' });
    expect(resultat.lignes).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/notes/evaluation/ev1', { params: undefined });
  });

  it('enregistre la saisie des notes', async () => {
    api.put.mockResolvedValue({ data: { n: 2, ignorees: 0 } });

    const resultat = await notesService.saisie({
      evaluationId: 'ev1',
      notes: [
        { inscriptionId: 'i1', note: 10, present: true },
        { inscriptionId: 'i2', note: null, present: false },
      ],
    });

    expect(resultat).toEqual({ n: 2, ignorees: 0 });
    expect(api.put).toHaveBeenCalledWith(
      '/notes/saisie',
      {
        evaluationId: 'ev1',
        notes: [
          { inscriptionId: 'i1', note: 10, present: true },
          { inscriptionId: 'i2', note: null, present: false },
        ],
      },
      {},
    );
  });
});
