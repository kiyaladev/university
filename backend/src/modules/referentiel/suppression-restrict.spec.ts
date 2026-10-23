import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MatieresService } from './matieres';
import { EnseignantsService } from './enseignants';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => undefined } }));

/**
 * Les notes (via Note.evaluationId) et les lignes de paie (via
 * LignePaie.enseignantId) sont en ON DELETE RESTRICT : la base refuse la
 * suppression (P2003) et l'utilisateur reçoit un 409 explicite, pas une 500.
 */
const refusFk = () =>
  new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: 'test',
  });

describe('Suppressions refusées par une clé étrangère RESTRICT', () => {
  it('refuse la suppression d’une matière dont les évaluations portent des notes', async () => {
    const tx = {
      matiere: {
        findUnique: jest.fn().mockResolvedValue({ id: 'matiere-1', code: 'MAT1' }),
        delete: jest.fn().mockRejectedValue(refusFk()),
      },
      auditLog: { create: jest.fn() },
    };
    const service = new MatieresService({ $transaction: (fn: any) => fn(tx) } as any);

    const erreur = await service.supprimer('matiere-1').catch((e) => e);
    expect(erreur).toBeInstanceOf(ConflictException);
    expect(erreur.message).toContain('des notes sont déjà saisies');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse la suppression d’un enseignant qui a des lignes de paie', async () => {
    const tx = {
      enseignant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ens-1', matricule: 'E1' }),
        delete: jest.fn().mockRejectedValue(refusFk()),
      },
      auditLog: { create: jest.fn() },
    };
    const service = new EnseignantsService({ $transaction: (fn: any) => fn(tx) } as any);

    const erreur = await service.supprimer('ens-1', { id: 'admin' } as any).catch((e) => e);
    expect(erreur).toBeInstanceOf(ConflictException);
    expect(erreur.message).toContain('lignes de paie');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
