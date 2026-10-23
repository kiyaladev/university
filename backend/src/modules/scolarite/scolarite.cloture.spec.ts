import { BadRequestException } from '@nestjs/common';
import { Role, SessionDeliberation, StatutDeliberation, StatutEvaluation, TypeEvaluation } from '@prisma/client';
import { ScolariteService } from './scolarite.service';
import type { AuthUser } from '../../common/decorators';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

const USER = { id: 'sco-1', role: Role.SCOLARITE } as AuthUser;
const EVALUATION = {
  id: 'eval-1',
  intitule: 'Examen',
  type: TypeEvaluation.EXAMEN,
  statut: StatutEvaluation.OUVERT,
  anneeId: 'annee-1',
  promotionId: 'promo-1',
  matiereId: 'matiere-1',
  _count: { notes: 0 },
};
const DELIBERATION = {
  id: 'delib-1',
  anneeId: 'annee-1',
  promotionId: 'promo-1',
  statut: StatutDeliberation.BROUILLON,
  session: SessionDeliberation.NORMALE,
};

function preparer() {
  const tx: any = {
    evaluation: {
      findFirst: jest.fn().mockResolvedValue(EVALUATION),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inscription: { findMany: jest.fn() },
    note: { findMany: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn() },
    deliberation: { findUnique: jest.fn().mockResolvedValue(DELIBERATION), update: jest.fn() },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', cloturee: true }) },
  };
  const prisma: any = {
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', cloturee: true }) },
    matiere: { findUnique: jest.fn().mockResolvedValue({ id: 'matiere-1' }) },
    promotion: { findUnique: jest.fn().mockResolvedValue({ id: 'promo-1' }) },
    evaluation: {
      findUnique: jest.fn().mockResolvedValue(EVALUATION),
      findFirst: jest.fn().mockResolvedValue(EVALUATION),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inscription: { findMany: jest.fn() },
    deliberation: {
      findUnique: jest.fn().mockResolvedValue(DELIBERATION),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(tx)),
  };
  return { prisma, tx, service: new ScolariteService(prisma) };
}

describe('Écritures de scolarité après clôture annuelle', () => {
  it('refuse la création d’une évaluation sur une année close', async () => {
    const { prisma, service } = preparer();
    await expect(
      service.creerEvaluation(
        {
          intitule: 'Examen',
          type: TypeEvaluation.EXAMEN,
          matiereId: 'matiere-1',
          anneeId: 'annee-1',
          promotionId: 'promo-1',
        } as any,
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.evaluation.create).not.toHaveBeenCalled();
  });

  it('refuse modification, suppression, clôture et saisie de notes sur une année close', async () => {
    const { prisma, service } = preparer();
    await expect(service.modifierEvaluation('eval-1', {} as any, USER)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.supprimerEvaluation('eval-1', USER)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.cloturerEvaluation('eval-1', USER)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.saisirNotes({ evaluationId: 'eval-1', notes: [] } as any, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.evaluation.update).not.toHaveBeenCalled();
    expect(prisma.evaluation.delete).not.toHaveBeenCalled();
    expect(prisma.inscription.findMany).not.toHaveBeenCalled();
  });

  it('refuse la création d’une délibération sur une année close', async () => {
    const { prisma, service } = preparer();
    await expect(
      service.creerDeliberation(
        {
          anneeId: 'annee-1',
          promotionId: 'promo-1',
          session: SessionDeliberation.NORMALE,
        } as any,
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('verrouille l’année dans la transaction avant de créer la délibération', async () => {
    const { prisma, tx, service } = preparer();
    prisma.anneeAcademique.findUnique.mockResolvedValue({ id: 'annee-1', cloturee: false });
    prisma.deliberation.findUnique.mockResolvedValue(null);
    tx.anneeAcademique.findUnique.mockResolvedValue({ cloturee: false });
    tx.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ anneeId: 'annee-1' }])
      .mockResolvedValueOnce([{ cloturee: false }]);
    tx.promotion = { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-1' }) };
    tx.deliberation.create = jest.fn().mockImplementation(() => {
      throw new Error('stop après contrôle');
    });

    await expect(
      service.creerDeliberation(
        {
          anneeId: 'annee-1',
          promotionId: 'promo-1',
          session: SessionDeliberation.NORMALE,
        } as any,
        USER,
      ),
    ).rejects.toThrow('stop après contrôle');

    expect(tx.$queryRaw.mock.calls[1][0].join('?')).toContain('FOR SHARE');
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.deliberation.create.mock.invocationCallOrder[0]);
  });

  it('refuse le recalcul et la validation d’une délibération après clôture', async () => {
    const { tx, service } = preparer();
    await expect(service.calculerDeliberation('delib-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validerDeliberation('delib-1', USER.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.deliberation.update).not.toHaveBeenCalled();
  });
});
