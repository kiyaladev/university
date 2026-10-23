import { BadRequestException } from '@nestjs/common';
import { FraisService } from './frais.service';

describe('Tarifs d’inscription — historique de modification', () => {
  it('refuse un tarif rattaché à une promotion d’une autre année', async () => {
    const tx = {
      promotion: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-2' }) },
      frais: { create: jest.fn() },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      frais: { findUnique: jest.fn().mockResolvedValue(null) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $transaction: jest.fn((operation: any) => operation(tx)),
    };
    const service = new FraisService(prisma);

    await expect(
      service.creerFrais(
        { anneeId: 'annee-1', promotionId: 'promotion-1', montant: 100 } as any,
        { id: 'scolarite-1' } as any,
      ),
    ).rejects.toThrow('même année académique');
    expect(tx.frais.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('journalise les montants avant/après avec la propagation dans la même transaction', async () => {
    const avant = { id: 'frais-1', anneeId: 'annee-1', promotionId: 'promotion-1', montant: 100, devise: 'GNF' };
    const apres = { ...avant, montant: 125 };
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const tx = {
      frais: { findUnique: jest.fn().mockResolvedValue(avant), update: jest.fn().mockResolvedValue(apres) },
      promotion: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-1' }) },
      inscription: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      auditLog,
    };
    const prisma = {
      frais: { findUnique: jest.fn().mockResolvedValue(avant) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new FraisService(prisma as any);

    await service.modifierFrais('frais-1', { montant: 125 } as any, { id: 'scolarite-1' } as any);

    expect(tx.inscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { montantFrais: 125 } }));
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'scolarite-1',
        action: 'FRAIS_MODIFIE',
        entite: 'Frais',
        entiteId: 'frais-1',
        details: JSON.stringify({
          avant: { id: 'frais-1', anneeId: 'annee-1', promotionId: 'promotion-1', montant: 100, devise: 'GNF' },
          apres: { id: 'frais-1', anneeId: 'annee-1', promotionId: 'promotion-1', montant: 125, devise: 'GNF' },
        }),
      },
    });
  });

  it('refuse dans la transaction de modifier un tarif d’une année clôturée', async () => {
    const tx = {
      frais: {
        findUnique: jest.fn().mockResolvedValue({ id: 'frais-1', anneeId: 'annee-close', promotionId: 'promotion-1' }),
        update: jest.fn(),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      promotion: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      frais: { findUnique: jest.fn().mockResolvedValue({ id: 'frais-1', anneeId: 'annee-close' }) },
      $transaction: jest.fn((operation: any) => operation(tx)),
    };
    const service = new FraisService(prisma);

    await expect(
      service.modifierFrais('frais-1', { montant: 125 } as any, { id: 'scolarite-1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.frais.update).not.toHaveBeenCalled();
  });
});
