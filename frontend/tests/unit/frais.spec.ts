import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  filtresFrais,
  fraisService,
  libellesFrais,
  ligneFrais,
  ROLES_GESTION_FRAIS,
  ROLES_SUPPRESSION_FRAIS,
} from '../../src/features/finances/services/frais';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const tarif = {
  id: 'f1',
  anneeId: 'a1',
  promotionId: 'p1',
  montant: 250000,
  devise: 'GNF',
  annee: { id: 'a1', libelle: '2025-2026' },
  promotion: { id: 'p1', nom: 'Licence 1 A', niveau: 'L1' },
};

describe('features/finances/services/frais', () => {
  it('liste les tarifs filtrés par année et promotion', async () => {
    const page = { data: [tarif], total: 1, page: 1, pageSize: 50 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await fraisService.liste({ anneeId: 'a1', promotionId: 'p1', page: 2, pageSize: 25 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/frais/gestion', {
      params: { anneeId: 'a1', promotionId: 'p1', page: 2, pageSize: 25 },
    });
  });

  it('crée un tarif avec son année, sa promotion et son montant', async () => {
    api.post.mockResolvedValue({ data: tarif });

    await fraisService.creer({ anneeId: 'a1', promotionId: 'p1', montant: 250000, devise: 'GNF' });

    expect(api.post).toHaveBeenCalledWith(
      '/frais',
      { anneeId: 'a1', promotionId: 'p1', montant: 250000, devise: 'GNF' },
      {},
    );
  });

  it('modifie un tarif par son identifiant', async () => {
    api.put.mockResolvedValue({ data: { ...tarif, montant: 300000 } });

    await fraisService.modifier('f1', { montant: 300000 });

    expect(api.put).toHaveBeenCalledWith('/frais/f1', { montant: 300000 }, {});
  });

  it('supprime un tarif', async () => {
    api.delete.mockResolvedValue({ data: null });

    await fraisService.supprimer('f1');

    expect(api.delete).toHaveBeenCalledWith('/frais/f1', {});
  });

  it('n’envoie pas de filtre vide', () => {
    expect(filtresFrais({ anneeId: null, promotionId: 'p1' })).toEqual({ promotionId: 'p1' });
    expect(filtresFrais({ anneeId: null, promotionId: null })).toEqual({});
  });

  it('affiche les libellés de l’année et de la promotion', () => {
    expect(libellesFrais(tarif)).toEqual({ annee: '2025-2026', promotion: 'Licence 1 A' });
    expect(libellesFrais({ ...tarif, annee: null, promotion: null })).toEqual({
      annee: '—',
      promotion: '—',
    });
  });

  it('aplati un tarif en ligne de grille', () => {
    expect(ligneFrais(tarif)).toMatchObject({
      id: 'f1',
      montant: 250000,
      devise: 'GNF',
      anneeLibelle: '2025-2026',
      promotionLibelle: 'Licence 1 A',
    });
  });

  it('aligne les rôles sur les @Roles de l’API', () => {
    // POST /frais et PUT /frais/:id : administration et scolarité.
    expect([...ROLES_GESTION_FRAIS]).toEqual(['ADMIN', 'SCOLARITE']);
    // DELETE /frais/:id : administration seule.
    expect([...ROLES_SUPPRESSION_FRAIS]).toEqual(['ADMIN']);
  });
});
