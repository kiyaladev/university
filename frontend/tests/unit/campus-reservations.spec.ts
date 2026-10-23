import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de la couche de service utilisée par les écrans « réservations » :
 * la page des réservations (calendrier + tableau) et ses deux dialogues
 * (dépôt d'une demande, détail et décision).
 *
 * Chaque appel est vérifié sur trois points : l'URL appelée, les paramètres
 * transmis et le corps rendu à l'appelant.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { reservationsService } from '../../src/features/campus/services/reservations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('reservationsService — calendrier', () => {
  it('charge la période avec ses dates et sa salle', async () => {
    api.get.mockResolvedValue({ data: { jours: [], salles: [] } });

    await reservationsService.calendrier({ dateDebut: '2026-10-01', dateFin: '2026-10-31', salleId: 's1' });

    expect(api.get).toHaveBeenCalledWith('/reservations/calendrier', {
      params: { dateDebut: '2026-10-01', dateFin: '2026-10-31', salleId: 's1' },
    });
  });

  it('renvoie les jours et les salles de la période tels quels', async () => {
    const reponse = {
      jours: [{ date: '2026-10-01', reservations: [], seances: [] }],
      salles: [{ id: 's1', code: 'A1', nom: 'Amphi 1' }],
    };
    api.get.mockResolvedValue({ data: reponse });

    const resultat = await reservationsService.calendrier({ dateDebut: '2026-10-01', dateFin: '2026-10-01' });

    expect(resultat).toBe(reponse);
    expect(resultat.jours?.[0]?.date).toBe('2026-10-01');
    expect(resultat.salles?.[0]?.code).toBe('A1');
  });
});

describe('reservationsService — conflits', () => {
  it('liste les réservations d’une salle pour une journée', async () => {
    const page = { data: [{ id: 'r1', statut: 'CONFIRME' }], total: 1, page: 1, pageSize: 0 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await reservationsService.liste({ salleId: 's1', dateJour: '2026-10-01', all: '1' });

    expect(api.get).toHaveBeenCalledWith('/reservations', {
      params: { salleId: 's1', dateJour: '2026-10-01', all: '1' },
    });
    expect(resultat.data).toHaveLength(1);
    expect(resultat.data[0]?.statut).toBe('CONFIRME');
  });
});

describe('reservationsService — écriture', () => {
  it('dépose une demande en silence, corps compris', async () => {
    api.post.mockResolvedValue({ data: { id: 'r1' } });

    const resultat = await reservationsService.creer({
      salleId: 's1',
      dateJour: '2026-10-01',
      heureDebut: '14:00',
      heureFin: '16:00',
      motif: 'Soutenance',
    });

    expect(resultat).toEqual({ id: 'r1' });
    expect(api.post).toHaveBeenCalledWith(
      '/reservations',
      { salleId: 's1', dateJour: '2026-10-01', heureDebut: '14:00', heureFin: '16:00', motif: 'Soutenance' },
      { silencieux: true },
    );
  });

  it('modifie une réservation en silence', async () => {
    api.put.mockResolvedValue({ data: { id: 'r1', heureFin: '17:00' } });

    const resultat = await reservationsService.modifier('r1', { heureFin: '17:00' });

    expect(resultat).toEqual({ id: 'r1', heureFin: '17:00' });
    expect(api.put).toHaveBeenCalledWith('/reservations/r1', { heureFin: '17:00' }, { silencieux: true });
  });

  it('annule une réservation en silence', async () => {
    api.delete.mockResolvedValue({ data: null });

    await expect(reservationsService.supprimer('r1')).resolves.toBeUndefined();

    expect(api.delete).toHaveBeenCalledWith('/reservations/r1', { silencieux: true });
  });

  it('confirme une demande avec son motif', async () => {
    api.post.mockResolvedValue({ data: null });

    await reservationsService.decider('r1', { statut: 'CONFIRME', motif: 'Salle libre' });

    expect(api.post).toHaveBeenCalledWith(
      '/reservations/r1/decider',
      { statut: 'CONFIRME', motif: 'Salle libre' },
      { silencieux: true },
    );
  });

  it('refuse une demande sans motif', async () => {
    api.post.mockResolvedValue({ data: null });

    await reservationsService.decider('r1', { statut: 'REFUSE' });

    expect(api.post).toHaveBeenCalledWith('/reservations/r1/decider', { statut: 'REFUSE' }, { silencieux: true });
  });
});
