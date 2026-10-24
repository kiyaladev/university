import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  paieService,
  peutCalculerFeuille,
  peutPayerFeuille,
  peutSupprimerFeuille,
  peutValiderFeuille,
} from '../../src/features/finances/services/paie';
import type { FeuillePaie } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const feuille = (extras: Partial<FeuillePaie> = {}): FeuillePaie =>
  ({
    id: 'f1',
    libelle: 'Mars 2026',
    mois: 3,
    annee: 2026,
    dateDebut: '2026-03-01',
    dateFin: '2026-03-31',
    statut: 'BROUILLON',
    montantTotal: 1200000,
    creeLe: '2026-04-01T08:00:00.000Z',
    ...extras,
  }) as FeuillePaie;

describe('features/finances/services/paie', () => {
  it('liste les feuilles paginées avec leurs filtres', async () => {
    const page = { data: [feuille()], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await paieService.liste({ page: 1, pageSize: 20, statut: 'BROUILLON', annee: 2026 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/feuilles-paie', {
      params: { page: 1, pageSize: 20, statut: 'BROUILLON', annee: 2026 },
    });
  });

  it('crée une feuille pour un mois et une année', async () => {
    api.post.mockResolvedValue({ data: feuille() });

    await paieService.creer({ mois: 3, annee: 2026 });

    expect(api.post).toHaveBeenCalledWith('/feuilles-paie', { mois: 3, annee: 2026 }, {});
  });

  it('joue une action du cycle de vie', async () => {
    api.post.mockResolvedValue({ data: feuille({ statut: 'VALIDE' }) });

    await paieService.action('f1', 'valider');

    expect(api.post).toHaveBeenCalledWith('/feuilles-paie/f1/valider', undefined, {});
  });

  it('supprime une feuille', async () => {
    api.delete.mockResolvedValue({ data: null });

    await paieService.supprimer('f1');

    expect(api.delete).toHaveBeenCalledWith('/feuilles-paie/f1', {});
  });

  it('n’autorise les actions que sur les statuts du cycle', () => {
    expect(peutCalculerFeuille(feuille(), true)).toBe(true);
    expect(peutCalculerFeuille(feuille(), false)).toBe(false);
    expect(peutCalculerFeuille(feuille({ statut: 'VALIDE' }), true)).toBe(false);

    expect(peutValiderFeuille(feuille(), true)).toBe(true);
    expect(peutValiderFeuille(feuille({ statut: 'PAYE' }), true)).toBe(false);

    expect(peutPayerFeuille(feuille({ statut: 'VALIDE' }), true)).toBe(true);
    expect(peutPayerFeuille(feuille(), true)).toBe(false);

    expect(peutSupprimerFeuille(feuille(), true)).toBe(true);
    expect(peutSupprimerFeuille(feuille({ statut: 'PAYE' }), true)).toBe(false);
  });
});
