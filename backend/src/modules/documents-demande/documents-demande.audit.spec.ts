/**
 * Journal d'audit des demandes de documents — traces avant/après des
 * mutations sensibles (tarifs, encaissements, transitions de cycle).
 *
 * Ce que ces tests verrouillent :
 *  - l'acteur et l'entité sont inscrits, avec l'état avant et après ;
 *  - la mutation et son entrée de journal partagent la transaction ;
 *  - ni coordonnées du demandeur, ni jeton opérateur, ni texte libre
 *    (motif, notification, notes) ne sont recopiés ;
 *  - une mutation refusée n'écrit aucune trace.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role, StatutDemande, StatutPaiement } from '@prisma/client';
import { DocumentsDemandeService } from './documents-demande.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

const ETUDIANT = { id: 'etu-compte-1', etudiantId: 'etu-1', role: Role.ETUDIANT } as any;
const AGENT = { id: 'agent-1', nom: 'Barry', prenom: 'Mamadou', role: Role.SCOLARITE } as any;

const DEMANDE = {
  id: 'dem-1',
  numero: 'DOC-2026-00001',
  type: 'RELEVE_NOTES',
  statut: StatutDemande.EN_ATTENTE_PAIEMENT,
  frais: 25000,
  devise: 'GNF',
  traiteParId: null,
  remiseLe: null,
  notes: null,
  notification: null,
  motif: 'Inscription sur dossier medical',
  etudiantId: 'etu-1',
  etudiant: {
    id: 'etu-1', matricule: '2026-00001', nom: 'Diallo', prenom: 'Aïssatou',
    telephone: '+224622334455', email: 'aissatou.diallo@example.test',
  },
};

/** Client transactionnel minimal : une écriture hors `tx` échoue le test. */
const transaction = (delegats: Record<string, any>, horsTransaction: Record<string, any> = {}) => {
  const tx: any = { ...delegats, auditLog: { create: jest.fn().mockResolvedValue({}) } };
  const prisma: any = { ...horsTransaction, $transaction: jest.fn((operation: any) => operation(tx)) };
  return { tx, prisma, audit: tx.auditLog.create };
};

const lire = (audit: jest.Mock, index = 0) => JSON.parse(audit.mock.calls[index][0].data.details);

