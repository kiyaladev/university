import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  evolutionMasseSalariale,
  listeBilansMesrs,
  listeFeuillesPaie,
  rectoratService,
} from '../../src/features/administration/services/rectorat';
import type { FeuillePaie } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

function feuille(mois: string, montantTotal: number, valideeLe?: string): FeuillePaie {
  return {
    id: mois,
    libelle: mois,
    mois: 1,
    annee: 2026,
    dateDebut: '',
    dateFin: '',
    statut: 'PAYEE',
    montantTotal,
    creeLe: '',
    valideeLe,
  } as unknown as FeuillePaie;
}

describe('features/administration/services/rectorat', () => {
  it('lit les chiffres du rectorat pour une année', async () => {
    api.get.mockResolvedValue({ data: { effectif: 100 } });

    const resultat = await rectoratService.chiffres({ anneeId: 'a1' });

    expect(resultat).toEqual({ effectif: 100 });
    expect(api.get).toHaveBeenCalledWith('/rectorat/chiffres', { params: { anneeId: 'a1' } });
  });

  it('lit la synthèse du patrimoine avec la même année', async () => {
    api.get.mockResolvedValue({ data: { total: 12 } });

    await rectoratService.patrimoine({ anneeId: 'a1' });

    expect(api.get).toHaveBeenCalledWith('/patrimoine/dashboard', { params: { anneeId: 'a1' } });
  });

  it('lit les bilans MESRS filtrés par année et par type', async () => {
    api.get.mockResolvedValue({ data: [] });

    await rectoratService.bilansMesrs({ anneeId: 'a1', type: 'INSCRIPTION' });

    expect(api.get).toHaveBeenCalledWith('/rectorat/bilan-mesrs', {
      params: { anneeId: 'a1', type: 'INSCRIPTION' },
    });
  });

  it('produit un bilan MESRS pour une année', async () => {
    api.post.mockResolvedValue({ data: undefined });

    await rectoratService.genererBilanMesrs('a1');

    expect(api.post).toHaveBeenCalledWith('/rectorat/bilan-mesrs/generer', { anneeId: 'a1' }, {});
  });

  it('lit toutes les feuilles de paie sans pagination', async () => {
    api.get.mockResolvedValue({ data: [] });

    await rectoratService.feuillesPaie();

    expect(api.get).toHaveBeenCalledWith('/feuilles-paie', { params: { all: '1' } });
  });
});

describe('features/administration/services/rectorat — normalisations', () => {
  it('accepte un tableau nu comme une page de feuilles de paie', () => {
    const feuilles = [feuille('f1', 100)];

    expect(listeFeuillesPaie(feuilles)).toBe(feuilles);
  });

  it('accepte une page de feuilles de paie', () => {
    const feuilles = [feuille('f1', 100)];

    expect(listeFeuillesPaie({ data: feuilles, total: 1, page: 1, pageSize: 20 })).toBe(feuilles);
  });

  it('accepte un tableau nu comme une page de bilans', () => {
    const bilans = [{ id: 'b1' }] as never;

    expect(listeBilansMesrs(bilans)).toBe(bilans);
  });
});

describe('features/administration/services/rectorat — évolution de la masse salariale', () => {
  const maintenant = new Date(2026, 2, 15); // mars 2026

  it('couvre les douze derniers mois', () => {
    const points = evolutionMasseSalariale([], maintenant);

    expect(points).toHaveLength(12);
    expect(points[0].cle).toBe('2025-04');
    expect(points[11].cle).toBe('2026-03');
    expect(points.every((p) => p.total === 0)).toBe(true);
  });

  it('range une feuille dans le mois de sa validation', () => {
    const points = evolutionMasseSalariale([feuille('f1', 500, '2026-01-10T00:00:00Z')], maintenant);

    expect(points.find((p) => p.cle === '2026-01')?.total).toBe(500);
  });

  it('retombe sur le mois de paiement quand la feuille n’est pas validée', () => {
    const f = feuille('f1', 300);
    f.valideeLe = null;
    f.payeeLe = '2025-11-05T00:00:00Z';

    const points = evolutionMasseSalariale([f], maintenant);

    expect(points.find((p) => p.cle === '2025-11')?.total).toBe(300);
  });

  it('ignore les feuilles sans date et celles hors de la période', () => {
    const horsPeriode = feuille('f2', 900, '2020-01-10T00:00:00Z');

    const points = evolutionMasseSalariale([feuille('f1', 100), horsPeriode], maintenant);

    // La première feuille n'a ni validation ni paiement : elle n'est pas comptée.
    expect(points.reduce((acc, p) => acc + p.total, 0)).toBe(0);

    const points2 = evolutionMasseSalariale(
      [feuille('f1', 100, '2026-01-10T00:00:00Z'), horsPeriode],
      maintenant,
    );
    expect(points2.reduce((acc, p) => acc + p.total, 0)).toBe(100);
  });
});
