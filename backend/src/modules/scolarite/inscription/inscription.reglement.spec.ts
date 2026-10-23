import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role, StatutInscription, StatutPaiement } from '@prisma/client';
import { AuthUser } from '../../../common/decorators';
import { InscriptionService } from './inscription.service';
import { PaiementsService } from './paiements.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

const AGENT = { id: 'agent-1', role: Role.SCOLARITE } as AuthUser;

function service(prisma: any) {
  return new InscriptionService(prisma, { nouveauQrResto: () => 'qr' } as any, {} as any);
}

function paiements(prisma: any) {
  return new PaiementsService(prisma, {} as any);
}

describe('Règlement des inscriptions — cumul des paiements', () => {
  function preparer(cumul: number) {
    const paiement = {
      id: 'pay-1',
      statut: StatutPaiement.EN_ATTENTE,
      inscriptionId: 'ins-1',
      anneeId: 'annee-1',
      inscriptionFormation: null,
      recharges: [],
      rechargesRecette: null,
      demandeDocument: null,
      inscription: { anneeId: 'annee-1' },
    };
    const tx: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      paiement: {
        findUnique: jest.fn().mockResolvedValue(paiement),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { montant: cumul } }),
      },
      inscription: {
        findUnique: jest.fn().mockResolvedValue({
          statut: StatutInscription.EN_ATTENTE_PAIEMENT,
          montantFrais: 100,
          anneeId: 'annee-1',
          promotionId: 'promo-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      frais: { findUnique: jest.fn().mockResolvedValue({ devise: 'USD' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = { $transaction: jest.fn((work: any) => work(tx)) };
    return { tx, service: paiements(prisma) };
  }

  it('ne cumule que les paiements de scolarité dans la devise du tarif', async () => {
    const { tx, service } = preparer(100);
    await service.simulerPaiement('pay-1', { statut: 'REUSSI' } as any, AGENT);

    expect(tx.paiement.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inscriptionId: 'ins-1',
          statut: StatutPaiement.REUSSI,
          devise: 'USD',
          demandeDocument: { is: null },
        },
      }),
    );
    expect(tx.inscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statut: StatutInscription.PAYE },
      }),
    );
  });

  it('ne solde pas le dossier quand le cumul retenu reste inférieur aux frais', async () => {
    const { tx, service } = preparer(90);
    await service.simulerPaiement('pay-1', { statut: 'REUSSI' } as any, AGENT);
    expect(tx.inscription.updateMany).not.toHaveBeenCalled();
  });

  it('refuse un paiement de scolarité dans une autre devise que celle du tarif', async () => {
    const tx: any = {
      inscription: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'ins-1', etudiantId: 'etu-1', anneeId: 'annee-1', promotionId: 'promo-1' }),
      },
      frais: { findUnique: jest.fn().mockResolvedValue({ devise: 'USD' }) },
      paiement: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((work: any) => work(tx)) };

    await expect(
      paiements(prisma).creerPaiement(
        { inscriptionId: 'ins-1', montant: 100, devise: 'GNF', mode: 'ESPECES' } as any,
        AGENT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.paiement.create).not.toHaveBeenCalled();
  });
});

describe('Cycle de vie des inscriptions — transitions conditionnelles', () => {
  const dossier = (statut: StatutInscription) => ({
    id: 'ins-1',
    numero: 'INS-2026-00001',
    etudiantId: 'etu-1',
    anneeId: 'annee-1',
    promotionId: 'promo-1',
    statut,
    montantFrais: 100,
  });

  function preparer(statutLu: StatutInscription) {
    const tx: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      // Une transition concurrente a déjà changé le statut : aucune ligne ne correspond.
      inscription: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      inscription: { findUnique: jest.fn().mockResolvedValue(dossier(statutLu)) },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    return { tx, service: service(prisma) };
  }

  it('refuse une validation si le dossier a été annulé entre-temps', async () => {
    const { tx, service } = preparer(StatutInscription.PAYE);
    await expect(service.validerInscription('ins-1', AGENT)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ins-1', statut: StatutInscription.PAYE },
      }),
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse une annulation si le dossier a été validé entre-temps', async () => {
    const { tx, service } = preparer(StatutInscription.PAYE);
    await expect(service.annulerInscription('ins-1', AGENT)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ins-1', statut: StatutInscription.PAYE },
        data: { statut: StatutInscription.ANNULE },
      }),
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('Réinscription après annulation', () => {
  it('rouvre le dossier annulé au lieu de heurter l’unicité (étudiant, année)', async () => {
    const annule = {
      id: 'ins-1',
      numero: 'INS-2026-00001',
      etudiantId: 'etu-1',
      anneeId: 'annee-1',
      promotionId: 'promo-1',
      statut: StatutInscription.ANNULE,
      montantFrais: 100,
    };
    const tx: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      inscription: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(annule)
          .mockResolvedValueOnce({
            ...annule,
            promotionId: 'promo-2',
            statut: StatutInscription.EN_ATTENTE_PAIEMENT,
            montantFrais: 150,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-1', nom: 'Diallo', prenom: 'Awa' }) },
      anneeAcademique: {
        findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2025-2026', cloturee: false }),
      },
      promotion: { findUnique: jest.fn().mockResolvedValue({ id: 'promo-2', anneeId: 'annee-1', nom: 'L2' }) },
      inscription: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'ins-1', numero: annule.numero, statut: StatutInscription.ANNULE }),
      },
      frais: { findUnique: jest.fn().mockResolvedValue({ montant: 150, devise: 'GNF' }) },
      $transaction: jest.fn((work: any) => work(tx)),
    };

    const resultat = await service(prisma).creerInscription(
      { etudiantId: 'etu-1', anneeId: 'annee-1', promotionId: 'promo-2' } as any,
      AGENT,
    );

    expect(tx.inscription.create).not.toHaveBeenCalled();
    expect(tx.inscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'ins-1', statut: StatutInscription.ANNULE },
      data: expect.objectContaining({
        promotionId: 'promo-2',
        statut: StatutInscription.EN_ATTENTE_PAIEMENT,
        montantFrais: 150,
        valideeParId: null,
      }),
    });
    expect(resultat).toMatchObject({ id: 'ins-1', statut: StatutInscription.EN_ATTENTE_PAIEMENT });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('INSCRIPTION_REOUVERTE');
  });
});

describe('Préinscription publique — fiche existante', () => {
  it('ne rattache pas un dossier à une fiche sur la seule connaissance de son e-mail', async () => {
    const tx: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-victime' }), create: jest.fn() },
      inscription: { findUnique: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      anneeAcademique: {
        findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2025-2026', cloturee: false }),
      },
      promotion: { findUnique: jest.fn().mockResolvedValue({ id: 'promo-1', anneeId: 'annee-1', nom: 'L1' }) },
      frais: { findUnique: jest.fn().mockResolvedValue({ montant: 100, devise: 'GNF' }) },
      $transaction: jest.fn((work: any) => work(tx)),
    };

    await expect(
      service(prisma).depotPublic({
        anneeId: 'annee-1',
        promotionId: 'promo-1',
        nom: 'Autre',
        prenom: 'Nom',
        telephone: '+224600000000',
        email: 'victime@example.test',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inscription.create).not.toHaveBeenCalled();
    expect(tx.etudiant.create).not.toHaveBeenCalled();
  });
});