describe('Demandes de documents — grille tarifaire', () => {
  it('journalise les montants avant/après avec leur acteur, dans la transaction', async () => {
    const avant = { id: 'tarif-1', type: 'RELEVE_NOTES', montant: 25000, devise: 'GNF', delaiHeures: 72 };
    const apres = { ...avant, montant: 30000 };
    const { tx, prisma, audit } = transaction({
      tarifDemande: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue(apres),
      },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await service.modifierTarif('tarif-1', { montant: 30000 }, AGENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.tarifDemande.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tarif-1' },
      data: { montant: 30000 },
    }));
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0].data).toEqual({
      userId: 'agent-1',
      action: 'TARIF_DEMANDE_MODIFIE',
      entite: 'TarifDemande',
      entiteId: 'tarif-1',
      details: expect.any(String),
    });
    const details = lire(audit);
    expect(details.avant.montant).toBe(25000);
    expect(details.apres.montant).toBe(30000);
    expect(details.champsModifies).toEqual(['montant']);
  });

  it("n'inscrit aucune trace si le tarif à modifier n'existe pas", async () => {
    const { tx, prisma, audit } = transaction({
      tarifDemande: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await expect(service.modifierTarif('tarif-9', { montant: 1 }, AGENT)).rejects.toThrow(NotFoundException);

    expect(tx.tarifDemande.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('trace la création d’un tarif avec un état après vide avant', async () => {
    const tarif = { id: 'tarif-1', type: 'RELEVE_NOTES', montant: 25000, devise: 'GNF', delaiHeures: 72 };
    const { prisma, audit } = transaction({
      tarifDemande: { create: jest.fn().mockResolvedValue(tarif) },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await service.creerTarif({ type: 'RELEVE_NOTES', montant: 25000, delaiHeures: 72 } as any, AGENT);

    const data = audit.mock.calls[0][0].data;
    expect(data.userId).toBe('agent-1');
    expect(data.action).toBe('TARIF_DEMANDE_CREE');
    const details = lire(audit);
    expect(details.avant).toBeNull();
    expect(details.apres).toEqual({
      id: 'tarif-1', type: 'RELEVE_NOTES', montant: 25000, devise: 'GNF', delaiHeures: 72,
    });
  });
});

describe('Demandes de documents — encaissement', () => {
  it('confirme le paiement et bascule la demande dans une seule transaction journalisée', async () => {
    const demandeAvant = { ...DEMANDE, paiementId: 'pay-1' };
    const demandeApres = { ...DEMANDE, statut: StatutDemande.EN_TRAITEMENT, traiteParId: 'agent-1' };
    const paiementAvant = {
      id: 'pay-1', reference: 'PAY-2026-00001', montant: 25000, devise: 'GNF',
      mode: 'ESPECES', statut: StatutPaiement.EN_ATTENTE, telephone: '+224622334455',
      transactionId: 'opérateur-777',
    };
    const paiementApres = { ...paiementAvant, statut: StatutPaiement.REUSSI };
    const { tx, prisma, audit } = transaction({
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue(demandeAvant),
        update: jest.fn().mockResolvedValue(demandeApres),
      },
      paiement: {
        findUnique: jest.fn().mockResolvedValue(paiementAvant),
        update: jest.fn().mockResolvedValue(paiementApres),
      },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await service.confirmerPaiement('dem-1', { paiementId: 'pay-1' }, AGENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.paiement.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pay-1' },
      data: expect.objectContaining({ statut: StatutPaiement.REUSSI }),
    }));
    expect(tx.demandeDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'dem-1' },
      data: { statut: StatutDemande.EN_TRAITEMENT, traiteParId: 'agent-1' },
    }));
    expect(audit).toHaveBeenCalledTimes(1);
    const data = audit.mock.calls[0][0].data;
    expect(data.userId).toBe('agent-1');
    expect(data.action).toBe('DEMANDE_DOC_PAIEMENT_CONFIRME');
    const details = lire(audit);
    expect(details.avant.statut).toBe(StatutDemande.EN_ATTENTE_PAIEMENT);
    expect(details.apres.statut).toBe(StatutDemande.EN_TRAITEMENT);
    expect(details.paiementAvant.statut).toBe(StatutPaiement.EN_ATTENTE);
    expect(details.paiementApres.statut).toBe(StatutPaiement.REUSSI);
    // Ni téléphone du payeur, ni jeton de l'opérateur, ni identité du demandeur.
    expect(data.details).not.toContain('+224');
    expect(data.details).not.toContain('opérateur-777');
    expect(data.details).not.toContain('example.test');
  });

  it("refuse un identifiant de paiement incohérent sans encaisser ni tracer", async () => {
    const { tx, prisma, audit } = transaction({
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, paiementId: 'pay-1' }),
        update: jest.fn(),
      },
      paiement: { findUnique: jest.fn(), update: jest.fn() },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await expect(service.confirmerPaiement('dem-1', { paiementId: 'pay-9' }, AGENT))
      .rejects.toThrow(BadRequestException);

    expect(tx.paiement.update).not.toHaveBeenCalled();
    expect(tx.demandeDocument.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rattache le paiement à la demande dans la transaction qui le crée', async () => {
    const paiement = {
      id: 'pay-1', reference: 'PAY-2026-00001', montant: 25000, devise: 'GNF',
      mode: 'ESPECES', statut: StatutPaiement.EN_ATTENTE, telephone: null, transactionId: null,
    };
    const { tx, prisma, audit } = transaction(
      {
        demandeDocument: {
          findMany: jest.fn().mockResolvedValue([{ reference: 'PAY-2026-00001' }]),
          findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, paiementId: null }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        paiement: {
          create: jest.fn(async ({ data }: any) => ({ ...paiement, id: data.id })),
          findMany: jest.fn().mockResolvedValue([{ reference: 'PAY-2026-00001' }]),
        },
        inscription: { findUnique: jest.fn().mockResolvedValue({ id: 'ins-1', anneeId: 'annee-2026' }) },
      },
      {
        demandeDocument: {
          findFirst: jest.fn().mockResolvedValue({ ...DEMANDE, paiementId: null }),
          findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, paiementId: 'pay-1' }),
          update: jest.fn(),
        },
      },
    );
    const service = new DocumentsDemandeService(prisma as any);
    jest.spyOn(service, 'findOnePour').mockResolvedValue({
      ...DEMANDE, paiementId: null, inscriptionId: 'ins-1',
    } as any);

    await service.payer('dem-1', { mode: 'ESPECES' } as any, ETUDIANT);

    // Le rattachement ne doit pas repartir dans une écriture séparée.
    expect(prisma.demandeDocument.update).not.toHaveBeenCalled();
    expect(tx.demandeDocument.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'dem-1', statut: StatutDemande.EN_ATTENTE_PAIEMENT, paiementId: null },
      data: { paiementId: expect.stringMatching(/^[0-9a-f-]{36}$/i) },
    }));
    expect(tx.paiement.create.mock.calls[0][0].data).toMatchObject({
      inscriptionId: 'ins-1', anneeId: 'annee-2026',
    });
    const details = lire(audit);
    expect(audit.mock.calls[0][0].data.action).toBe('DEMANDE_DOC_PAIEMENT_INITIE');
    expect(details.avant.paiementId).toBeUndefined();
    expect(details.paiement.reference).toBe('PAY-2026-00001');
    expect(details.paiement.statut).toBe(StatutPaiement.EN_ATTENTE);
  });

  it('annule un second paiement si une autre transaction rattache le premier', async () => {
    const paiement = {
      id: 'pay-2', reference: 'PAY-2026-00002', montant: 25000, devise: 'GNF',
      mode: 'ESPECES', statut: StatutPaiement.EN_ATTENTE, telephone: null, transactionId: null,
    };
    const { tx, prisma, audit } = transaction({
      demandeDocument: {
        findMany: jest.fn().mockResolvedValue([{ reference: 'PAY-2026-00001' }]),
        findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, paiementId: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      paiement: {
        create: jest.fn(async ({ data }: any) => ({ ...paiement, id: data.id })),
        findMany: jest.fn().mockResolvedValue([{ reference: 'PAY-2026-00001' }]),
      },
      inscription: { findUnique: jest.fn() },
    }, {
      demandeDocument: { findFirst: jest.fn().mockResolvedValue({ ...DEMANDE, paiementId: null }) },
    });
    const service = new DocumentsDemandeService(prisma as any);
    jest.spyOn(service, 'findOnePour').mockResolvedValue({ ...DEMANDE, paiementId: null } as any);

    await expect(service.payer('dem-1', { mode: 'ESPECES' } as any, ETUDIANT)).rejects.toThrow(ConflictException);
    expect(tx.paiement.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

describe('Demandes de documents — transitions de cycle', () => {
  it('trace l’ouverture de la demande sans son motif ni les coordonnées du demandeur', async () => {
    const { prisma, audit } = transaction({
      demandeDocument: {
        findMany: jest.fn().mockResolvedValue([{ numero: 'DOC-2026-00001' }]),
        create: jest.fn().mockResolvedValue(DEMANDE),
      },
    }, { tarifDemande: { findUnique: jest.fn().mockResolvedValue({ montant: 25000, devise: 'GNF' }) } });
    const service = new DocumentsDemandeService(prisma as any);

    await service.creer({ type: 'RELEVE_NOTES', motif: 'dossier medical' } as any, ETUDIANT);

    const data = audit.mock.calls[0][0].data;
    expect(data.userId).toBe('etu-compte-1');
    expect(data.action).toBe('DEMANDE_DOC_OUVERTE');
    const details = lire(audit);
    expect(details.avant).toBeNull();
    expect(details.apres).toEqual({
      numero: 'DOC-2026-00001',
      type: 'RELEVE_NOTES',
      statut: StatutDemande.EN_ATTENTE_PAIEMENT,
      frais: 25000,
      devise: 'GNF',
      traiteParId: null,
      remiseLe: null,
    });
    expect(data.details).not.toContain('dossier medical');
    expect(data.details).not.toContain('+224');
    expect(data.details).not.toContain('example.test');
    expect(data.details).not.toContain('Aïssatou');
  });

  it('trace la remise au guichet avec sa date et sans la note libre', async () => {
    const { prisma, audit } = transaction({
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.PRETE }),
        update: jest.fn().mockResolvedValue({
          ...DEMANDE, statut: StatutDemande.REMISE, remiseLe: new Date('2026-10-05T08:00:00.000Z'),
        }),
      },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await service.remettre('dem-1', { noteRemise: 'Pièce d’identité vérifiée' } as any, AGENT);

    const data = audit.mock.calls[0][0].data;
    expect(data.action).toBe('DEMANDE_DOC_REMISE');
    const details = lire(audit);
    expect(details.avant.statut).toBe(StatutDemande.PRETE);
    expect(details.apres.statut).toBe(StatutDemande.REMISE);
    expect(details.avant.remiseLe).toBeNull();
    expect(details.apres.remiseLe).toBe('2026-10-05T08:00:00.000Z');
    expect(details.noteRemiseFournie).toBe(true);
    expect(details.champsModifies).toEqual(['statut', 'remiseLe', 'traiteParId', 'notes']);
    expect(data.details).not.toContain('Pièce d’identité vérifiée');
  });

  it('trace le rejet sans recopier le motif', async () => {
    const { prisma, audit } = transaction({
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.PAYEE }),
        update: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.REJETEE }),
      },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await service.rejeter('dem-1', { motif: 'justificatif medical manquant' } as any, AGENT);

    const data = audit.mock.calls[0][0].data;
    expect(data.userId).toBe('agent-1');
    expect(data.action).toBe('DEMANDE_DOC_REJETEE');
    const details = lire(audit);
    expect(details.avant.statut).toBe(StatutDemande.PAYEE);
    expect(details.apres.statut).toBe(StatutDemande.REJETEE);
    expect(details.motifFourni).toBe(true);
    expect(data.details).not.toContain('justificatif medical manquant');
  });

  it('trace le lancement du traitement dans la transaction', async () => {
    const { prisma, audit } = transaction({
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.PAYEE }),
        update: jest.fn().mockResolvedValue({
          ...DEMANDE, statut: StatutDemande.EN_TRAITEMENT, traiteParId: 'agent-1',
        }),
      },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await service.lancerTraitement('dem-1', AGENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const details = lire(audit);
    expect(details.avant.statut).toBe(StatutDemande.PAYEE);
    expect(details.apres.statut).toBe(StatutDemande.EN_TRAITEMENT);
    expect(details.apres.traiteParId).toBe('agent-1');
    expect(details.champsModifies).toEqual(['statut', 'traiteParId']);
  });

  it('trace le marquage PRETE sans le message au demandeur', async () => {
    const { prisma, audit } = transaction(
      {
        // Verrou de ligne pris avant la relecture de la demande.
        $queryRaw: jest.fn().mockResolvedValue([]),
        demandeDocument: {
          findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.PAYEE }),
          update: jest.fn().mockResolvedValue({
            ...DEMANDE, statut: StatutDemande.PRETE, traiteParId: 'agent-1',
            notification: 'Votre relevé est prêt au guichet',
          }),
        },
      },
      {
        demandeDocument: { findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.PAYEE }) },
        etudiant: { findUnique: jest.fn().mockResolvedValue(null) },
      },
    );
    const service = new DocumentsDemandeService(prisma as any);

    await service.marquerPrete('dem-1', { message: 'Votre relevé est prêt au guichet' } as any, AGENT);

    const data = audit.mock.calls[0][0].data;
    expect(data.action).toBe('DEMANDE_DOC_PRETE');
    const details = lire(audit);
    expect(details.avant.statut).toBe(StatutDemande.PAYEE);
    expect(details.apres.statut).toBe(StatutDemande.PRETE);
    expect(details.champsModifies).toEqual(['statut', 'traiteParId', 'notification']);
    expect(data.details).not.toContain('Votre relevé est prêt au guichet');
  });
});

