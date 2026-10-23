import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { notificationsService } from '../../src/features/administration/services/notifications';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/administration/services/notifications', () => {
  it('liste l’historique paginé des envois', async () => {
    const page = { data: [{ id: 'n1' }], total: 1, page: 1, pageSize: 25 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await notificationsService.historique({ page: 1, pageSize: 25, statut: 'ECHOUE' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/notifications', {
      params: { page: 1, pageSize: 25, statut: 'ECHOUE' },
    });
  });

  it('envoie une diffusion à tous les inscrits', async () => {
    api.post.mockResolvedValue({ data: { total: 3, envoyees: 3, echouees: 0 } });

    const resultat = await notificationsService.envoyer({
      message: 'Bonjour',
      motif: 'AVIS',
      tousInscrits: true,
      mode: 'tousInscrits',
    });

    expect(resultat).toEqual({ total: 3, envoyees: 3, echouees: 0 });
    expect(api.post).toHaveBeenCalledWith(
      '/notifications',
      { message: 'Bonjour', motif: 'AVIS', tousInscrits: true, mode: 'tousInscrits' },
      {},
    );
  });

  it('estime le nombre de destinataires d’un mode de diffusion', async () => {
    api.get.mockResolvedValue({ data: { total: 120 } });

    const resultat = await notificationsService.estimerDestinataires('tousInscrits');

    expect(resultat.total).toBe(120);
    expect(api.get).toHaveBeenCalledWith('/notifications/destinataires/estimes', {
      params: { mode: 'tousInscrits' },
    });
  });

  it('liste les délibérations dont les résultats peuvent être diffusés', async () => {
    const deliberations = [{ id: 'd1', session: 'NORMALE', annee: '2025-2026', promotion: 'L1', lignes: 42 }];
    api.get.mockResolvedValue({ data: deliberations });

    const resultat = await notificationsService.deliberations();

    expect(resultat).toBe(deliberations);
    expect(api.get).toHaveBeenCalledWith('/notifications/deliberations', { params: undefined });
  });

  it('diffuse les résultats d’une délibération', async () => {
    api.post.mockResolvedValue({ data: { total: 10, envoyees: 9, echouees: 1 } });

    const resultat = await notificationsService.diffuserResultats('d1');

    expect(resultat.echouees).toBe(1);
    expect(api.post).toHaveBeenCalledWith('/notifications/resultats-deliberation', { deliberationId: 'd1' }, {});
  });

  it('lit les compteurs d’envois par statut', async () => {
    api.get.mockResolvedValue({ data: { EN_ATTENTE: 1, ENVOYE: 2, ECHOUE: 3 } });

    const resultat = await notificationsService.stats();

    expect(resultat).toEqual({ EN_ATTENTE: 1, ENVOYE: 2, ECHOUE: 3 });
    expect(api.get).toHaveBeenCalledWith('/notifications/stats', { params: undefined });
  });

  it('lit la répartition des envois sur la période demandée', async () => {
    api.get.mockResolvedValue({ data: [{ date: '2026-01-01', EN_ATTENTE: 0, ENVOYE: 2, ECHOUE: 0 }] });

    const resultat = await notificationsService.repartition(30);

    expect(resultat).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/notifications/stats/repartition', { params: { jours: 30 } });
  });
});
