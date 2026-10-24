import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { creneauxService } from '../../src/features/presence/services/creneaux';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const creneau = {
  id: 'c1',
  affectationId: 'a1',
  jourSemaine: 1,
  heureDebut: '08:00',
  heureFin: '10:00',
  type: 'CM',
  actif: true,
};

describe('features/presence/services/creneaux', () => {
  it('lit l’emploi du temps de la semaine', async () => {
    api.get.mockResolvedValue({ data: [{ jour: 1, libelle: 'Lundi', creneaux: [creneau] }] });

    const semaine = await creneauxService.emploiDuTemps({ semaineDu: '2026-01-05', promotionId: 'p1' });

    expect(semaine[0].creneaux).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/creneaux/emploi-du-temps', {
      params: { semaineDu: '2026-01-05', promotionId: 'p1' },
    });
  });

  it('crée un créneau en silence : le conflit s’affiche dans le bandeau', async () => {
    api.post.mockResolvedValue({ data: creneau });

    await creneauxService.creer({
      affectationId: 'a1',
      jourSemaine: 1,
      heureDebut: '08:00',
      heureFin: '10:00',
      type: 'CM',
      salleId: 'sa1',
      dateDebut: null,
      dateFin: null,
    });

    expect(api.post).toHaveBeenCalledWith(
      '/creneaux',
      {
        affectationId: 'a1',
        jourSemaine: 1,
        heureDebut: '08:00',
        heureFin: '10:00',
        type: 'CM',
        salleId: 'sa1',
        dateDebut: null,
        dateFin: null,
      },
      { silencieux: true },
    );
  });

  it('modifie un créneau en silence', async () => {
    api.put.mockResolvedValue({ data: creneau });

    await creneauxService.modifier('c1', {
      affectationId: 'a1',
      jourSemaine: 2,
      heureDebut: '10:00',
      heureFin: '12:00',
      type: 'TD',
    });

    expect(api.put).toHaveBeenCalledWith(
      '/creneaux/c1',
      { affectationId: 'a1', jourSemaine: 2, heureDebut: '10:00', heureFin: '12:00', type: 'TD' },
      { silencieux: true },
    );
  });

  it('supprime un créneau en silence : le motif s’affiche dans le bandeau', async () => {
    api.delete.mockResolvedValue({ data: null });

    await creneauxService.supprimer('c1');

    expect(api.delete).toHaveBeenCalledWith('/creneaux/c1', { silencieux: true });
  });
});
