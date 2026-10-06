import { DepartementsService } from './structure';

describe('Annuaire public des départements', () => {
  it('ne publie que les champs de présentation, sans effectifs', async () => {
    const prisma: any = {
      departement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new DepartementsService(prisma);

    await service.listePublique();

    expect(prisma.departement.findMany).toHaveBeenCalledWith({
      select: { id: true, code: true, nom: true, faculte: true },
      orderBy: { nom: 'asc' },
    });
  });
});
