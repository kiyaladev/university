import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de la couche de service utilisée par les écrans « resto » : la page
 * Restaurant universitaire (guichet, portefeuilles, transactions) et son
 * dialogue de recharge.
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

import { restoService } from '../../src/features/campus/services/resto';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('restoService — guichet', () => {
  it('valide un repas en silence et rend le corps de la réponse', async () => {
    const corps = {
      etudiant: { id: 'e1', matricule: 'M-001', nom: 'Traoré', prenom: 'Awa' },
      consommation: { id: 'c1', repas: 'DEJEUNER', montant: 15000, statut: 'VALIDE', consommeLe: '2026-10-23' },
      solde: 35000,
    };
    api.post.mockResolvedValue({ data: corps });

    const resultat = await restoService.validerRepas({
      reference: 'M-001',
      repas: 'DEJEUNER',
      montant: 15000,
      cantine: 'Principale',
    });

    expect(resultat).toBe(corps);
    expect(resultat.etudiant?.matricule).toBe('M-001');
    expect(api.post).toHaveBeenCalledWith(
      '/resto/valider',
      { reference: 'M-001', repas: 'DEJEUNER', montant: 15000, cantine: 'Principale' },
      { silencieux: true },
    );
  });

  it('laisse remonter le refus du guichet : la page en fait son bandeau', async () => {
    const erreur = Object.assign(new Error('402'), {
      response: {
        status: 402,
        data: {
          message: 'Solde insuffisant',
          code: 'SOLDE_INSUFFISANT',
          soldeInsuffisant: true,
          etudiantId: 'e1',
        },
      },
    });
    api.post.mockRejectedValueOnce(erreur);

    await expect(restoService.validerRepas({ reference: 'M-001', repas: 'DEJEUNER', montant: 15000 })).rejects.toBe(
      erreur,
    );

    const corps = (erreur.response.data ?? {}) as Record<string, unknown>;
    expect(corps.soldeInsuffisant).toBe(true);
    expect(corps.code).toBe('SOLDE_INSUFFISANT');
  });
});

describe('restoService — portefeuilles', () => {
  it('liste les portefeuilles pour le dialogue de recharge', async () => {
    const page = {
      data: [{ id: 'p1', etudiant: { id: 'e1', matricule: 'M-001', nom: 'Traoré', prenom: 'Awa' }, solde: 5000 }],
      total: 1,
      page: 1,
      pageSize: 0,
    };
    api.get.mockResolvedValue({ data: page });

    const resultat = await restoService.listePortefeuilles({ all: '1' });

    expect(resultat).toBe(page);
    expect(resultat.data[0]?.etudiant.matricule).toBe('M-001');
    expect(api.get).toHaveBeenCalledWith('/resto/portefeuilles', { params: { all: '1' } });
  });

  it('recharge un portefeuille et rend le statut du paiement', async () => {
    api.post.mockResolvedValue({
      data: { immediat: false, solde: 25000, paiement: { reference: 'PAY-1', mode: 'MOBILE_MONEY' } },
    });

    const resultat = await restoService.recharger('p1', { montant: 20000, mode: 'MOBILE_MONEY' });

    expect(resultat.immediat).toBe(false);
    expect(resultat.paiement?.reference).toBe('PAY-1');
    expect(api.post).toHaveBeenCalledWith(
      '/resto/portefeuilles/p1/recharger',
      { montant: 20000, mode: 'MOBILE_MONEY' },
      {},
    );
  });
});

describe('restoService — transactions', () => {
  it('liste les consommations et les recharges de la période', async () => {
    const page = { data: [], total: 0, page: 1, pageSize: 0 };
    api.get.mockResolvedValue({ data: page });

    await restoService.listeConsommations({
      dateDebut: '2026-10-01',
      dateFin: '2026-10-23',
      pageSize: 200,
      cantine: 'Principale',
    });
    await restoService.listeRecharges({
      dateDebut: '2026-10-01',
      dateFin: '2026-10-23',
      pageSize: 200,
      statut: 'PAYE',
    });

    expect(api.get).toHaveBeenNthCalledWith(1, '/resto/consommations', {
      params: { dateDebut: '2026-10-01', dateFin: '2026-10-23', pageSize: 200, cantine: 'Principale' },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/resto/recharges', {
      params: { dateDebut: '2026-10-01', dateFin: '2026-10-23', pageSize: 200, statut: 'PAYE' },
    });
  });

  it('annule une consommation avec son motif', async () => {
    api.post.mockResolvedValue({ data: null });

    await expect(restoService.annulerConsommation('c1', 'Remboursement guichet')).resolves.toBeNull();

    expect(api.post).toHaveBeenCalledWith('/resto/consommations/c1/annuler', { motif: 'Remboursement guichet' }, {});
  });
});
