import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { rapportsService } from '../../src/features/presence/services/rapports';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/presence/services/rapports', () => {
  it('lit le tableau de bord avec son périmètre', async () => {
    api.get.mockResolvedValue({ data: { global: { planifiees: 10, controlees: 8 } } });

    const rapport = await rapportsService.dashboard({
      dateDebut: '2026-01-01',
      dateFin: '2026-01-31',
      departementId: 'd1',
    });

    expect(rapport.global?.planifiees).toBe(10);
    expect(api.get).toHaveBeenCalledWith('/rapports/dashboard', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31', departementId: 'd1' },
    });
  });

  it('lit l’assiduité des enseignants', async () => {
    api.get.mockResolvedValue({ data: { lignes: [{ enseignantId: 'e1', nom: 'Koné' }] } });

    const rapport = await rapportsService.presenceEnseignants({ dateDebut: '2026-01-01', dateFin: '2026-01-31' });

    expect(rapport.lignes[0].enseignantId).toBe('e1');
    expect(api.get).toHaveBeenCalledWith('/rapports/presence-enseignants', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31' },
    });
  });

  it('lit l’occupation des salles', async () => {
    api.get.mockResolvedValue({ data: { lignes: [{ code: 'A101', nom: 'Amphi A101' }] } });

    const rapport = await rapportsService.salles({ dateDebut: '2026-01-01', dateFin: '2026-01-31' });

    expect(rapport.lignes[0].code).toBe('A101');
    expect(api.get).toHaveBeenCalledWith('/rapports/salles', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31' },
    });
  });

  it('lit l’état de paiement avec le filtre de statut', async () => {
    api.get.mockResolvedValue({ data: { lignes: [], totalMontant: 1_250_000 } });

    const rapport = await rapportsService.etatPaiement({
      dateDebut: '2026-01-01',
      dateFin: '2026-01-31',
      statutEnseignant: 'VACATAIRE',
    });

    expect(rapport.totalMontant).toBe(1_250_000);
    expect(api.get).toHaveBeenCalledWith('/rapports/etat-paiement', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31', statutEnseignant: 'VACATAIRE' },
    });
  });

  it('lit la fiche personnelle de l’agent connecté', async () => {
    api.get.mockResolvedValue({ data: { periode: { debut: '2026-01-01', fin: '2026-01-31' }, seances: [] } });

    const fiche = await rapportsService.maFiche({ dateDebut: '2026-01-01', dateFin: '2026-01-31' });

    expect(fiche.seances).toHaveLength(0);
    expect(api.get).toHaveBeenCalledWith('/rapports/ma-fiche', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31' },
    });
  });
});