describe('Demandes de documents — corrélation Mobile Money', () => {
  it('lie et journalise la référence opérateur dans une même transaction sans la copier au journal', async () => {
    const paiementAvant = {
      id: 'pay-mm-1', reference: 'PAY-2026-00009', montant: 25000, devise: 'GNF',
      mode: 'MOBILE_MONEY', statut: StatutPaiement.EN_ATTENTE, transactionId: null,
      telephone: '+224622334455',
    };
    const paiementApres = { ...paiementAvant, transactionId: 'provider-secret-transaction' };
    const auditHorsTransaction = { create: jest.fn().mockResolvedValue({}) };
    const { tx, prisma, audit } = transaction({
      paiement: {
        findUnique: jest.fn().mockResolvedValue(paiementAvant),
        update: jest.fn().mockResolvedValue(paiementApres),
      },
    }, { auditLog: auditHorsTransaction });
    const service = new DocumentsDemandeService(prisma as any);
    const urlAvant = process.env.MOBILE_MONEY_URL;
    const fetchAvant = global.fetch;
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transactionId: 'provider-secret-transaction' }),
    }) as any;

    try {
      await (service as any).tenterTransmissionMobileMoney({
        id: paiementAvant.id,
        reference: paiementAvant.reference,
        montant: paiementAvant.montant,
        devise: paiementAvant.devise,
        operateur: 'ORANGE',
        telephone: paiementAvant.telephone,
        motif: 'demande confidentielle',
      }, 'etudiant-compte-1');
    } finally {
      global.fetch = fetchAvant;
      if (urlAvant === undefined) delete process.env.MOBILE_MONEY_URL;
      else process.env.MOBILE_MONEY_URL = urlAvant;
    }

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.paiement.update).toHaveBeenCalledWith({
      where: { id: paiementAvant.id },
      data: { transactionId: 'provider-secret-transaction' },
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0].data).toMatchObject({
      userId: 'etudiant-compte-1',
      action: 'PAIEMENT_TRANSACTION_LIEE',
      entite: 'Paiement',
      entiteId: paiementAvant.id,
    });
    const details = audit.mock.calls[0][0].data.details;
    expect(details).not.toContain('provider-secret-transaction');
    expect(details).not.toContain('+224622334455');
    expect(details).not.toContain('demande confidentielle');
    expect(JSON.parse(details)).toMatchObject({
      avant: { statut: StatutPaiement.EN_ATTENTE },
      apres: { statut: StatutPaiement.EN_ATTENTE },
      champsModifies: ['transactionId'],
    });
  });
});

