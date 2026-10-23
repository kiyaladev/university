import { StatutAttributionLogement } from '@prisma/client';
import { AttributionsService } from './cites.service';

describe('Cycle d’attribution de logement', () => {
  const utilisateur = { id: 'gestion-1' } as any;

  function preparer({ cloturee = false } = {}) {
    const avant = {
      id: 'attrib-1',
      anneeId: 'annee-1',
      chambreId: 'chambre-1',
      etudiantId: 'etudiant-1',
      statut: StatutAttributionLogement.EN_ATTENTE,
      critereScore: 8,
      accordeeLe: null,
      accorderParId: null,
      retireeLe: null,
      retireeMotif: null,
      chambre: { code: 'A-01' },
    };
    const apres = {
      ...avant,
      statut: StatutAttributionLogement.ACCORDEE,
      accordeeLe: new Date(),
      accorderParId: utilisateur.id,
    };
    const tx = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee }) },
      attributionLogement: {
        findUnique: jest.fn().mockResolvedValueOnce(avant).mockResolvedValueOnce(apres),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      chambre: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
      auditLog: { create: jest.fn() },
    };
    return { service: new AttributionsService(prisma as any), prisma, tx, avant, apres };
  }

  it('refuse une décision rattachée à une année clôturée', async () => {
    const { service, tx } = preparer({ cloturee: true });

    await expect(
      service.decider('attrib-1', { statut: StatutAttributionLogement.ACCORDEE } as any, utilisateur),
    ).rejects.toThrow();

    expect(tx.attributionLogement.updateMany).not.toHaveBeenCalled();
    expect(tx.chambre.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('journalise la décision dans la transaction avec les états avant et après', async () => {
    const { service, prisma, tx } = preparer();

    await service.decider(
      'attrib-1',
      {
        statut: StatutAttributionLogement.ACCORDEE,
        commentaire: 'Dossier prioritaire',
      } as any,
      utilisateur,
    );

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details).toMatchObject({
      commentaire: 'Dossier prioritaire',
      avant: { statut: StatutAttributionLogement.EN_ATTENTE, anneeId: 'annee-1' },
      apres: { statut: StatutAttributionLogement.ACCORDEE, anneeId: 'annee-1' },
    });
  });

  it('refuse une autre chambre déjà accordée à la décision, sans écrire ni journaliser', async () => {
    const { service, tx } = preparer();
    tx.attributionLogement.findFirst.mockResolvedValue({ id: 'autre-attribution' } as never);
    await expect(
      service.decider('attrib-1', { statut: StatutAttributionLogement.ACCORDEE }, utilisateur),
    ).rejects.toThrow();
    expect(tx.attributionLogement.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 'attrib-1' },
        statut: StatutAttributionLogement.ACCORDEE,
        OR: [{ etudiantId: 'etudiant-1', anneeId: 'annee-1' }, { chambreId: 'chambre-1' }],
      },
    });
    expect(tx.attributionLogement.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse de loger un étudiant dans une chambre mise en maintenance après sa demande', async () => {
    const { service, tx, avant } = preparer();
    (avant.chambre as any).statut = 'MAINTENANCE';
    await expect(
      service.decider('attrib-1', { statut: StatutAttributionLogement.ACCORDEE }, utilisateur),
    ).rejects.toThrow();
    expect(tx.attributionLogement.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
