import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AffectationsService } from './affectations.service';
import { PromotionsService } from './promotions.service';

describe('Mutations de référentiels liées à une année', () => {
  const anneeFermee = 'annee-fermee';
  const affectation = { anneeId: anneeFermee, enseignantId: 'ens-1' };
  const promotion = { anneeId: anneeFermee, filiereId: 'fil-1' };

  function depotFerme() {
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      promotion: { findUnique: jest.fn().mockResolvedValue({ id: 'promo-1', anneeId: anneeFermee }) },
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((operation: any) => operation(prisma));
    return prisma;
  }

  it('refuse la création, modification et suppression d’une affectation d’année close', async () => {
    const prisma: any = depotFerme();
    const service = new AffectationsService(prisma);
    const create = jest.spyOn(service, 'create').mockResolvedValue({} as any);
    jest.spyOn(service, 'findOne').mockResolvedValue(affectation as any);
    const update = jest.spyOn(service, 'update').mockResolvedValue({} as any);

    await expect(
      service.creerPour({ anneeId: anneeFermee } as any, { role: Role.ADMIN } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.modifierPour('aff-1', {}, { role: Role.ADMIN } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.remove('aff-1', { role: Role.ADMIN } as any)).rejects.toBeInstanceOf(BadRequestException);

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect((prisma as any).affectation).toBeUndefined();
  });

  it('refuse la création, modification et suppression d’une promotion d’année close', async () => {
    const prisma: any = depotFerme();
    const service = new PromotionsService(prisma);
    const create = jest.spyOn(service, 'create').mockResolvedValue({} as any);
    jest.spyOn(service, 'findOne').mockResolvedValue(promotion as any);
    const update = jest.spyOn(service, 'update').mockResolvedValue({} as any);

    await expect(service.creer({ anneeId: anneeFermee } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.modifier('promo-1', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove('promo-1')).rejects.toBeInstanceOf(BadRequestException);

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('refuse une affectation dont la promotion appartient à une autre année', async () => {
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      promotion: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-2' }) },
      affectation: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((operation: any) => operation(prisma));
    const service = new AffectationsService(prisma);

    await expect(
      service.creerPour(
        {
          anneeId: 'annee-1',
          promotionId: 'promo-1',
          enseignantId: 'ens-1',
          matiereId: 'mat-1',
        } as any,
        { role: Role.ADMIN, id: 'admin-1' } as any,
      ),
    ).rejects.toThrow('même année académique');
    expect(prisma.affectation.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('recontrôle la clôture avec le client transactionnel après son précontrôle', async () => {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: true }]),
      affectation: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ cloturee: false }])
        .mockResolvedValueOnce([{ anneeId: anneeFermee }]),
      $transaction: jest.fn((operation: any) => operation(tx)),
      enseignant: { findUnique: jest.fn().mockResolvedValue({ departementId: 'dept-1' }) },
    };
    const service = new AffectationsService(prisma);

    await expect(
      service.creerPour(
        {
          anneeId: anneeFermee,
          promotionId: 'promo-1',
          enseignantId: 'ens-1',
          matiereId: 'mat-1',
        } as any,
        { role: Role.ADMIN, id: 'admin-1' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.affectation.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