describe('Demandes de documents — absence de trace sur mutation refusée', () => {
  it('refuse le rejet sans motif avant toute écriture', async () => {
    const { prisma, audit } = transaction({});
    const service = new DocumentsDemandeService(prisma as any);

    await expect(service.rejeter('dem-1', { motif: '   ' } as any, AGENT))
      .rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('refuse le marquage PRETE d’une demande non traitée sans ouvrir de transaction', async () => {
    const { prisma, audit } = transaction({}, {
      demandeDocument: { findUnique: jest.fn().mockResolvedValue({ ...DEMANDE }) },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await expect(service.marquerPrete('dem-1', {}, AGENT)).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('refuse la remise d’une demande non prête : ni écriture ni trace', async () => {
    const { tx, prisma, audit } = transaction({
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue({ ...DEMANDE, statut: StatutDemande.PAYEE }),
        update: jest.fn(),
      },
    });
    const service = new DocumentsDemandeService(prisma as any);

    await expect(service.remettre('dem-1', {}, AGENT)).rejects.toThrow(BadRequestException);

    // La transaction est ouverte puis abandonnée : le refus annule l'ensemble.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.demandeDocument.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

describe('Demandes de documents — erreurs de transmission Mobile Money', () => {
  const fetchAvant = global.fetch;
  const urlAvant = process.env.MOBILE_MONEY_URL;
  const cleAvant = process.env.MOBILE_MONEY_API_KEY;
  const paiement = {
    id: 'pay-mm-echec',
    reference: 'PAY-2026-00010',
    montant: 25000,
    devise: 'GNF',
    operateur: 'ORANGE',
    telephone: '+224622334455',
    motif: 'demande confidentielle',
  };

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = fetchAvant;
    if (urlAvant === undefined) delete process.env.MOBILE_MONEY_URL;
    else process.env.MOBILE_MONEY_URL = urlAvant;
    if (cleAvant === undefined) delete process.env.MOBILE_MONEY_API_KEY;
    else process.env.MOBILE_MONEY_API_KEY = cleAvant;
  });

  it('journalise une tentative et un refus opérateur sans copier de données personnelles', async () => {
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
    const journal = { create: jest.fn().mockResolvedValue({}) };
    const { prisma } = transaction({}, { auditLog: journal });
    const service = new DocumentsDemandeService(prisma as any);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as any;

    await (service as any).tenterTransmissionMobileMoney(paiement, 'etudiant-compte-1');

    expect(journal.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual([
      'PAIEMENT_MOBILE_MONEY_TENTATIVE',
      'PAIEMENT_MOBILE_MONEY_ECHEC',
    ]);
    for (const [appel] of journal.create.mock.calls) {
      expect(appel.data).toMatchObject({ userId: 'etudiant-compte-1', entite: 'Paiement', entiteId: paiement.id });
      expect(appel.data.details).not.toContain(paiement.telephone);
      expect(appel.data.details).not.toContain(paiement.reference);
      expect(appel.data.details).not.toContain(paiement.motif);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('signale un échec de liaison locale après acceptation sans prétendre que l’opérateur a refusé', async () => {
    process.env.MOBILE_MONEY_URL = 'https://operator.example.test';
    const journal = { create: jest.fn().mockResolvedValue({}) };
    const { prisma } = transaction({}, { auditLog: journal });
    prisma.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    const service = new DocumentsDemandeService(prisma as any);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transactionId: 'provider-secret-transaction' }),
    }) as any;

    await (service as any).tenterTransmissionMobileMoney(paiement, 'etudiant-compte-1');

    expect(journal.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual([
      'PAIEMENT_MOBILE_MONEY_TENTATIVE',
      'PAIEMENT_TRANSACTION_LIAISON_ECHEC',
    ]);
    expect(journal.create.mock.calls[1][0].data.details).not.toContain('provider-secret-transaction');
  });
});
