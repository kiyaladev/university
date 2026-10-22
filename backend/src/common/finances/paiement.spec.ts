import { OPERATEURS_MOBILE_MONEY, creerPaiementTx, sourcePaiement } from './paiement';

describe('sourcePaiement', () => {
  it.each([
    [{ inscriptionFormation: { id: 'if-1' } }, 'FORMATION'],
    [{ recharges: [{ id: 'r-1' }] }, 'RESTO'],
    [{ rechargesRecette: { id: 'rec-1' } }, 'RECETTE'],
    [{ demandeDocument: { id: 'dem-1' } }, 'DOCUMENT'],
    [{ inscriptionFormation: null, recharges: [], rechargesRecette: null, demandeDocument: null }, 'INSCRIPTION'],
    [{}, 'INSCRIPTION'],
  ])('déduit la source de %j', (relations, source) => {
    expect(sourcePaiement(relations)).toBe(source);
  });

  it('garde l’ordre du garde-fou historique quand plusieurs liens coexistent', () => {
    expect(sourcePaiement({ inscriptionFormation: { id: 'if-1' }, demandeDocument: { id: 'd-1' } })).toBe('FORMATION');
    expect(sourcePaiement({ recharges: [{ id: 'r-1' }], demandeDocument: { id: 'd-1' } })).toBe('RESTO');
  });
});

describe('OPERATEURS_MOBILE_MONEY', () => {
  it('reste la liste commune des opérateurs', () => {
    expect(OPERATEURS_MOBILE_MONEY).toEqual(['ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE']);
  });
});

describe('creerPaiementTx', () => {
  it('crée le paiement avec les arguments reçus, sans journal par défaut', async () => {
    const tx: any = {
      paiement: { create: jest.fn().mockResolvedValue({ id: 'p-1' }) },
      auditLog: { create: jest.fn() },
    };
    const args = { data: { reference: 'PAY-2026-00001', montant: 10, mode: 'ESPECES' } } as any;

    await expect(creerPaiementTx(tx, args)).resolves.toEqual({ id: 'p-1' });
    expect(tx.paiement.create).toHaveBeenCalledWith(args);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('journalise la création dans la même transaction avec l’instantané fourni', async () => {
    const tx: any = {
      paiement: { create: jest.fn().mockResolvedValue({ id: 'p-1', telephone: '+224600000000' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    await creerPaiementTx(tx, { data: {} } as any, { userId: 'agent-1', instantane: (p: any) => ({ id: p.id }) });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'agent-1',
        action: 'PAIEMENT_CREE',
        entite: 'Paiement',
        entiteId: 'p-1',
        details: JSON.stringify({ avant: null, apres: { id: 'p-1' } }),
      },
    });
  });
});
