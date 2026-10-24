import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { portailService } from '../../src/features/public/services/portail';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/public/services/portail', () => {
  it('demande l’envoi du code en silence', async () => {
    api.post.mockResolvedValue({ data: { message: 'ok' } });

    const resultat = await portailService.demanderCode({ telephone: '622000000' });

    expect(resultat).toEqual({ message: 'ok' });
    expect(api.post).toHaveBeenCalledWith('/portail/otp', { telephone: '622000000' }, { silencieux: true });
  });

  it('laisse remonter l’erreur : la page l’affiche dans son bandeau', async () => {
    const erreur = Object.assign(new Error('400'), { response: { data: { message: 'Refusé' } } });
    api.post.mockRejectedValue(erreur);

    await expect(portailService.demanderCode({ telephone: '622' })).rejects.toBe(erreur);
  });
});
