import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatutPaiement } from '@prisma/client';
import { PaiementsService } from './paiements.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

/**
 * /paiements/:id/annuler ne concerne, comme la confirmation pilote, que les
 * paiements d'inscription : les autres portefeuilles gèrent les leurs.
 */
function preparer(liens: Record<string, unknown> = {}, statut: StatutPaiement = StatutPaiement.EN_ATTENTE) {
  const paiement = {
    id: 'paiement-1',
    reference: 'PAY-2026-00001',
    anneeId: 'annee-1',
    inscriptionId: null,
    inscription: null,
    etudiantId: 'etudiant-1',
    montant: 10000,
    devise: 'GNF',
    statut,
    inscriptionFormation: null,
    recharges: [],
    rechargesRecette: null,
    demandeDocument: null,
    ...liens,
  };
  const tx: any = {
    paiement: {
      findUnique: jest.fn()
        .mockResolvedValueOnce(paiement)
        .mockResolvedValueOnce({ ...paiement, statut: StatutPaiement.ANNULE }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = { $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)) };
  return { tx, service: new PaiementsService(prisma, {} as any) };
}

describe('Annulation des paiements — garde-fou des autres portefeuilles', () => {
  const agent = { id: 'agent-1' } as any;
  const dto = { motif: 'Saisie en double' } as any;

  it.each([
    ['une recharge resto', { recharges: [{ id: 'recharge-1' }] }, 'inscription.paiement_resto_annule_par_la_recharge'],
    ['une recette externe', { rechargesRecette: { id: 'recette-1' } }, 'inscription.paiement_recette_geree_par_les_recettes'],
    ['une demande de document', { demandeDocument: { id: 'demande-1' } }, 'inscription.paiement_document_annule_par_la_demande'],
    ['une formation', { inscriptionFormation: { id: 'if-1' } }, 'inscription.paiement_formation_annule_par_la_formation'],
  ])('refuse un paiement lié à %s sans rien écrire', async (_libelle, liens, message) => {
    const { tx, service } = preparer(liens);

    const resultat = service.annulerPaiement('paiement-1', dto, agent);
    await expect(resultat).rejects.toBeInstanceOf(ConflictException);
    await expect(resultat).rejects.toMatchObject({ response: { message } });
    expect(tx.anneeAcademique.findUnique).not.toHaveBeenCalled();
    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('charge les liens vers les autres portefeuilles avant de décider', async () => {
    const { tx, service } = preparer({ recharges: [{ id: 'recharge-1' }] });

    await expect(service.annulerPaiement('paiement-1', dto, agent)).rejects.toThrow();
    expect(tx.paiement.findUnique.mock.calls[0][0].include).toMatchObject({
      inscriptionFormation: expect.anything(),
      recharges: expect.anything(),
      rechargesRecette: expect.anything(),
      demandeDocument: expect.anything(),
    });
  });

  it('annule toujours un paiement d’inscription en attente, avec son journal', async () => {
    const { tx, service } = preparer();

    await expect(service.annulerPaiement('paiement-1', dto, agent))
      .resolves.toMatchObject({ statut: StatutPaiement.ANNULE });
    expect(tx.paiement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'paiement-1', statut: StatutPaiement.EN_ATTENTE },
      data: expect.objectContaining({ statut: StatutPaiement.ANNULE, annuleParId: 'agent-1', motifAnnulation: 'Saisie en double' }),
    }));
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('PAIEMENT_ANNULE');
  });

  it('refuse toujours d’annuler un encaissement d’inscription', async () => {
    const { tx, service } = preparer({}, StatutPaiement.REUSSI);

    await expect(service.annulerPaiement('paiement-1', dto, agent)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
  });
});

describe('Liste /paiements — source calculée', () => {
  it('garde toutes les lignes, ajoute `source` et ne renvoie pas les liens techniques', async () => {
    const lignes = [
      { id: 'p-ins', inscriptionFormation: null, recharges: [], rechargesRecette: null, demandeDocument: null },
      { id: 'p-for', inscriptionFormation: { id: 'if-1', numero: 'F-1' }, recharges: [], rechargesRecette: null, demandeDocument: null },
      { id: 'p-res', inscriptionFormation: null, recharges: [{ id: 'r-1' }], rechargesRecette: null, demandeDocument: null },
      { id: 'p-rec', inscriptionFormation: null, recharges: [], rechargesRecette: { id: 'rec-1' }, demandeDocument: null },
      { id: 'p-doc', inscriptionFormation: null, recharges: [], rechargesRecette: null, demandeDocument: { id: 'd-1' } },
    ];
    const prisma: any = {
      paiement: { findMany: jest.fn().mockResolvedValue(lignes), count: jest.fn().mockResolvedValue(5) },
    };
    const service = new PaiementsService(prisma, {} as any);

    const resultat = await service.listePaiements({} as any);

    expect(resultat.total).toBe(5);
    expect(resultat.data.map((p: any) => [p.id, p.source])).toEqual([
      ['p-ins', 'INSCRIPTION'],
      ['p-for', 'FORMATION'],
      ['p-res', 'RESTO'],
      ['p-rec', 'RECETTE'],
      ['p-doc', 'DOCUMENT'],
    ]);
    expect(resultat.data[1].inscriptionFormation).toEqual({ id: 'if-1', numero: 'F-1' });
    for (const p of resultat.data) {
      expect(p).not.toHaveProperty('recharges');
      expect(p).not.toHaveProperty('rechargesRecette');
      expect(p).not.toHaveProperty('demandeDocument');
    }
    // La sélection riche de la formation l'emporte sur celle du calcul de source.
    expect(prisma.paiement.findMany.mock.calls[0][0].include.inscriptionFormation.select)
      .toMatchObject({ numero: true, formationId: true, statut: true });
  });
});
