import { ConflictException } from '@nestjs/common';
import { Role, StatutEvaluation, TypeEvaluation } from '@prisma/client';
import { ScolariteService } from './scolarite.service';
import type { AuthUser } from '../../../common/decorators';

const USER = { id: 'sco-1', role: Role.SCOLARITE } as AuthUser;

const EVALUATION = {
  id: 'eval-1',
  intitule: 'Examen',
  type: TypeEvaluation.EXAMEN,
  statut: StatutEvaluation.OUVERT,
  anneeId: 'annee-1',
  promotionId: 'promo-1',
  matiereId: 'matiere-1',
  _count: { notes: 3 },
};

function preparer() {
  const tx: any = {
    evaluation: { findUnique: jest.fn().mockResolvedValue(EVALUATION), delete: jest.fn() },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', cloturee: false }) },
    auditLog: { create: jest.fn() },
  };
  const prisma: any = {
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', cloturee: false }) },
    evaluation: { findUnique: jest.fn().mockResolvedValue(EVALUATION), delete: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(tx)),
  };
  return { prisma, tx, service: new ScolariteService(prisma) };
}

describe('Suppression d’une évaluation', () => {
  it('refuse (409) quand des notes sont déjà enregistrées sur l’évaluation', async () => {
    const { prisma, tx, service } = preparer();

    await expect(service.supprimerEvaluation('eval-1', USER)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.supprimerEvaluation('eval-1', USER)).rejects.toThrow('3 notes y sont déjà enregistrées');

    expect(prisma.evaluation.delete).not.toHaveBeenCalled();
    expect(tx.evaluation.delete).not.toHaveBeenCalled();
  });

  it('supprime l’évaluation quand elle ne porte aucune note', async () => {
    const { prisma, tx, service } = preparer();
    const evaluation = { ...EVALUATION, _count: { notes: 0 } };
    prisma.evaluation.findUnique.mockResolvedValue(evaluation);
    tx.evaluation.findUnique.mockResolvedValue(evaluation);

    await expect(service.supprimerEvaluation('eval-1', USER)).resolves.toEqual({ id: 'eval-1' });

    expect(tx.evaluation.delete).toHaveBeenCalledWith({ where: { id: 'eval-1' } });
  });
});
