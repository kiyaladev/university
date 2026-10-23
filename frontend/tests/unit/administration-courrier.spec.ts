import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  STATUTS_ARCHIVE,
  courrierService,
  listeCourrierArchive,
} from '../../src/features/administration/services/courrier';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const courrier = {
  id: 'c1',
  numero: 'COUR-001',
  type: 'ENTRANT',
  objet: 'Demande de document',
  statut: 'RECU',
  createdAt: '2026-01-10T08:00:00.000Z',
  updatedAt: '2026-01-10T08:00:00.000Z',
};

const page = (lignes: unknown[], total = lignes.length) => ({
  data: lignes,
  total,
  page: 1,
  pageSize: 20,
});

describe('features/administration/services/courrier', () => {
  it('liste les courriers avec ses filtres', async () => {
    const reponse = page([courrier]);
    api.get.mockResolvedValue({ data: reponse });

    const resultat = await courrierService.liste({
      type: 'ENTRANT',
      statut: 'RECU',
      search: 'document',
      page: 1,
      pageSize: 20,
    });

    expect(resultat).toBe(reponse);
    expect(api.get).toHaveBeenCalledWith('/courrier', {
      params: { type: 'ENTRANT', statut: 'RECU', search: 'document', page: 1, pageSize: 20 },
    });
  });

  it('lit la fiche d’un courrier', async () => {
    api.get.mockResolvedValue({ data: courrier });

    const resultat = await courrierService.lire('c1');

    expect(resultat).toBe(courrier);
    expect(api.get).toHaveBeenCalledWith('/courrier/c1', { params: undefined });
  });

  it('enregistre un courrier et son circuit', async () => {
    api.post.mockResolvedValue({ data: courrier });

    const corps = {
      numero: 'COUR-001',
      type: 'ENTRANT' as const,
      objet: 'Demande de document',
      circuit: [{ ordre: 1, roleValideur: 'Scolarité' }],
    };
    await courrierService.creer(corps);

    expect(api.post).toHaveBeenCalledWith('/courrier', corps, {});
  });

  it('clôture un courrier', async () => {
    api.post.mockResolvedValue({ data: courrier });

    await courrierService.cloturer('c1');

    expect(api.post).toHaveBeenCalledWith('/courrier/c1/cloturer', {}, {});
  });

  it('paraphe une étape du circuit', async () => {
    api.post.mockResolvedValue({ data: courrier });

    await courrierService.parapher('c1', 'e1', { paraphe: 'ABC', commentaire: 'vu' });

    expect(api.post).toHaveBeenCalledWith('/courrier/c1/parapher/e1', { paraphe: 'ABC', commentaire: 'vu' }, {});
  });

  it('additionne les deux statuts d’archive', async () => {
    api.get
      .mockResolvedValueOnce({ data: page([{ ...courrier, statut: 'CLASSE' }], 3) })
      .mockResolvedValueOnce({ data: page([{ ...courrier, statut: 'ARCHIVE' }], 5) });

    const resultat = await listeCourrierArchive({ page: 1, pageSize: 20 });

    expect(resultat.total).toBe(8);
    expect(resultat.data.map((c) => c.statut)).toEqual(['CLASSE', 'ARCHIVE']);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenNthCalledWith(1, '/courrier', {
      params: { page: 1, pageSize: 20, statut: 'CLASSE' },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/courrier', {
      params: { page: 1, pageSize: 20, statut: 'ARCHIVE' },
    });
  });

  it('ne demande qu’un statut quand un statut d’archive est imposé', async () => {
    api.get.mockResolvedValueOnce({ data: page([courrier], 1) });

    const resultat = await listeCourrierArchive({}, 'ARCHIVE');

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/courrier', { params: { statut: 'ARCHIVE' } });
    expect(resultat.total).toBe(1);
  });

  it('ignore un statut qui n’est pas une archive', async () => {
    const resultat = await listeCourrierArchive({}, 'RECU');

    expect(api.get).not.toHaveBeenCalled();
    expect(resultat).toEqual({ data: [], total: 0 });
  });

  it('connaît les deux statuts d’archive', () => {
    expect([...STATUTS_ARCHIVE]).toEqual(['CLASSE', 'ARCHIVE']);
  });
});
