import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { portailService } from '../../../src/features/scolarite/services/portail';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('features/scolarite/services/portail', () => {
  it('lit le dossier et les résultats de l’étudiant', async () => {
    api.get.mockResolvedValue({ data: { etudiant: { id: 'e1' } } });

    await expect(portailService.profil({ silencieux: true })).resolves.toEqual({ etudiant: { id: 'e1' } });
    await portailService.resultats({ silencieux: true });

    expect(api.get).toHaveBeenNthCalledWith(1, '/portail/me', { silencieux: true, params: undefined });
    expect(api.get).toHaveBeenNthCalledWith(2, '/portail/resultats', { silencieux: true, params: undefined });
  });

  it('lit le portefeuille resto', async () => {
    api.get.mockResolvedValue({ data: { solde: 5000 } });

    await expect(portailService.resto({ silencieux: true })).resolves.toEqual({ solde: 5000 });
    expect(api.get).toHaveBeenCalledWith('/portail/resto/me', { silencieux: true, params: undefined });
  });

  it('recharge le portefeuille resto', async () => {
    api.post.mockResolvedValue({ data: { instructions: 'Payer au guichet' } });

    await portailService.rechargerResto({ montant: 10000, mode: 'MOBILE_MONEY', operateur: 'ORANGE_MONEY' });

    expect(api.post).toHaveBeenCalledWith(
      '/portail/resto/recharger',
      { montant: 10000, mode: 'MOBILE_MONEY', operateur: 'ORANGE_MONEY' },
      {},
    );
  });
});
