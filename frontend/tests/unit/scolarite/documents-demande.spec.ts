import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/boot/axios', () => ({ api }));

import { demandesDocumentsService } from '../../../src/features/scolarite/services/documents-demande';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('features/scolarite/services/documents-demande', () => {
  it('liste le registre des demandes', async () => {
    const page = { data: [{ id: 'dd1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await demandesDocumentsService.liste({ statut: 'PAYE', page: 1, pageSize: 20 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/documents-demande', { params: { statut: 'PAYE', page: 1, pageSize: 20 } });
  });

  it('liste les demandes de l’étudiant connecté', async () => {
    const page = { data: [{ id: 'dd1' }], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    await demandesDocumentsService.mesDemandes({ page: 1, pageSize: 20 });

    expect(api.get).toHaveBeenCalledWith('/documents-demande/mes', { params: { page: 1, pageSize: 20 } });
  });

  it('lit une demande, le tableau de bord et les tarifs', async () => {
    api.get.mockResolvedValue({ data: { id: 'dd1' } });

    await demandesDocumentsService.lire('dd1');
    await demandesDocumentsService.tableauBord();
    await demandesDocumentsService.tarifs();

    expect(api.get).toHaveBeenCalledWith('/documents-demande/dd1', { params: undefined });
    expect(api.get).toHaveBeenCalledWith('/documents-demande/dashboard', { params: undefined });
    expect(api.get).toHaveBeenCalledWith('/documents-demande/tarifs', { params: undefined });
  });

  it('dépose une demande de document', async () => {
    api.post.mockResolvedValue({ data: { id: 'dd2' } });

    await demandesDocumentsService.creer({ type: 'RELEVE_NOTES' });

    expect(api.post).toHaveBeenCalledWith('/documents-demande', { type: 'RELEVE_NOTES' }, {});
  });

  it('exécute une action de workflow', async () => {
    api.post.mockResolvedValue({ data: { id: 'dd1', statut: 'PRET' } });

    await demandesDocumentsService.action('dd1', 'prete', { message: 'Votre document est prêt' });

    expect(api.post).toHaveBeenCalledWith('/documents-demande/dd1/prete', { message: 'Votre document est prêt' }, {});
  });

  it('lance le paiement d’une demande', async () => {
    api.post.mockResolvedValue({ data: { id: 'dd1' } });

    await demandesDocumentsService.payer('dd1', { mode: 'MOBILE_MONEY', telephone: '622000000' });

    expect(api.post).toHaveBeenCalledWith(
      '/documents-demande/dd1/payer',
      { mode: 'MOBILE_MONEY', telephone: '622000000' },
      {},
    );
  });
});
