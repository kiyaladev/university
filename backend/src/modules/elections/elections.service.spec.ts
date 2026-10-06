import { NotFoundException } from '@nestjs/common';
import { Role, StatutElection } from '@prisma/client';
import type { AuthUser } from '../../common/decorators';
import { ElectionsService } from './elections.service';

describe('Périmètre de lecture des élections', () => {
  const enseignant = { id: 'prof-user', role: Role.ENSEIGNANT } as AuthUser;
  let prisma: any;
  let service: ElectionsService;

  beforeEach(() => {
    prisma = {
      election: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
      candidatElection: { findMany: jest.fn().mockResolvedValue([]) },
      voteElection: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new ElectionsService(prisma, {} as any, {} as any);
  });

  it('force les non-gestionnaires à ne lister que les scrutins proclamés', async () => {
    await service.liste({ statut: StatutElection.BROUILLON } as any, enseignant);
    expect(prisma.election.findMany.mock.calls[0][0].where.statut).toBe(StatutElection.PROCLAMEE);
    expect(prisma.election.count.mock.calls[0][0].where.statut).toBe(StatutElection.PROCLAMEE);
    expect(prisma.election.findMany.mock.calls[0][0].include.candidats.select).toEqual({
      id: true, nom: true, prenom: true, photoUrl: true, programme: true, ordre: true,
    });
    expect(prisma.election.findMany.mock.calls[0][0].take).toBe(50);
  });

  it('conserve les relations complètes des candidats pour les gestionnaires', async () => {
    await service.liste({} as any, { id: 'admin', role: Role.ADMIN } as AuthUser);
    expect(prisma.election.findMany.mock.calls[0][0].include.candidats.include).toEqual({
      etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
      enseignant: { select: { id: true, matricule: true, nom: true, prenom: true } },
    });
  });

  it('masque le détail d’un brouillon à un électeur', async () => {
    prisma.election.findFirst.mockResolvedValue(null);
    await expect(service.trouverPour('e-1', enseignant)).rejects.toThrow(NotFoundException);
    expect(prisma.election.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({
      id: 'e-1',
      OR: expect.arrayContaining([
        { statut: StatutElection.PROCLAMEE },
        expect.objectContaining({ statut: StatutElection.OUVERTE }),
      ]),
    }));
  });

  it('autorise le détail d’un scrutin ouvert uniquement pendant sa fenêtre', async () => {
    const maintenant = new Date();
    prisma.election.findFirst.mockResolvedValue({
      id: 'e-1', statut: StatutElection.OUVERTE,
      dateOuverture: new Date(maintenant.getTime() - 60_000),
      dateCloture: new Date(maintenant.getTime() + 60_000),
    });
    await expect(service.trouverPour('e-1', enseignant)).resolves.toMatchObject({ id: 'e-1' });
    expect(prisma.election.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({
      id: 'e-1',
      OR: expect.arrayContaining([
        expect.objectContaining({
          statut: StatutElection.OUVERTE,
          dateOuverture: { lte: expect.any(Date) },
          dateCloture: { gt: expect.any(Date) },
        }),
      ]),
    }));
    expect(prisma.election.findFirst.mock.calls[0][0].include.candidats.select).toEqual({
      id: true, nom: true, prenom: true, photoUrl: true, programme: true, ordre: true,
    });
    expect(prisma.election.findFirst.mock.calls[0][0].include._count.select).toEqual({ candidats: true });
    expect(prisma.election.findFirst.mock.calls[0][0].include._count.select).not.toHaveProperty('votes');
  });

  it('ne sélectionne que les données publiques des candidats dans les scrutins actifs', async () => {
    await service.actives();
    expect(prisma.election.findMany.mock.calls[0][0].include.candidats.select).toEqual({
      id: true, nom: true, prenom: true, photoUrl: true, programme: true, ordre: true,
    });
    expect(prisma.election.findMany.mock.calls[0][0].take).toBe(1000);
  });

  it('masque les résultats et le scrutin avant clôture avec le même 404 qu’un id absent', async () => {
    prisma.election.findUnique.mockResolvedValueOnce(null);
    await expect(service.resultats('absent')).rejects.toThrow(NotFoundException);

    prisma.election.findUnique.mockResolvedValueOnce({ id: 'e-1', statut: StatutElection.OUVERTE });
    await expect(service.resultats('e-1')).rejects.toThrow(NotFoundException);
    expect(prisma.election.findUnique).toHaveBeenCalledWith({
      where: { id: 'e-1' },
      select: {
        id: true, titre: true, type: true, nbSieges: true, statut: true,
        dateOuverture: true, dateCloture: true,
      },
    });
    expect(prisma.voteElection.groupBy).not.toHaveBeenCalled();
    expect(prisma.voteElection.count).not.toHaveBeenCalled();
  });

  it('ne charge pas les matricules des candidats dans les résultats', async () => {
    prisma.election.findUnique.mockResolvedValue({
      id: 'e-1', titre: 'Élection', type: 'BDE', nbSieges: 1,
      statut: StatutElection.CLOSE, dateOuverture: new Date(), dateCloture: new Date(),
    });
    prisma.candidatElection.findMany.mockResolvedValue([]);
    prisma.voteElection.groupBy.mockResolvedValue([]);
    await service.resultats('e-1');
    expect(prisma.candidatElection.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      nom: true,
      prenom: true,
      ordre: true,
      _count: { select: { votes: true } },
    });
  });
});

describe('impression du bulletin électoral', () => {
  const gestionnaire = { id: 'admin-user', role: Role.ADMIN } as AuthUser;

  async function serviceAvecEtat(statut: StatutElection) {
    const prisma: any = {
      election: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'e-1', statut, nbSieges: 1, candidats: [],
          dateOuverture: new Date(Date.now() - 60_000), dateCloture: new Date(Date.now() + 60_000),
        }),
      },
    };
    const jwt = { verify: jest.fn().mockResolvedValue({}) };
    const service = new ElectionsService(prisma, {} as any, jwt as any);
    return { service, prisma, jwt };
  }

  it.each([StatutElection.BROUILLON, StatutElection.CLOSE])(
    'refuse le bulletin lorsque le scrutin est %s', async (statut) => {
      const { service, jwt } = await serviceAvecEtat(statut);

      await expect(service.imprimerBulletin('e-1', 'token-valide', 'https://campus.test', gestionnaire))
        .rejects.toThrow(NotFoundException);

      expect(jwt.verify).toHaveBeenCalledWith('token-valide');
    },
  );
});
