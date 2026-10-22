import { ConflictException } from '@nestjs/common';
import { StatutPaiement } from '@prisma/client';
import { InscriptionService } from './inscription.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

/**
 * La confirmation pilote de /paiements ne concerne que la scolarité : un
 * paiement né dans un autre portefeuille se confirme dans son module.
 */
function preparer(liens: Record<string, unknown>) {
  const paiement = {
    id: 'paiement-1',
    reference: 'PAY-R-2026-00001',
    anneeId: 'annee-1',
    inscriptionId: null,
    inscription: null,
    etudiantId: 'etudiant-1',
    montant: 10000,
    devise: 'GNF',
    statut: StatutPaiement.EN_ATTENTE,
    inscriptionFormation: null,
    recharges: [],
    rechargesRecette: null,
    demandeDocument: null,
    ...liens,
  };
  const tx: any = {
    paiement: {
      findUnique: jest.fn().mockResolvedValue(paiement),
      updateMany: jest.fn(),
    },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    inscription: { findUnique: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma: any = { $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)) };
  const service = new InscriptionService(prisma, {} as any, {} as any, {} as any);
  return { tx, service, paiement };
}

describe('Confirmation pilote des paiements — garde-fou des autres portefeuilles', () => {
  const agent = { id: 'agent-1' } as any;

  it.each([
    ['une recharge resto', { recharges: [{ id: 'recharge-1' }] }, 'inscription.paiement_resto_confirme_par_la_recharge'],
    ['une recette externe', { rechargesRecette: { id: 'recette-1' } }, 'inscription.paiement_recette_geree_par_les_recettes'],
    ['une demande de document', { demandeDocument: { id: 'demande-1' } }, 'inscription.paiement_document_confirme_par_la_demande'],
    ['une formation', { inscriptionFormation: { id: 'if-1' } }, 'inscription.paiement_formation_confirme_par_action_de_formation'],
  ])('refuse un paiement lié à %s sans rien écrire', async (_libelle, liens, message) => {
    const { tx, service } = preparer(liens);

    const resultat = service.simulerPaiement('paiement-1', { statut: 'REUSSI' } as any, agent);
    await expect(resultat).rejects.toBeInstanceOf(ConflictException);
    await expect(resultat).rejects.toMatchObject({ response: { message } });
    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('charge les liens vers les autres portefeuilles avant de décider', async () => {
    const { tx, service } = preparer({ recharges: [{ id: 'recharge-1' }] });

    await expect(service.simulerPaiement('paiement-1', { statut: 'ECHOUE' } as any, agent)).rejects.toThrow();
    const include = tx.paiement.findUnique.mock.calls[0][0].include;
    expect(include).toMatchObject({
      inscriptionFormation: expect.anything(),
      recharges: expect.anything(),
      rechargesRecette: expect.anything(),
      demandeDocument: expect.anything(),
    });
  });

  it('confirme toujours un paiement de scolarité sans lien externe', async () => {
    const { tx, service, paiement } = preparer({ reference: 'PAY-2026-00001' });
    tx.paiement.updateMany.mockResolvedValue({ count: 1 });
    tx.paiement.findUnique
      .mockResolvedValueOnce(paiement)
      .mockResolvedValueOnce({ ...paiement, statut: StatutPaiement.REUSSI });

    await service.simulerPaiement('paiement-1', { statut: 'REUSSI' } as any, agent);

    expect(tx.paiement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statut: StatutPaiement.REUSSI }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
