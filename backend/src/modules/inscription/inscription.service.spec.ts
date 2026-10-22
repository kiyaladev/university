import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { INSCRIPTION_INCLUDE, InscriptionService } from './inscription.service';
import { PaiementsService } from './paiements.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

function preparer() {
  const prisma: any = { inscription: {
    findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue({ id: 'ins-2', etudiantId: 'etu-2' }),
    findUnique: jest.fn().mockResolvedValue({ id: 'ins-2', etudiantId: 'etu-2' }),
  } };
  return { prisma, service: new InscriptionService(prisma, {} as any, {} as any) };
}
const etudiant: any = { role: Role.ETUDIANT, etudiantId: 'etu-1' };

describe('Inscriptions — confidentialité du portail étudiant', () => {
  it('impose la fiche du compte, même si un autre étudiant est demandé', async () => {
    const { service, prisma } = preparer();
    await service.listeInscriptions({ etudiantId: 'etu-2', all: '1' }, etudiant);
    expect(prisma.inscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { etudiantId: 'etu-1' } }));
    expect(prisma.inscription.count).toHaveBeenCalledWith({ where: { etudiantId: 'etu-1' } });
  });
  it('refuse le dossier d’un autre étudiant', async () => {
    const { service, prisma } = preparer();
    prisma.inscription.findFirst.mockResolvedValue(null);
    await expect(service.trouverInscription('ins-2', etudiant)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ins-2', etudiantId: 'etu-1' },
    }));
  });
  it('filtre les accès directs du chef par département avant de charger le dossier', async () => {
    const { service, prisma } = preparer();
    prisma.inscription.findFirst.mockResolvedValue(null);
    await expect(service.trouverInscription('ins-2', {
      role: Role.CHEF_DEPARTEMENT, departementId: 'dep-1',
    } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'ins-2',
        promotion: { filiere: { departementId: 'dep-1' } },
      },
    }));
  });
  it('garde la lecture interne nécessaire au traitement administratif', async () => {
    const { service } = preparer();
    await expect(service.trouverInscription('ins-2')).resolves.toMatchObject({ id: 'ins-2' });
  });

  it('ne ré-expose pas téléphone et données donneur via les paiements imbriqués', async () => {
    const { service, prisma } = preparer();
    await service.listeInscriptions({} as any, { role: Role.CHEF_DEPARTEMENT, departementId: 'dep-1' } as any);
    const select = prisma.inscription.findMany.mock.calls[0][0].include.paiements.select;
    expect(select).toEqual(expect.objectContaining({ montant: true, statut: true, reference: true }));
    expect(select).not.toHaveProperty('telephone');
    expect(select).not.toHaveProperty('nomComplet');
    expect(select).not.toHaveProperty('motifAnnulation');
    expect(INSCRIPTION_INCLUDE.paiements).toBe(prisma.inscription.findMany.mock.calls[0][0].include.paiements);
  });
});

describe('Préinscription publique', () => {
  it('refuse les promotions d’une année clôturée', async () => {
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-close', cloturee: true }) },
      promotion: { findMany: jest.fn() },
      frais: { findMany: jest.fn() },
    };
    const service = new InscriptionService(prisma, {} as any, {} as any);

    await expect(service.promotionsOuvertes('annee-close')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.promotion.findMany).not.toHaveBeenCalled();
  });

  it('ne publie que les champs de promotion et le tarif officiel', async () => {
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-open', cloturee: false }) },
      promotion: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'promotion-1', nom: 'L1 Informatique', niveau: 'L1', anneeId: 'annee-open',
          effectif: 300, createdAt: new Date(), filiere: { code: 'INFO', nom: 'Informatique' },
        }]),
      },
      frais: { findMany: jest.fn().mockResolvedValue([{ promotionId: 'promotion-1', montant: 1500000, devise: 'GNF' }]) },
    };
    const service = new InscriptionService(prisma, {} as any, {} as any);

    await expect(service.promotionsOuvertes('annee-open')).resolves.toEqual([{
      id: 'promotion-1', nom: 'L1 Informatique', niveau: 'L1',
      filiere: { code: 'INFO', nom: 'Informatique' },
      frais: { montant: 1500000, devise: 'GNF' },
    }]);
  });
});

describe('Simulation de paiement', () => {
  it('réserve les paiements de formation à leur transition avec contrôle de capacité', async () => {
    const tx: any = {
      paiement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1', statut: 'EN_ATTENTE',
          inscriptionFormation: { id: 'formation-registration-1', formationId: 'formation-1' },
        }),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)) };
    const service = new PaiementsService(prisma, {} as any);

    await expect(service.simulerPaiement('payment-1', { statut: 'REUSSI' } as any, { id: 'agent' } as any))
      .rejects.toBeInstanceOf(ConflictException);

    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
