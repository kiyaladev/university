import { Role } from '@prisma/client';
import { ScolariteService } from './scolarite.service';

describe('ScolariteService — audit des notes', () => {
  it('ne charge que les champs d’identification de l’étudiant avec les notes', async () => {
    const noteFindMany = jest.fn().mockResolvedValue([]);
    const prisma: any = { note: { findMany: noteFindMany, count: jest.fn().mockResolvedValue(0) } };
    const service = new ScolariteService(prisma);

    await service.listerNotes({} as any, { role: Role.SCOLARITE } as any);

    expect(noteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          inscription: {
            include: {
              etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
              promotion: true,
            },
          },
        }),
      }),
    );
  });

  it('journalise les valeurs avant/après et les notes dans la même transaction', async () => {
    const noteUpsert = jest.fn().mockResolvedValue({});
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      evaluation: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'eval-1', anneeId: 'annee-1', promotionId: 'promo-1', statut: 'OUVERT' }),
      },
      inscription: { findMany: jest.fn().mockResolvedValue([{ id: 'ins-1' }, { id: 'ins-2' }]) },
      note: {
        findMany: jest.fn().mockResolvedValue([{ inscriptionId: 'ins-1', note: 10, present: true }]),
        upsert: noteUpsert,
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      auditLog: { create: auditCreate },
    };
    const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ScolariteService(prisma as any);
    const acteur = { id: 'scolarite-1', role: Role.SCOLARITE } as any;

    await service.saisirNotes(
      {
        evaluationId: 'eval-1',
        notes: [
          { inscriptionId: 'ins-1', note: 14, present: true },
          { inscriptionId: 'ins-2', note: 18, present: false },
        ],
      } as any,
      acteur,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(noteUpsert).toHaveBeenCalledTimes(2);
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        userId: acteur.id,
        action: 'NOTES_SAISIES',
        entite: 'Evaluation',
        entiteId: 'eval-1',
        details: JSON.stringify({
          acteur: acteur.id,
          changements: [
            { inscriptionId: 'ins-1', avant: { note: 10, present: true }, apres: { note: 14, present: true } },
            { inscriptionId: 'ins-2', avant: null, apres: { note: 18, present: false } },
          ],
        }),
      },
    });
  });
});
