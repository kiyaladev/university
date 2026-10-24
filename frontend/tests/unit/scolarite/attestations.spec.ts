import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { attestationsService } from '../../../src/features/scolarite/services/attestations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('features/scolarite/services/attestations', () => {
  it('liste les attestations filtrées', async () => {
    const page = { data: [{ id: 'a1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await attestationsService.liste({ type: 'SCOLARITE', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/attestations', { params: { type: 'SCOLARITE', page: 1, pageSize: 20 } });
  });

  it('émet une attestation', async () => {
    api.post.mockResolvedValue({ data: { id: 'a1', numero: 'ATT-1' } });

    await attestationsService.creer({ etudiantId: 'e1', type: 'SCOLARITE' });

    expect(api.post).toHaveBeenCalledWith('/attestations', { etudiantId: 'e1', type: 'SCOLARITE' }, {});
  });

  it('révoque une attestation avec son motif', async () => {
    api.post.mockResolvedValue({ data: { id: 'a1', statut: 'REVOQUE' } });

    await attestationsService.revoquer('a1', 'Erreur de nom');

    expect(api.post).toHaveBeenCalledWith('/attestations/a1/revoquer', { motifRevocation: 'Erreur de nom' }, {});
  });

  it('lit le journal des vérifications', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'v1', resultat: true }] });

    const resultat = await attestationsService.verifications('a1');

    expect(resultat).toEqual([{ id: 'v1', resultat: true }]);
    expect(api.get).toHaveBeenCalledWith('/attestations/a1/verifications', { params: undefined });
  });
});
