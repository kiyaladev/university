import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  lireRecapitulatifRecalcul,
  lireTableauDeBordPlagiat,
  plagiatService,
  texteDocument,
} from '../../src/features/administration/services/plagiat';
import type { DocumentDepot, SuspicionPlagiat } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

function document_(id: string, titre: string): DocumentDepot {
  return { id, titre, type: 'MEMOIRE', public: false, telechargements: 0 } as DocumentDepot;
}

describe('features/administration/services/plagiat', () => {
  it('lit le tableau de bord de plagiat', async () => {
    api.get.mockResolvedValue({ data: { kpis: { total: 2 }, suspicions: [] } });

    const resultat = await plagiatService.tableauDeBord();

    expect(resultat).toEqual({ kpis: { total: 2 }, suspicions: [] });
    expect(api.get).toHaveBeenCalledWith('/documents/plagiat', { params: undefined });
  });

  it('lit le détail d’une suspicion', async () => {
    api.get.mockResolvedValue({ data: { id: 's1', score: 0.8 } });

    const resultat = await plagiatService.suspicion('s1');

    expect(resultat.id).toBe('s1');
    expect(api.get).toHaveBeenCalledWith('/documents/plagiat/s1', { params: undefined });
  });

  it('acquitte une suspicion avec son motif', async () => {
    api.post.mockResolvedValue({ data: { id: 's1', statut: 'ACQUITTE' } });

    await plagiatService.acquitter('s1', { decision: 'ACQUITTE', commentaire: 'citation légitime' });

    expect(api.post).toHaveBeenCalledWith(
      '/documents/plagiat/s1/acquitter',
      { decision: 'ACQUITTE', commentaire: 'citation légitime' },
      {},
    );
  });

  it('relance la détection de plagiat', async () => {
    api.post.mockResolvedValue({ data: { creees: 1, misesAJour: 2, ignorees: 3 } });

    const resultat = await plagiatService.recalculer();

    expect(resultat).toEqual({ creees: 1, misesAJour: 2, ignorees: 3 });
    expect(api.post).toHaveBeenCalledWith('/documents/recalculer-plagiat', {}, {});
  });
});

describe('features/administration/services/plagiat — normalisations', () => {
  it('met les compteurs à zéro quand la clé manque', () => {
    const tableau = lireTableauDeBordPlagiat({});

    expect(tableau.kpis).toEqual({ total: 0, scoreMoyen: 0, enAttente: 0, acquittees: 0, confirmees: 0 });
    expect(tableau.suspicions).toEqual([]);
    expect(tableau.topDocuments).toEqual([]);
  });

  it('agrège le top des documents par document impliqué et le limite à cinq', () => {
    const partage = document_('a0', 'Doc partagé');
    const autres = Array.from({ length: 6 }, (_, i) => document_(`d${i}`, `Doc ${i}`));
    const suspicions = [
      { documentA: partage, documentB: autres[0] },
      { documentA: partage, documentB: autres[1] },
      ...autres.slice(2).map((d) => ({ documentA: d, documentB: undefined })),
    ] as unknown as SuspicionPlagiat[];

    const tableau = lireTableauDeBordPlagiat({ topDix: suspicions });

    expect(tableau.topDocuments).toHaveLength(5);
    // Le document partagé par deux suspicions est compté deux fois.
    expect(tableau.topDocuments[0]).toEqual({ id: 'a0', titre: 'Doc partagé', compte: 2 });
  });

  it('remet le récapitulatif d’un recalcul à zéro', () => {
    expect(lireRecapitulatifRecalcul(null)).toEqual({ creees: 0, misesAJour: 0, ignorees: 0 });
  });
});

describe('features/administration/services/plagiat — texte des documents', () => {
  it('utilise le texte déjà présent sur le document', async () => {
    const doc = { ...document_('d1', 'Doc'), contenuTexte: 'déjà là' };

    await expect(texteDocument(doc)).resolves.toBe('déjà là');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('charge le texte manquant depuis l’API', async () => {
    api.get.mockResolvedValue({ data: { id: 'd1', contenuTexte: 'chargé' } });

    await expect(texteDocument(document_('d1', 'Doc'))).resolves.toBe('chargé');
    expect(api.get).toHaveBeenCalledWith('/documents/d1', { params: undefined });
  });

  it('renvoie un texte vide si le document est illisible', async () => {
    api.get.mockRejectedValue(new Error('boom'));

    await expect(texteDocument(document_('d1', 'Doc'))).resolves.toBe('');
  });
});
