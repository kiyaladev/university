import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { creer, lire, lister, modifier, supprimer } from '../../src/shared/services/http';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('shared/services/http', () => {
  it('lister passe filtres et options, et rend le corps paginé', async () => {
    const page = { data: [{ id: 'a' }], total: 1, page: 1, pageSize: 50 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await lister('/salles', { recherche: 'amphi', page: 2 }, { silencieux: true });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/salles', { silencieux: true, params: { recherche: 'amphi', page: 2 } });
  });

  it('lire, creer et modifier rendent directement le corps de la réponse', async () => {
    api.get.mockResolvedValue({ data: { id: 's1' } });
    api.post.mockResolvedValue({ data: { id: 's2' } });
    api.put.mockResolvedValue({ data: { id: 's1', nom: 'B' } });

    await expect(lire('/salles/s1')).resolves.toEqual({ id: 's1' });
    await expect(creer('/salles', { nom: 'A' })).resolves.toEqual({ id: 's2' });
    await expect(modifier('/salles/s1', { nom: 'B' })).resolves.toEqual({ id: 's1', nom: 'B' });
    expect(api.post).toHaveBeenCalledWith('/salles', { nom: 'A' }, {});
    expect(api.put).toHaveBeenCalledWith('/salles/s1', { nom: 'B' }, {});
  });

  it('supprimer appelle DELETE et laisse remonter les erreurs', async () => {
    api.delete.mockResolvedValueOnce({ data: null });
    await expect(supprimer('/salles/s1')).resolves.toBeUndefined();
    expect(api.delete).toHaveBeenCalledWith('/salles/s1', {});

    const erreur = Object.assign(new Error('409'), { response: { status: 409 } });
    api.delete.mockRejectedValueOnce(erreur);
    await expect(supprimer('/salles/s1')).rejects.toBe(erreur);
  });
});
