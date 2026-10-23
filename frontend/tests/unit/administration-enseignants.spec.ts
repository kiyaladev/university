import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { enseignantsService } from '../../src/features/administration/services/enseignants';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/enseignants', () => {
  it('liste les enseignants avec les filtres demandés', async () => {
    const page = { data: [{ id: 'e1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await enseignantsService.liste({ page: 1, pageSize: 20, search: 'Dupont' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/enseignants', {
      params: { page: 1, pageSize: 20, search: 'Dupont' },
    });
  });

  it('crée un enseignant', async () => {
    api.post.mockResolvedValue({ data: { id: 'e1' } });

    await enseignantsService.creer({ nom: 'Dupont', prenom: 'Awa' });

    expect(api.post).toHaveBeenCalledWith('/enseignants', { nom: 'Dupont', prenom: 'Awa' }, {});
  });

  it('modifie la fiche d’un enseignant par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { id: 'e1' } });

    await enseignantsService.modifier('e1', { grade: 'Maitre-assistant' });

    expect(api.put).toHaveBeenCalledWith('/enseignants/e1', { grade: 'Maitre-assistant' }, {});
  });

  it('supprime un enseignant', async () => {
    api.delete.mockResolvedValue({ data: undefined });

    await enseignantsService.supprimer('e1');

    expect(api.delete).toHaveBeenCalledWith('/enseignants/e1', {});
  });

  it('lit les moyens d’attestation d’un enseignant', async () => {
    api.get.mockResolvedValue({ data: { codePin: true, empreinte: false } });

    const resultat = await enseignantsService.moyens('e1');

    expect(resultat).toEqual({ codePin: true, empreinte: false });
    expect(api.get).toHaveBeenCalledWith('/attestation/enseignants/e1/moyens', { params: undefined });
  });

  it('réinitialise le code personnel d’un enseignant', async () => {
    api.post.mockResolvedValue({ data: { code: '1234' } });

    const resultat = await enseignantsService.reinitialiserCodePin('e1');

    expect(resultat.code).toBe('1234');
    expect(api.post).toHaveBeenCalledWith('/attestation/enseignants/e1/code-pin/reinitialiser', undefined, {});
  });

  it('enregistre l’empreinte en opinant le consentement par défaut', async () => {
    api.put.mockResolvedValue({ data: { message: 'ok' } });

    await enseignantsService.enregistrerEmpreinte('e1', {
      template: 'T',
      horodatage: '2026-01-01T00:00:00Z',
      signature: 'S',
      qualite: 80,
    });

    expect(api.put).toHaveBeenCalledWith(
      '/attestation/enseignants/e1/empreinte',
      { template: 'T', horodatage: '2026-01-01T00:00:00Z', signature: 'S', qualite: 80, consentement: true },
      {},
    );
  });
});
