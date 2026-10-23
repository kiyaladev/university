import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  CHEMIN_ANNEES,
  cheminPromotions,
  inscriptionPubliqueService,
  tarifCourant,
} from '../../src/features/public/services/inscription-publique';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const annee = { id: 'a1', libelle: '2025-2026', dateDebut: '', dateFin: '', active: true, cloturee: false };

describe('features/public/services/inscription-publique', () => {
  it('charge les années ouvertes à l’inscription', async () => {
    api.get.mockResolvedValue({ data: [annee] });

    const resultat = await inscriptionPubliqueService.annees();

    expect(resultat).toEqual([annee]);
    expect(api.get).toHaveBeenCalledWith(CHEMIN_ANNEES, { params: {} });
  });

  it('renvoie une liste vide quand les années ne sont pas un tableau', async () => {
    api.get.mockResolvedValue({ data: { data: [annee] } });

    await expect(inscriptionPubliqueService.annees()).resolves.toEqual([]);
  });

  it('charge le tarif de la promotion retenue', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'f1', montant: 250000, devise: 'GNF' }] });

    const resultat = await inscriptionPubliqueService.frais('a1', 'p1');

    expect(resultat).toEqual([{ id: 'f1', montant: 250000, devise: 'GNF' }]);
    expect(api.get).toHaveBeenCalledWith('/frais', { params: { anneeId: 'a1', promotionId: 'p1' } });
  });

  it('accepte un tarif enveloppé dans `data`', async () => {
    api.get.mockResolvedValue({ data: { data: [{ montant: 1000, devise: 'GNF' }] } });

    await expect(inscriptionPubliqueService.frais('a1', 'p1')).resolves.toEqual([{ montant: 1000, devise: 'GNF' }]);
  });

  it('dépose le dossier en silence', async () => {
    const recu = {
      etudiantId: 'e1',
      inscriptionId: 'i1',
      numero: 'INS-1',
      montantFrais: 250000,
      devise: 'GNF',
      message: 'ok',
    };
    api.post.mockResolvedValue({ data: recu });

    const resultat = await inscriptionPubliqueService.deposer({
      nom: 'Traoré',
      prenom: 'Awa',
      telephone: '622000000',
      promotionId: 'p1',
    });

    expect(resultat).toBe(recu);
    expect(api.post).toHaveBeenCalledWith(
      '/inscription-publique',
      { nom: 'Traoré', prenom: 'Awa', telephone: '622000000', promotionId: 'p1' },
      { silencieux: true },
    );
  });

  it('donne la route des promotions de l’année retenue', () => {
    expect(cheminPromotions('a1')).toBe('/inscription-publique/annees/a1/promotions');
    expect(cheminPromotions('')).toBe(CHEMIN_ANNEES);
  });

  it('retient le premier tarif de la liste', () => {
    expect(tarifCourant([{ montant: 250000, devise: 'GNF' }])).toEqual({
      montant: 250000,
      devise: 'GNF',
    });
    expect(tarifCourant([])).toBeNull();
  });
});
