import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { justificatifsService } from '../../src/features/presence/services/justificatifs';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/presence/services/justificatifs', () => {
  it('liste les justificatifs filtrés', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'j1' }], total: 1, page: 1, pageSize: 50 } });

    const page = await justificatifsService.liste({ statut: 'EN_ATTENTE', all: '1' });

    expect(page.data).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/justificatifs', {
      params: { statut: 'EN_ATTENTE', all: '1' },
    });
  });

  it('dépose un justificatif pour une séance', async () => {
    api.post.mockResolvedValue({ data: { id: 'j1', statut: 'EN_ATTENTE' } });

    const justificatif = await justificatifsService.deposer({
      seanceId: 's1',
      type: 'CERTIFICAT_MEDICAL',
      motif: 'Maladie',
      piece: 'data:image/png;base64,AAA',
      enseignantId: 'e1',
    });

    expect(justificatif.statut).toBe('EN_ATTENTE');
    expect(api.post).toHaveBeenCalledWith(
      '/justificatifs',
      {
        seanceId: 's1',
        type: 'CERTIFICAT_MEDICAL',
        motif: 'Maladie',
        piece: 'data:image/png;base64,AAA',
        enseignantId: 'e1',
      },
      {},
    );
  });

  it('valide un justificatif avec un commentaire', async () => {
    api.put.mockResolvedValue({ data: { id: 'j1', statut: 'VALIDE' } });

    await justificatifsService.traiter('j1', 'VALIDE', 'Pièce recevable');

    expect(api.put).toHaveBeenCalledWith(
      '/justificatifs/j1/traiter',
      { statut: 'VALIDE', commentaire: 'Pièce recevable' },
      {},
    );
  });

  it('rejette un justificatif', async () => {
    api.put.mockResolvedValue({ data: { id: 'j1', statut: 'REJETE' } });

    await justificatifsService.traiter('j1', 'REJETE');

    expect(api.put).toHaveBeenCalledWith('/justificatifs/j1/traiter', { statut: 'REJETE', commentaire: undefined }, {});
  });
});
