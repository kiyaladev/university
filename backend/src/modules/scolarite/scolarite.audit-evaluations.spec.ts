import { Role, StatutEvaluation, TypeEvaluation } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { ScolariteService } from './scolarite.service';

const USER = { id: 'scolarite-1', role: Role.SCOLARITE } as AuthUser;
const EVALUATION: any = {
  id: 'eval-1',
  intitule: 'Partiel',
  type: TypeEvaluation.EXAMEN,
  coefficient: 1,
  matiereId: 'matiere-1',
  anneeId: 'annee-1',
  promotionId: 'promotion-1',
  semestre: 1,
  date: null,
  statut: StatutEvaluation.OUVERTE,
  _count: { notes: 0 },
};

function preparer(apres: any = EVALUATION, anneePromotion = 'annee-1') {
  const auditLog = { create: jest.fn().mockResolvedValue({}) };
  const tx: any = {
    evaluation: {
      findUnique: jest.fn().mockResolvedValue(EVALUATION),
      create: jest.fn().mockResolvedValue(apres),
      update: jest.fn().mockResolvedValue(apres),
      delete: jest.fn().mockResolvedValue(EVALUATION),
    },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    promotion: { findUnique: jest.fn().mockResolvedValue({ anneeId: anneePromotion }) },
    auditLog,
  };
  const prisma: any = {
    evaluation: {
      findUnique: jest.fn().mockResolvedValue(EVALUATION),
      findFirst: jest.fn().mockResolvedValue(EVALUATION),
    },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', cloturee: false }) },
    matiere: { findUnique: jest.fn().mockResolvedValue({ id: 'matiere-1' }) },
    promotion: { findUnique: jest.fn().mockResolvedValue({ id: 'promotion-1' }) },
    $transaction: jest.fn((work) => work(tx)),
  };
  return { prisma, tx, auditLog, service: new ScolariteService(prisma) };
}

describe('Journal avant/après des évaluations', () => {
  it('journalise la création dans la transaction', async () => {
    const { prisma, tx, auditLog, service } = preparer();
    await service.creerEvaluation(
      {
        intitule: 'Partiel',
        type: TypeEvaluation.EXAMEN,
        matiereId: 'matiere-1',
        anneeId: 'annee-1',
        promotionId: 'promotion-1',
      } as any,
      USER,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.evaluation.create).toHaveBeenCalledTimes(1);
    expect(JSON.parse(auditLog.create.mock.calls[0][0].data.details)).toMatchObject({
      avant: null,
      apres: { id: 'eval-1', statut: StatutEvaluation.OUVERTE },
    });
  });

  it('refuse une évaluation qui associe une promotion d’une autre année', async () => {
    const { tx, auditLog, service } = preparer(EVALUATION, 'annee-2');
    await expect(
      service.creerEvaluation(
        {
          intitule: 'Partiel',
          type: TypeEvaluation.EXAMEN,
          matiereId: 'matiere-1',
          anneeId: 'annee-1',
          promotionId: 'promotion-1',
        } as any,
        USER,
      ),
    ).rejects.toThrow('même année académique');
    expect(tx.evaluation.create).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('journalise les changements de paramètres avant/après', async () => {
    const apres = { ...EVALUATION, intitule: 'Partiel final' };
    const { tx, auditLog, service } = preparer(apres);
    await service.modifierEvaluation('eval-1', { intitule: 'Partiel final' } as any, USER);

    expect(tx.evaluation.update).toHaveBeenCalledTimes(1);
    expect(JSON.parse(auditLog.create.mock.calls[0][0].data.details)).toMatchObject({
      avant: { intitule: 'Partiel' },
      apres: { intitule: 'Partiel final' },
    });
  });

  it('journalise la suppression avant qu’elle ne soit validée', async () => {
    const { tx, auditLog, service } = preparer();
    await service.supprimerEvaluation('eval-1', USER);

    expect(tx.evaluation.delete).toHaveBeenCalledWith({ where: { id: 'eval-1' } });
    expect(JSON.parse(auditLog.create.mock.calls[0][0].data.details)).toMatchObject({
      avant: { id: 'eval-1', intitule: 'Partiel' },
      apres: null,
    });
  });

  it('journalise la clôture de l’évaluation', async () => {
    const apres = { ...EVALUATION, statut: StatutEvaluation.CLOTUREE };
    const { auditLog, service } = preparer(apres);
    await service.cloturerEvaluation('eval-1', USER);

    expect(JSON.parse(auditLog.create.mock.calls[0][0].data.details)).toMatchObject({
      avant: { statut: StatutEvaluation.OUVERTE },
      apres: { statut: StatutEvaluation.CLOTUREE },
    });
  });
});
