import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { seancesService } from '../../src/features/presence/services/seances';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/presence/services/seances', () => {
  it('liste les séances avec leurs filtres', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 's1' }], total: 1, page: 1, pageSize: 50 } });

    const page = await seancesService.liste({ dateDebut: '2026-01-01', statut: 'TENUE' });

    expect(page.data).toEqual([{ id: 's1' }]);
    expect(api.get).toHaveBeenCalledWith('/seances', {
      params: { dateDebut: '2026-01-01', statut: 'TENUE' },
    });
  });

  it('lit la feuille de contrôle du jour', async () => {
    api.get.mockResolvedValue({ data: { date: '2026-01-06', total: 2, controlees: 1, enAttente: 1, seances: [] } });

    const journee = await seancesService.journee('2026-01-06');

    expect(journee.controlees).toBe(1);
    expect(api.get).toHaveBeenCalledWith('/seances/journee', { params: { date: '2026-01-06' } });
  });

  it('liste les contrôleurs actifs', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'c1', nom: 'Traoré', prenom: 'Ibrahim' }] });

    const controleurs = await seancesService.controleurs();

    expect(controleurs).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/seances/controleurs', { params: undefined });
  });

  it('prévisualise une tournée', async () => {
    api.get.mockResolvedValue({
      data: { seancesSansAffectation: 5, seancesAffectables: 4, ignoreesAnneeCloturee: 1 },
    });

    const apercu = await seancesService.apercuTournee({
      dateDebut: '2026-01-05',
      dateFin: '2026-01-11',
      controleurId: 'c1',
    });

    expect(apercu.seancesAffectables).toBe(4);
    expect(api.get).toHaveBeenCalledWith('/seances/tournee-apercu', {
      params: { dateDebut: '2026-01-05', dateFin: '2026-01-11', controleurId: 'c1' },
    });
  });

  it('affecte une tournée et renvoie le nombre de séances affectées', async () => {
    api.post.mockResolvedValue({ data: { seancesAffectees: 3 } });

    const resultat = await seancesService.affecterTournee({
      dateDebut: '2026-01-05',
      dateFin: '2026-01-11',
      controleurId: 'c1',
      departementId: 'd1',
    });

    expect(resultat.seancesAffectees).toBe(3);
    expect(api.post).toHaveBeenCalledWith(
      '/seances/tournee',
      { dateDebut: '2026-01-05', dateFin: '2026-01-11', controleurId: 'c1', departementId: 'd1' },
      {},
    );
  });

  it('affecte un contrôleur à une séance', async () => {
    api.put.mockResolvedValue({ data: { id: 's1' } });

    await seancesService.affecterControleur('s1', 'c1');

    expect(api.put).toHaveBeenCalledWith('/seances/s1/controleur', { controleurId: 'c1' }, {});
  });

  it('retire le contrôleur d’une séance', async () => {
    api.put.mockResolvedValue({ data: { id: 's1' } });

    await seancesService.affecterControleur('s1', null);

    expect(api.put).toHaveBeenCalledWith('/seances/s1/controleur', { controleurId: null }, {});
  });

  it('annule une séance avec son motif', async () => {
    api.post.mockResolvedValue({ data: { id: 's1', statut: 'ANNULE' } });

    const seance = await seancesService.annuler('s1', 'Enseignant malade');

    expect(seance.statut).toBe('ANNULE');
    expect(api.post).toHaveBeenCalledWith('/seances/s1/annuler', { motif: 'Enseignant malade' }, {});
  });

  it('modifie une séance planifiée', async () => {
    api.put.mockResolvedValue({ data: { id: 's1' } });

    await seancesService.modifier('s1', { salleId: 'sa1', thematique: null });

    expect(api.put).toHaveBeenCalledWith('/seances/s1', { salleId: 'sa1', thematique: null }, {});
  });

  it('génère les séances d’une année', async () => {
    api.post.mockResolvedValue({ data: { creees: 120, candidates: 130, ignorees: 10 } });

    const resultat = await seancesService.generer({
      anneeId: 'a1',
      dateDebut: '2026-09-01',
      dateFin: '2026-09-30',
      joursExclus: ['samedi'],
    });

    expect(resultat.creees).toBe(120);
    expect(api.post).toHaveBeenCalledWith(
      '/seances/generer',
      { anneeId: 'a1', dateDebut: '2026-09-01', dateFin: '2026-09-30', joursExclus: ['samedi'] },
      {},
    );
  });
});
