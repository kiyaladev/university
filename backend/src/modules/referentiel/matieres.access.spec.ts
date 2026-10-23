import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MatieresService } from './matieres';

describe('lecture d’une matière par un chef de département', () => {
  const findFirst = jest.fn();
  const service = new MatieresService({ matiere: { findFirst } } as any);

  beforeEach(() => jest.clearAllMocks());

  it('borne la lecture par département dans la requête Prisma', async () => {
    const matiere = { id: 'matiere-1', departementId: 'dept-1' };
    findFirst.mockResolvedValue(matiere);

    await expect(
      service.trouverPerimetre('matiere-1', {
        id: 'chef-1',
        role: Role.CHEF_DEPARTEMENT,
        departementId: 'dept-1',
      } as any),
    ).resolves.toEqual(matiere);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'matiere-1', departementId: 'dept-1' },
      include: { departement: true },
    });
  });

  it('masque une matière hors département comme une matière absente', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.trouverPerimetre('matiere-2', {
        id: 'chef-1',
        role: Role.CHEF_DEPARTEMENT,
        departementId: 'dept-1',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'matiere-2', departementId: 'dept-1' },
      }),
    );
  });
});
