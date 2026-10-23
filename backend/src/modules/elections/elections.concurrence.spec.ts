import { BadRequestException } from '@nestjs/common';
import { Role, StatutElection } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { ElectionsService } from './elections.service';

describe('Élections — état relu sous verrou', () => {
  const user = { id: 'admin', role: Role.ADMIN } as any;
  let tx: any;
  let service: ElectionsService;
  let ordre: string[];
  beforeEach(() => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Refus' } as never);
    ordre = [];
    tx = {
      $queryRaw: jest.fn(async () => {
        ordre.push('verrou');
        return [];
      }),
      election: {
        findUnique: jest.fn(async () => {
          ordre.push('lecture');
          return {
            id: 'e',
            statut: StatutElection.CLOSE,
            candidats: [],
            dateOuverture: new Date(Date.now() - 10000),
            dateCloture: new Date(Date.now() + 10000),
            nbSieges: 1,
          };
        }),
        update: jest.fn(),
      },
      candidatElection: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
      voteElection: { findFirst: jest.fn(), createMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    service = new ElectionsService({ $transaction: (fn: any) => fn(tx) } as any, {} as any, {} as any);
  });
  afterEach(() => jest.restoreAllMocks());
  it('refuse le vote lorsque la clôture a obtenu le verrou en premier', async () => {
    await expect(service.voter({ electionId: 'e', bulletin: [{ candidatId: 'c' }] }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ordre).toEqual(['verrou', 'lecture']);
    expect(tx.voteElection.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['ouvrir', 'clore', 'modifier', 'ajouterCandidat', 'supprimerCandidat'])(
    '%s refuse un état devenu clos',
    async (operation) => {
      const args: any[] =
        operation === 'modifier'
          ? ['e', { titre: 'Titre' }, user]
          : operation === 'ajouterCandidat'
            ? ['e', { nom: 'Nom', prenom: 'Prénom' }, user]
            : operation === 'supprimerCandidat'
              ? ['e', 'c', user]
              : ['e', user];
      await expect((service as any)[operation](...args)).rejects.toBeInstanceOf(BadRequestException);
      expect(ordre).toEqual(['verrou', 'lecture']);
      expect(tx.election.update).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );
  it('refuse une seconde proclamation après la première', async () => {
    tx.election.findUnique.mockResolvedValue({ id: 'e', statut: StatutElection.PROCLAMEE });
    await expect(service.proclamer('e', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.election.update).not.toHaveBeenCalled();
  });
  it('compare les dates fusionnées lors d’une modification partielle', async () => {
    tx.election.findUnique.mockResolvedValue({
      id: 'e',
      statut: StatutElection.BROUILLON,
      dateOuverture: new Date('2026-10-06'),
      dateCloture: new Date('2026-10-08'),
    });
    await expect(service.modifier('e', { dateCloture: '2026-10-05T00:00:00.000Z' }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.election.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
