import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { reclamationsService } from '../../../src/features/scolarite/services/reclamations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('features/scolarite/services/reclamations', () => {
  it('liste les réclamations', async () => {
    const page = { data: [{ id: 'r1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await reclamationsService.liste({ statut: 'OUVERT', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/reclamations', { params: { statut: 'OUVERT', page: 1, pageSize: 20 } });
  });

  it('liste les réclamations de l’étudiant connecté', async () => {
    const page = { data: [{ id: 'r1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await reclamationsService.mesReclamations({ statut: 'OUVERT', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/reclamations/me', { params: { statut: 'OUVERT', page: 1, pageSize: 20 } });
  });

  it('lit une réclamation, le tableau de bord et les agents', async () => {
    api.get.mockResolvedValue({ data: { id: 'r1' } });

    await reclamationsService.lire('r1');
    await reclamationsService.tableauBord();
    await reclamationsService.agents();

    expect(api.get).toHaveBeenCalledWith('/reclamations/r1', { params: undefined });
    expect(api.get).toHaveBeenCalledWith('/reclamations/dashboard', { params: undefined });
    expect(api.get).toHaveBeenCalledWith('/reclamations/agents', { params: undefined });
  });

  it('dépose une réclamation', async () => {
    api.post.mockResolvedValue({ data: { id: 'r2' } });

    await reclamationsService.creer({ type: 'INSCRIPTION', sujet: 'Dossier incomplet' });

    expect(api.post).toHaveBeenCalledWith('/reclamations', { type: 'INSCRIPTION', sujet: 'Dossier incomplet' }, {});
  });

  it('ajoute un message au fil de discussion', async () => {
    api.post.mockResolvedValue({ data: { id: 'r1' } });

    await reclamationsService.ajouterMessage('r1', 'Merci de vérifier mon dossier');

    expect(api.post).toHaveBeenCalledWith(
      '/reclamations/r1/messages',
      { contenu: 'Merci de vérifier mon dossier' },
      {},
    );
  });

  it('change le statut, avec son commentaire optionnel', async () => {
    api.put.mockResolvedValue({ data: { id: 'r1' } });

    await reclamationsService.changerStatut('r1', 'EN_COURS');
    await reclamationsService.changerStatut('r1', 'REJETE', 'Hors délai');

    expect(api.put).toHaveBeenNthCalledWith(1, '/reclamations/r1/statut', { statut: 'EN_COURS' }, {});
    expect(api.put).toHaveBeenNthCalledWith(
      2,
      '/reclamations/r1/statut',
      { statut: 'REJETE', commentaire: 'Hors délai' },
      {},
    );
  });

  it('assigne, escalade et clôture une réclamation', async () => {
    api.put.mockResolvedValue({ data: { id: 'r1' } });
    api.post.mockResolvedValue({ data: { id: 'r1' } });

    await reclamationsService.assigner('r1', 'u1');
    await reclamationsService.escalader('r1');
    await reclamationsService.cloturer('r1', 'Dossier corrigé');

    expect(api.put).toHaveBeenCalledWith('/reclamations/r1/assigner', { assigneAId: 'u1' }, {});
    expect(api.post).toHaveBeenCalledWith('/reclamations/r1/escalader', undefined, {});
    expect(api.post).toHaveBeenCalledWith('/reclamations/r1/cloturer', { noteCloture: 'Dossier corrigé' }, {});
  });
});
