import { transmettreMobileMoney } from './mobile-money';

const PAIEMENT = {
  id: 'p-1',
  reference: 'PAY-2026-00001',
  montant: 25000,
  devise: 'GNF',
  operateur: null,
  telephone: '+224622334455',
  motif: 'motif confidentiel',
};

function preparer(reponse: unknown) {
  const tx: any = {
    paiement: {
      findUnique: jest.fn().mockResolvedValue(PAIEMENT),
      update: jest.fn().mockResolvedValue({ ...PAIEMENT, transactionId: 'tx-1' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const mobileMoney = { demanderPaiement: jest.fn().mockResolvedValue(reponse) };
  const logger = { warn: jest.fn(), error: jest.fn() };
  const options = { prisma, mobileMoney, logger, userId: 'agent-1', instantane: (p: any) => ({ statut: p.statut }) };
  return { tx, prisma, mobileMoney, options };
}

describe('transmettreMobileMoney', () => {
  const urlAvant = process.env.MOBILE_MONEY_URL;
  afterEach(() => {
    if (urlAvant === undefined) delete process.env.MOBILE_MONEY_URL;
    else process.env.MOBILE_MONEY_URL = urlAvant;
  });

  it('sans passerelle, n’appelle rien par défaut', async () => {
    delete process.env.MOBILE_MONEY_URL;
    const { mobileMoney, prisma, options } = preparer({ mode: 'simulation', transactionId: null });

    await expect(transmettreMobileMoney(PAIEMENT, options)).resolves.toBeNull();
    expect(mobileMoney.demanderPaiement).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('sans passerelle, trace la simulation pilote si demandé, sans journal ni rattachement', async () => {
    delete process.env.MOBILE_MONEY_URL;
    const { mobileMoney, prisma, options } = preparer({ mode: 'simulation', transactionId: null });

    await expect(transmettreMobileMoney(PAIEMENT, { ...options, appelerSansPasserelle: true })).resolves.toBeNull();
    expect(mobileMoney.demanderPaiement).toHaveBeenCalledWith(expect.objectContaining({ operateur: 'AUTRE' }));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignore un paiement sans téléphone', async () => {
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
    const { mobileMoney, options } = preparer({ mode: 'operateur', transactionId: 'tx-1' });

    await expect(transmettreMobileMoney({ ...PAIEMENT, telephone: null }, options)).resolves.toBeNull();
    expect(mobileMoney.demanderPaiement).not.toHaveBeenCalled();
  });

  it('rattache la référence opérateur avec l’include demandé et renvoie le paiement lié', async () => {
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
    const { tx, prisma, options } = preparer({ mode: 'operateur', transactionId: 'tx-1' });
    const include = { etudiant: true };

    await expect(transmettreMobileMoney(PAIEMENT, { ...options, include })).resolves.toMatchObject({
      transactionId: 'tx-1',
    });
    expect(tx.paiement.update).toHaveBeenCalledWith({ where: { id: 'p-1' }, data: { transactionId: 'tx-1' }, include });
    expect(prisma.auditLog.create.mock.calls.map((c: any[]) => c[0].data.action)).toEqual([
      'PAIEMENT_MOBILE_MONEY_TENTATIVE',
    ]);
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('PAIEMENT_TRANSACTION_LIEE');
  });

  it('journalise une réponse opérateur sans référence', async () => {
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
    const { prisma, options } = preparer({ mode: 'operateur', transactionId: null });

    await expect(transmettreMobileMoney(PAIEMENT, options)).resolves.toBeNull();
    expect(prisma.auditLog.create.mock.calls.map((c: any[]) => c[0].data.action)).toEqual([
      'PAIEMENT_MOBILE_MONEY_TENTATIVE',
      'PAIEMENT_MOBILE_MONEY_REPONSE_INVALIDE',
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
