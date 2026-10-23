import { ModePaiement } from '@prisma/client';
import { PaiementsService } from './paiements.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

function preparerPaiementMm() {
  const paiement = {
    id: 'paiement-mm-1',
    reference: 'PAY-2026-00001',
    anneeId: 'annee-1',
    inscriptionId: null,
    etudiantId: null,
    montant: 25000,
    devise: 'GNF',
    mode: ModePaiement.MOBILE_MONEY,
    operateur: 'ORANGE',
    telephone: '+224622334455',
    motif: 'frais confidentiels',
    statut: 'EN_ATTENTE',
    transactionId: null,
  };
  const tx: any = {
    inscription: { findUnique: jest.fn() },
    anneeAcademique: {
      findFirst: jest.fn().mockResolvedValue({ id: 'annee-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2026-2027', cloturee: false }),
    },
    paiement: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(paiement),
      findUnique: jest.fn().mockResolvedValue(paiement),
      update: jest.fn().mockResolvedValue({ ...paiement, transactionId: 'provider-secret-transaction' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const mobileMoney = { demanderPaiement: jest.fn() };
  const service = new PaiementsService(prisma, mobileMoney as any);
  return { paiement, tx, prisma, mobileMoney, service };
}

describe('Paiement Mobile Money — orchestration de l’inscription', () => {
  const urlAvant = process.env.MOBILE_MONEY_URL;

  beforeEach(() => {
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
  });
  afterEach(() => {
    if (urlAvant === undefined) delete process.env.MOBILE_MONEY_URL;
    else process.env.MOBILE_MONEY_URL = urlAvant;
  });

  it('retourne le paiement en attente si le rattachement local échoue après acceptation opérateur', async () => {
    const { paiement, tx, prisma, mobileMoney, service } = preparerPaiementMm();
    mobileMoney.demanderPaiement.mockResolvedValue({ mode: 'operateur', transactionId: 'provider-secret-transaction' });
    prisma.$transaction
      .mockImplementationOnce((operation: (client: any) => unknown) => operation(tx))
      .mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.creerPaiement(
        {
          montant: 25000,
          mode: ModePaiement.MOBILE_MONEY,
          telephone: paiement.telephone,
          operateur: paiement.operateur,
        } as any,
        { id: 'agent-1' } as any,
      ),
    ).resolves.toMatchObject({
      id: paiement.id,
      statut: 'EN_ATTENTE',
      transactionId: null,
    });

    expect(mobileMoney.demanderPaiement).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual([
      'PAIEMENT_MOBILE_MONEY_TENTATIVE',
      'PAIEMENT_TRANSACTION_LIAISON_ECHEC',
    ]);
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain('provider-secret-transaction');
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(paiement.telephone);
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(paiement.motif);
  });

  it('journalise le refus de la passerelle sans relancer la demande', async () => {
    const { paiement, prisma, mobileMoney, service } = preparerPaiementMm();
    mobileMoney.demanderPaiement.mockRejectedValue(new Error('provider-secret-response'));

    await expect(
      service.creerPaiement(
        {
          montant: 25000,
          mode: ModePaiement.MOBILE_MONEY,
          telephone: paiement.telephone,
          operateur: paiement.operateur,
        } as any,
        { id: 'agent-1' } as any,
      ),
    ).resolves.toMatchObject({ id: paiement.id, statut: 'EN_ATTENTE' });

    expect(mobileMoney.demanderPaiement).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual([
      'PAIEMENT_MOBILE_MONEY_TENTATIVE',
      'PAIEMENT_MOBILE_MONEY_ECHEC',
    ]);
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain('provider-secret-response');
  });

  it('ne recopie pas la référence opérateur, le téléphone ou le motif dans l’audit de liaison', async () => {
    const { paiement, tx, mobileMoney, service } = preparerPaiementMm();
    mobileMoney.demanderPaiement.mockResolvedValue({ mode: 'operateur', transactionId: 'provider-secret-transaction' });

    await service.creerPaiement(
      {
        montant: 25000,
        mode: ModePaiement.MOBILE_MONEY,
        telephone: paiement.telephone,
        operateur: paiement.operateur,
      } as any,
      { id: 'agent-1' } as any,
    );

    const auditLiaison = tx.auditLog.create.mock.calls
      .map((call: any[]) => call[0].data)
      .find((data: any) => data.action === 'PAIEMENT_TRANSACTION_LIEE');
    expect(auditLiaison).toBeDefined();
    expect(auditLiaison.details).not.toContain('provider-secret-transaction');
    expect(auditLiaison.details).not.toContain(paiement.telephone);
    expect(auditLiaison.details).not.toContain(paiement.motif);
    expect(JSON.parse(auditLiaison.details).champsModifies).toEqual(['transactionId']);
  });
});
