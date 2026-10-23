import { StatutSuspicionPlagiat } from '@prisma/client';
import { PlagiatService } from './plagiat.service';

/** Deux identifiants, rangés comme le fait le service. */
function clePaire(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function document(id: string) {
  return {
    id,
    titre: `Dépôt ${id}`,
    contenuTexte: 'texte',
    resume: null,
    motsClefs: [],
    empreinteHash: 'empreinte-identique',
  };
}

function preparer(connues: any[], agregat: any[]) {
  const tx = {
    suspicionPlagiat: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    documentDepot: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma: any = {
    documentDepot: { findMany: jest.fn().mockResolvedValue([]) },
    suspicionPlagiat: {
      findMany: jest.fn().mockResolvedValueOnce(connues).mockResolvedValueOnce(agregat),
    },
    $transaction: jest.fn(async (operation: (t: any) => unknown) => operation(tx)),
  };
  return { prisma, tx };
}

describe('PlagiatService — recalcul complet par lots', () => {
  it('met à jour les suspicions par valeur, et non ligne par ligne', async () => {
    const docs = [document('doc-a'), document('doc-b'), document('doc-c')];
    const connues = [
      {
        id: 'susp-1',
        documentAId: 'doc-a',
        documentBId: 'doc-b',
        score: 40,
        statut: StatutSuspicionPlagiat.EN_ATTENTE,
      },
    ];
    const { prisma, tx } = preparer(connues, [
      { documentAId: 'doc-a', documentBId: 'doc-b', score: 100 },
      { documentAId: 'doc-a', documentBId: 'doc-c', score: 100 },
      { documentAId: 'doc-b', documentBId: 'doc-c', score: 100 },
    ]);
    prisma.documentDepot.findMany.mockResolvedValue(docs);
    const service = new PlagiatService(prisma);

    const bilan = await service.recalculerComplet({ id: 'admin-1' } as any);

    expect(bilan).toEqual({ creees: 2, misesAJour: 1, ignorees: 0 });
    // Une seule requête pour toutes les suspicions qui portent le même score.
    expect(tx.suspicionPlagiat.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.suspicionPlagiat.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['susp-1'] } },
      data: { score: 100 },
    });
    // Plus aucune écriture ligne par ligne.
    expect((tx.suspicionPlagiat as any).update).toBeUndefined();
  });

  it('crée les nouvelles suspicions par lots', async () => {
    const docs = [document('doc-a'), document('doc-b'), document('doc-c')];
    const { prisma, tx } = preparer([], []);
    prisma.documentDepot.findMany.mockResolvedValue(docs);
    const service = new PlagiatService(prisma);

    const bilan = await service.recalculerComplet({ id: 'admin-1' } as any);

    expect(bilan.creees).toBe(3);
    expect(tx.suspicionPlagiat.createMany).toHaveBeenCalledTimes(1);
    const lot = tx.suspicionPlagiat.createMany.mock.calls[0][0].data;
    expect(lot).toHaveLength(3);
    for (const ligne of lot) {
      expect(ligne.documentAId < ligne.documentBId).toBe(true);
      expect(ligne.score).toBe(100);
      expect(ligne.statut).toBe(StatutSuspicionPlagiat.EN_ATTENTE);
    }
  });

  it('agrège l’indice de plagiat par document, et non document par document', async () => {
    const docs = [document('doc-a'), document('doc-b'), document('doc-c')];
    const { prisma, tx } = preparer(
      [],
      [
        { documentAId: 'doc-a', documentBId: 'doc-b', score: 70 },
        { documentAId: 'doc-a', documentBId: 'doc-c', score: 90 },
        { documentAId: 'doc-b', documentBId: 'doc-c', score: 50 },
      ],
    );
    prisma.documentDepot.findMany.mockResolvedValue(docs);
    const service = new PlagiatService(prisma);

    await service.recalculerComplet({ id: 'admin-1' } as any);

    // Deux valeurs distinctes d’indice, donc deux requêtes groupées.
    expect(tx.documentDepot.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.documentDepot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['doc-a', 'doc-c'] } },
      data: { indicePlagiat: 90 },
    });
    expect(tx.documentDepot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['doc-b'] } },
      data: { indicePlagiat: 70 },
    });
    expect((tx.documentDepot as any).update).toBeUndefined();
  });

  it('découpe les écritures en lots bornés, sans transaction géante', async () => {
    // 33 documents => 528 paires : au-delà d'un lot, le recalcul doit être
    // découpé en plusieurs transactions plutôt qu'un seul envoi.
    const nbDocs = 33;
    const docs = Array.from({ length: nbDocs }, (_, i) => document(`doc-${String(i).padStart(3, '0')}`));
    const connues: any[] = [];
    for (let i = 0; i < nbDocs; i++) {
      for (let j = i + 1; j < nbDocs; j++) {
        const [aId, bId] = [docs[i].id, docs[j].id].sort();
        connues.push({
          id: `susp-${i}-${j}`,
          documentAId: aId,
          documentBId: bId,
          score: 0,
          statut: StatutSuspicionPlagiat.EN_ATTENTE,
        });
      }
    }
    expect(connues).toHaveLength(528);
    expect(clePaire('doc-001', 'doc-002')).toBe('doc-001|doc-002');

    const { prisma, tx } = preparer(connues, []);
    prisma.documentDepot.findMany.mockResolvedValue(docs);
    const service = new PlagiatService(prisma);

    const bilan = await service.recalculerComplet({ id: 'admin-1' } as any);

    expect(bilan.misesAJour).toBe(528);
    expect(tx.suspicionPlagiat.updateMany).toHaveBeenCalledTimes(2);
    const tailles = tx.suspicionPlagiat.updateMany.mock.calls.map((appel: any[]) => appel[0].where.id.in.length);
    expect(tailles).toEqual([500, 28]);
    // Une transaction par lot, et rien d'autre.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
