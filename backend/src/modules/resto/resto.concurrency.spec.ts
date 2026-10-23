import { BadRequestException, ConflictException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { ModePaiement, Role, StatutConsommation, StatutPaiement } from '@prisma/client';
import type { AuthUser } from '../../common/decorators';
import { RestoService } from './resto.service';

describe('écritures concurrentes du portefeuille resto', () => {
  beforeEach(() => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Opération refusée' } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('ne crédite pas deux fois une recharge déjà réclamée par une confirmation concurrente', async () => {
    const updateRecharge = jest.fn().mockResolvedValue({ count: 0 });
    const credit = jest.fn();
    const prisma: any = {
      recharge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r-1',
          statut: StatutPaiement.EN_ATTENTE,
          paiementId: null,
          portefeuilleId: 'p-1',
          montant: 100,
        }),
      },
      $transaction: jest.fn((operation) =>
        operation({
          recharge: { updateMany: updateRecharge },
          portefeuilleResto: { update: credit },
        }),
      ),
    };
    const service = new RestoService(prisma, {} as never, {} as never);

    await expect(
      service.simulerRecharge('r-1', { statut: StatutPaiement.REUSSI }, { id: 'admin' } as AuthUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateRecharge).toHaveBeenCalledWith({
      where: { id: 'r-1', statut: StatutPaiement.EN_ATTENTE },
      data: { statut: StatutPaiement.REUSSI },
    });
    expect(credit).not.toHaveBeenCalled();
  });

  it('journalise la confirmation et le solde dans la transaction de recharge, sans identité étudiante', async () => {
    const recharge = {
      id: 'r-2',
      statut: StatutPaiement.EN_ATTENTE,
      paiementId: 'pay-2',
      portefeuilleId: 'p-2',
      montant: 75,
    };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      recharge: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      portefeuilleResto: {
        findUnique: jest.fn().mockResolvedValue({ solde: 125 }),
        update: jest.fn().mockResolvedValue({ solde: 200 }),
      },
      paiement: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      recharge: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(recharge)
          .mockResolvedValueOnce({ ...recharge, statut: StatutPaiement.REUSSI }),
      },
      $transaction: jest.fn((operation) => operation(transaction)),
    };
    const service = new RestoService(prisma, {} as never, {} as never);

    await service.simulerRecharge('r-2', { statut: StatutPaiement.REUSSI }, { id: 'admin' } as AuthUser);

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin',
        action: 'RECHARGE_CONFIRMEE',
        entiteId: 'r-2',
        details: expect.any(String),
      }),
    });
    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details).toEqual({
      avant: { statut: StatutPaiement.EN_ATTENTE, solde: 125 },
      apres: { statut: StatutPaiement.REUSSI, solde: 200 },
      montant: 75,
      champsModifies: ['statut', 'solde'],
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('crée paiement, recharge, crédit et audit dans une transaction', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      paiement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'pay-4', reference: 'PAY-R-2026-00001' }),
      },
      recharge: { create: jest.fn().mockResolvedValue({ id: 'r-4', statut: StatutPaiement.REUSSI }) },
      portefeuilleResto: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ solde: 80 }),
        update: jest.fn().mockResolvedValue({ solde: 100 }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      portefeuilleResto: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-4', etudiantId: 'e-4', solde: 80 }),
        upsert: jest.fn().mockResolvedValue({ id: 'p-4', etudiantId: 'e-4', solde: 80 }),
      },
      anneeAcademique: { findFirst: jest.fn().mockResolvedValue({ libelle: '2025-2026' }) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const parametres = { valeur: jest.fn().mockResolvedValue('+224 000 00 00 00') };
    const service = new RestoService(prisma, parametres as never, {} as never);

    await service.recharger('p-4', { montant: 20, mode: ModePaiement.ESPECES } as never, { id: 'admin' } as AuthUser);

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin',
        action: 'RECHARGE_CREEE',
        entiteId: 'r-4',
        details: expect.any(String),
      }),
    });
    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details).toEqual({
      reference: 'PAY-R-2026-00001',
      montant: 20,
      statut: StatutPaiement.REUSSI,
      avant: { solde: 80 },
      apres: { solde: 100 },
      champsModifies: ['paiement', 'recharge', 'solde'],
    });
    expect(auditCreate.mock.calls[0][0].data.details).not.toContain('e-4');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('conserve le solde dans la réponse et le journal d’une recharge en attente', async () => {
    const auditCreate = jest.fn();
    const credit = jest.fn();
    const tx = {
      paiement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'pay-pending', reference: 'PAY-R-2026-00001' }),
      },
      recharge: { create: jest.fn().mockResolvedValue({ id: 'r-pending', statut: StatutPaiement.EN_ATTENTE }) },
      portefeuilleResto: { findUniqueOrThrow: jest.fn().mockResolvedValue({ solde: 15000 }), update: credit },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      portefeuilleResto: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p', etudiantId: 'e' }),
        upsert: jest.fn().mockResolvedValue({ id: 'p', etudiantId: 'e' }),
      },
      anneeAcademique: { findFirst: jest.fn().mockResolvedValue({ libelle: '2025-2026' }) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const result = await new RestoService(prisma, {} as never, {} as never).recharger(
      'p',
      { montant: 1000, mode: ModePaiement.MOBILE_MONEY, simuler: false },
      { id: 'admin' } as AuthUser,
    );
    expect(result.solde).toBe(15000);
    expect(result.immediat).toBe(false);
    expect(credit).not.toHaveBeenCalled();
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.details)).toMatchObject({
      avant: { solde: 15000 },
      apres: { solde: 15000 },
      champsModifies: ['paiement', 'recharge'],
    });
  });

  it('ne rembourse pas deux fois une consommation déjà annulée concurremment', async () => {
    const refund = jest.fn();
    const prisma: any = {
      consommationResto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c-1',
          statut: StatutConsommation.VALIDE,
          montant: 50,
          portefeuilleId: 'p-1',
          etudiant: 'E-1 — Test',
          portefeuille: { id: 'p-1' },
        }),
      },
      $transaction: jest.fn((operation) =>
        operation({
          consommationResto: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          portefeuilleResto: { update: refund },
        }),
      ),
    };
    const service = new RestoService(prisma, {} as never, {} as never);

    await expect(
      service.annulerConsommation('c-1', {}, { id: 'admin', role: Role.ADMIN } as AuthUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(refund).not.toHaveBeenCalled();
  });

  it('journalise annulation et remboursement atomiquement sans copier le motif ni l’identité', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      consommationResto: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'c-2', statut: StatutConsommation.ANNULE }),
      },
      portefeuilleResto: { update: jest.fn().mockResolvedValue({ solde: 150 }) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      consommationResto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c-2',
          statut: StatutConsommation.VALIDE,
          montant: 50,
          portefeuilleId: 'p-2',
          etudiant: 'E-2 — Personne privée',
          portefeuille: { id: 'p-2', solde: 100 },
        }),
      },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new RestoService(prisma, {} as never, {} as never);

    await service.annulerConsommation('c-2', { motif: 'donnée confidentielle' }, { id: 'admin' } as AuthUser);

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details).toEqual({
      montant: 50,
      motifFourni: true,
      avant: { statut: StatutConsommation.VALIDE, solde: 100 },
      apres: { statut: StatutConsommation.ANNULE, solde: 150 },
      champsModifies: ['statut', 'solde'],
    });
    expect(auditCreate.mock.calls[0][0].data.details).not.toContain('donnée confidentielle');
    expect(auditCreate.mock.calls[0][0].data.details).not.toContain('Personne privée');
  });

  it('refuse un débit si le solde a changé sous le contrôle concurrent', async () => {
    const create = jest.fn();
    const debit = jest.fn().mockResolvedValue({ count: 0 });
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'cashier', actif: true, role: Role.CONTROLEUR }) },
      etudiant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'e-1',
          matricule: 'E-1',
          nom: 'Test',
          prenom: 'A',
          qrRestoToken: 'UP-RESTO-1',
        }),
      },
      $transaction: jest.fn((operation) =>
        operation({
          portefeuilleResto: {
            upsert: jest.fn().mockResolvedValue({ id: 'p-1', etudiantId: 'e-1', solde: 100 }),
            updateMany: debit,
          },
          consommationResto: { create },
        }),
      ),
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'cashier' }) };
    const service = new RestoService(prisma, {} as never, jwt as never);

    await expect(
      service.validerRepas({ reference: 'E-1', repas: 'DEJEUNER', montant: 80 }, 'token'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(debit).toHaveBeenCalledWith({
      where: { id: 'p-1', solde: { gte: 80 } },
      data: { solde: { decrement: 80 } },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('journalise le repas et le débit dans la même transaction sans identité étudiante', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      portefeuilleResto: {
        upsert: jest.fn().mockResolvedValue({ id: 'p-3', etudiantId: 'e-3', solde: 100 }),
        findUnique: jest.fn().mockResolvedValueOnce({ solde: 75 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      consommationResto: { create: jest.fn().mockResolvedValue({ id: 'c-3' }) },
      auditLog: { create: auditCreate },
    };
    const etudiant = { id: 'e-3', matricule: 'E-3', nom: 'Personne privée', prenom: 'A', qrRestoToken: 'UP-RESTO-3' };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'cashier', actif: true, role: Role.CONTROLEUR }) },
      etudiant: { findUnique: jest.fn().mockResolvedValue(etudiant) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'cashier' }) };
    const service = new RestoService(prisma, {} as never, jwt as never);

    await service.validerRepas({ reference: 'UP-RESTO-3', repas: 'DEJEUNER', montant: 25 }, 'token');

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'cashier',
        action: 'REPAS_VALIDE',
        entiteId: 'c-3',
        details: expect.any(String),
      }),
    });
    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details).toEqual({
      repas: 'DEJEUNER',
      montant: 25,
      avant: { solde: 100 },
      apres: { solde: 75 },
      champsModifies: ['solde'],
    });
    expect(auditCreate.mock.calls[0][0].data.details).not.toContain('Personne privée');
  });
});
