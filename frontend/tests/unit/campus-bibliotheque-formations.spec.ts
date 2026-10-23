import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests des services utilisés par l'écran de gestion de la bibliothèque
 * (`BibliothequePage`) et par l'écran d'administration des formations
 * (`FormationsAdminPage`).
 *
 * Chaque service est vérifié sur trois points : l'URL appelée, les paramètres
 * transmis et la transformation du corps de la réponse.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

// `shared/utils/format` (utilisé par les dates des formations) lit la langue
// active dans boot/i18n, qui dépend de l'application Quasar.
vi.mock('../../src/boot/i18n', () => ({
  getAppLocale: () => 'fr-FR',
  i18n: { global: { te: () => false, t: (cle: string) => cle } },
}));

import { bibliothequeService, normaliserDocuments } from '../../src/shared/services/bibliotheque';
import { formationsService } from '../../src/shared/services/formations';
import { couleurPlagiat, iconePlagiat, surligner } from '../../src/features/campus/components/BibliothequeAffiche';
import { datesLisible } from '../../src/features/campus/components/FormationAffiche';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('shared/services/bibliotheque', () => {
  it('liste les documents avec ses paramètres de pagination et de filtres', async () => {
    const reponse = { data: [{ id: 'd1' }], total: 1 };
    api.get.mockResolvedValue({ data: reponse });

    const resultat = await bibliothequeService.liste({
      page: 2,
      pageSize: 12,
      type: 'MEMOIRE',
      public: 'true',
    });

    expect(resultat).toEqual({ data: reponse });
    expect(api.get).toHaveBeenCalledWith('/documents', {
      params: { page: 2, pageSize: 12, type: 'MEMOIRE', public: 'true' },
      silencieux: false,
    });
  });

  it('cherche en plein texte sur la route de recherche', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await bibliothequeService.rechercheFts({ q: 'memoire', pageSize: 10 });

    expect(api.get).toHaveBeenCalledWith('/documents/recherche', {
      params: { q: 'memoire', pageSize: 10 },
      silencieux: false,
    });
  });

  it('lit un document, son fichier, et modifie sa visibilité', async () => {
    api.get.mockResolvedValue({ data: { id: 'd1' }, headers: {} });
    api.put.mockResolvedValue({ data: { id: 'd1', public: true } });

    await bibliothequeService.detail('d1');
    await bibliothequeService.fichier('d1');
    await bibliothequeService.modifier('d1', { public: true });

    expect(api.get).toHaveBeenNthCalledWith(1, '/documents/d1');
    expect(api.get).toHaveBeenNthCalledWith(2, '/documents/d1/fichier', {
      responseType: 'blob',
      timeout: 60000,
      silencieux: false,
    });
    expect(api.put).toHaveBeenCalledWith('/documents/d1', { public: true });
  });

  it('supprime un document et relance le calcul anti-plagiat', async () => {
    api.delete.mockResolvedValue({ data: null });
    api.post.mockResolvedValue({ data: { total: 3 } });

    await bibliothequeService.supprimer('d1');
    await bibliothequeService.recalculerPlagiat();

    expect(api.delete).toHaveBeenCalledWith('/documents/d1');
    expect(api.post).toHaveBeenCalledWith('/documents/recalculer-plagiat', {});
  });

  it('normalise les deux formes de réponse du serveur', () => {
    expect(normaliserDocuments([{ id: 'd1' }, { id: 'd2' }] as never)).toEqual({
      liste: [{ id: 'd1' }, { id: 'd2' }],
      total: 2,
    });
    expect(normaliserDocuments({ data: [{ id: 'd1' }], total: 7 } as never)).toEqual({
      liste: [{ id: 'd1' }],
      total: 7,
    });
    expect(normaliserDocuments({} as never)).toEqual({ liste: [], total: 0 });
  });
});

describe('shared/services/formations', () => {
  it('liste les formations avec ses paramètres', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await formationsService.liste({ page: 1, pageSize: 20, search: 'excel', statut: 'PUBLIE' });

    expect(api.get).toHaveBeenCalledWith('/formations', {
      params: { page: 1, pageSize: 20, search: 'excel', statut: 'PUBLIE' },
    });
  });

  it('lit le tableau de bord et le registre des inscriptions', async () => {
    api.get.mockResolvedValue({ data: { total: 0, parFormation: [], totaux: {} } });

    await formationsService.dashboard();
    await formationsService.inscriptions('f1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/formations/dashboard');
    expect(api.get).toHaveBeenNthCalledWith(2, '/formations/f1/inscriptions');
  });

  it('publie, clôture et supprime une formation', async () => {
    api.post.mockResolvedValue({ data: null });
    api.delete.mockResolvedValue({ data: null });

    await formationsService.publier('f1');
    await formationsService.cloturer('f1');
    await formationsService.supprimer('f1');

    expect(api.post).toHaveBeenNthCalledWith(1, '/formations/f1/publier');
    expect(api.post).toHaveBeenNthCalledWith(2, '/formations/f1/cloturer');
    expect(api.delete).toHaveBeenCalledWith('/formations/f1');
  });

  it('confirme ou annule une inscription', async () => {
    api.post.mockResolvedValue({ data: null });

    await formationsService.confirmerInscription('i1');
    await formationsService.annulerInscription('i1');

    expect(api.post).toHaveBeenNthCalledWith(1, '/formations/inscriptions/i1/confirmer');
    expect(api.post).toHaveBeenNthCalledWith(2, '/formations/inscriptions/i1/annuler');
  });
});

describe("campus/components — aides d'affichage", () => {
  it('colorie le score de plagiat selon son seuil', () => {
    expect(couleurPlagiat(85)).toBe('negative');
    expect(couleurPlagiat(60)).toBe('warning');
    expect(couleurPlagiat(10)).toBe('positive');
    expect(iconePlagiat(85)).toBe('report');
    expect(iconePlagiat(60)).toBe('warning');
    expect(iconePlagiat(10)).toBe('verified');
  });

  it('échappe le texte puis surligne le terme recherché', () => {
    expect(surligner('a < b & c', 'z')).toBe('a &lt; b &amp; c');
    expect(surligner('Mémoire de fin', 'mémoire')).toBe('<mark>Mémoire</mark> de fin');
    expect(surligner('Mémoire de fin', '  ')).toBe('Mémoire de fin');
  });

  it("formate la période d'une formation", () => {
    expect(datesLisible({ dateDebut: null } as never)).toBe('');
    expect(datesLisible({ dateDebut: '2026-08-12' } as never)).toBe('12/08/2026');
    expect(datesLisible({ dateDebut: '2026-08-12', dateFin: '2026-08-20' } as never)).toBe('12/08/2026 → 20/08/2026');
  });
});
