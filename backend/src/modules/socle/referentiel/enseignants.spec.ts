import { Role } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { ENSEIGNANT_LECTURE_MINIMALE, EnseignantsService } from './enseignants.service';

function creerService() {
  const prisma = {
    enseignant: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'enseignant-1', departementId: 'dept-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'enseignant-1', departementId: 'dept-1' }),
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
  return { prisma, service: new EnseignantsService(prisma) };
}

const etudiant = { id: 'etudiant-1', role: Role.ETUDIANT } as any;

describe('projection de l’annuaire enseignant', () => {
  it('limite la liste visible aux étudiants aux données nécessaires', async () => {
    const { prisma, service } = creerService();

    await service.listePour({ all: '1' } as any, etudiant);

    expect(prisma.enseignant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: ENSEIGNANT_LECTURE_MINIMALE }),
    );
    expect(ENSEIGNANT_LECTURE_MINIMALE).not.toHaveProperty('email');
    expect(ENSEIGNANT_LECTURE_MINIMALE).not.toHaveProperty('telephone');
    expect(ENSEIGNANT_LECTURE_MINIMALE).not.toHaveProperty('tauxHoraire');
    expect(ENSEIGNANT_LECTURE_MINIMALE).not.toHaveProperty('user');
  });

  it('applique la même projection à une fiche ouverte par identifiant', async () => {
    const { prisma, service } = creerService();

    await service.detailPour('enseignant-1', etudiant);

    expect(prisma.enseignant.findUnique).toHaveBeenCalledWith({
      where: { id: 'enseignant-1' },
      select: ENSEIGNANT_LECTURE_MINIMALE,
    });
  });

  it('refuse au chef sans département une fiche absente de sa liste', async () => {
    const { prisma, service } = creerService();
    prisma.enseignant.findFirst.mockResolvedValue(null);

    await expect(
      service.detailPour('enseignant-1', {
        id: 'chef-1',
        role: Role.CHEF_DEPARTEMENT,
        departementId: null,
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.enseignant.findFirst).toHaveBeenCalledWith({
      where: { id: 'enseignant-1', departementId: '__aucun__' },
      select: ENSEIGNANT_LECTURE_MINIMALE,
    });
  });

  it('filtre la fiche du chef sur son département avant la lecture', async () => {
    const { prisma, service } = creerService();

    await service.detailPour('enseignant-1', {
      id: 'chef-1',
      role: Role.CHEF_DEPARTEMENT,
      departementId: 'dept-1',
    } as any);

    expect(prisma.enseignant.findFirst).toHaveBeenCalledWith({
      where: { id: 'enseignant-1', departementId: 'dept-1' },
      select: ENSEIGNANT_LECTURE_MINIMALE,
    });
  });
});
