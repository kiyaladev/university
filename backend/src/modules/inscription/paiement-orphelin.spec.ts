import { BadRequestException } from '@nestjs/common';
import { InscriptionService } from './inscription.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Paiements sans inscription', () => {
  it('attache le paiement manuel à une année ouverte et journalise sa création atomiquement', async () => {
    const paiement = {
      id: 'payment-1',
      reference: 'PAY-2026-00001',
      anneeId: 'year-1',
      inscriptionId: null,
      etudiantId: null,
      montant: 5000,
      devise: 'GNF',
      mode: 'ESPECES',
      statut: 'EN_ATTENTE',
    };
    const tx = {
      inscription: { findUnique: jest.fn() },
      anneeAcademique: {
        findFirst: jest.fn().mockResolvedValue({ id: 'year-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'year-1', libelle: '2026-2027', cloturee: false }),
      },
      paiement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(paiement),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
      paiement: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const service = new InscriptionService(prisma as any, {} as any, {} as any, {} as any);

    await service.creerPaiement({ montant: 5000, mode: 'ESPECES' } as any, { id: 'agent-1' } as any);

    expect(tx.paiement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ anneeId: 'year-1', inscriptionId: null }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse un paiement orphelin quand aucune année ouverte ne peut lui être rattachée', async () => {
    const tx = {
      inscription: { findUnique: jest.fn() },
      anneeAcademique: { findFirst: jest.fn().mockResolvedValue(null) },
      paiement: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)) };
    const service = new InscriptionService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.creerPaiement({ montant: 5000, mode: 'ESPECES' } as any, { id: 'agent-1' } as any))
      .rejects.toThrow(BadRequestException);
    expect(tx.paiement.create).not.toHaveBeenCalled();
  });
});
