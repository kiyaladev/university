import { BadRequestException } from '@nestjs/common';
import { SeancesService } from './seances.service';

const entree = {
  idClient: '1823eb77-ef8d-479d-9143-50e98620f821',
  affectationId: '4b4950ac-fda3-47c0-a0fd-a84619e94b06',
  date: '2026-10-02',
  heureDebut: '08:00',
  heureFin: '10:00',
  type: 'CM',
  salleId: '35a0fd27-534c-45e5-8f12-f8e28a98f6f6',
  thematique: 'Cours de test',
};

function preparer() {
  const prisma: any = {
    affectation: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: entree.affectationId, anneeId: 'annee-1', annee: { cloturee: false } }),
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: entree.affectationId, anneeId: 'annee-1', annee: { cloturee: false } }),
    },
    seance: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, statut: 'PLANIFIE' })),
    },
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((operation: any) => operation(prisma)),
  };
  return { prisma, service: new SeancesService(prisma) };
}

describe('Synchronisation idempotente des séances hors ligne', () => {
  it('crée une séance en conservant la référence produite sur le téléphone', async () => {
    const { prisma, service } = preparer();
    const resultat = await service.synchroniser({ seances: [entree] } as any);

    expect(resultat).toMatchObject({ recus: 1, synchronisees: 1, echecs: [] });
    expect(prisma.seance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: entree.idClient, affectationId: entree.affectationId }),
      }),
    );
    expect(prisma.seance.create.mock.calls[0][0].data).not.toHaveProperty('idClient');
  });

  it('reconnaît un rejeu et ne crée pas deux séances', async () => {
    const { prisma, service } = preparer();
    const premiere = await service.synchroniser({ seances: [entree] } as any);
    const creee = await prisma.seance.create.mock.results[0].value;
    prisma.seance.findUnique.mockResolvedValue({
      ...creee,
      date: new Date('2026-10-02T00:00:00.000Z'),
    });

    const seconde = await service.synchroniser({ seances: [entree] } as any);
    expect(premiere.synchronisees).toBe(1);
    expect(seconde.resultats[0]).toMatchObject({ ok: true, id: entree.idClient, dejaCreee: true });
    expect(prisma.seance.create).toHaveBeenCalledTimes(1);
  });

  it('renvoie un conflit si une référence existante porte un autre contenu', async () => {
    const { prisma, service } = preparer();
    prisma.seance.findUnique.mockResolvedValue({
      id: entree.idClient,
      affectationId: 'autre-affectation',
      date: new Date('2026-10-02T00:00:00.000Z'),
      heureDebut: entree.heureDebut,
      heureFin: entree.heureFin,
      type: entree.type,
      salleId: entree.salleId,
      thematique: entree.thematique,
    });

    const resultat = await service.synchroniser({ seances: [entree] } as any);
    expect(resultat.synchronisees).toBe(0);
    expect(resultat.echecs[0].idClient).toBe(entree.idClient);
    expect(prisma.seance.create).not.toHaveBeenCalled();
  });

  it('isole les erreurs par entrée et laisse les autres séances se synchroniser', async () => {
    const { prisma, service } = preparer();
    prisma.affectation.findFirst
      .mockResolvedValueOnce({ id: entree.affectationId, anneeId: 'annee-1', annee: { cloturee: false } })
      .mockRejectedValueOnce(new BadRequestException('affectation invalide'));
    const autre = { ...entree, idClient: '94c958b8-ad04-4821-b7bd-3654840e56d9' };

    const resultat = await service.synchroniser({ seances: [entree, autre] } as any);
    expect(resultat).toMatchObject({ recus: 2, synchronisees: 1 });
    expect(resultat.echecs).toHaveLength(1);
    expect(resultat.echecs[0].idClient).toBe(autre.idClient);
  });

  it('refuse une séance nouvelle dans une année clôturée', async () => {
    const { prisma, service } = preparer();
    prisma.affectation.findFirst.mockResolvedValue({
      id: entree.affectationId,
      anneeId: 'annee-close',
      annee: { cloturee: true },
    });

    const resultat = await service.synchroniser({ seances: [entree] } as any);
    expect(resultat.synchronisees).toBe(0);
    expect(resultat.echecs[0].erreur).toContain('clôturée');
    expect(prisma.seance.create).not.toHaveBeenCalled();
  });
});
