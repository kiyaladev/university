import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AFFECTATION_INCLUDE, AffectationsService } from './affectations';

describe('périmètre et projection des affectations', () => {
  const service = new AffectationsService({} as any);

  it.each([
    [Role.CHEF_DEPARTEMENT, 'dept-1'],
    [Role.CONTROLEUR, 'dept-2'],
  ])('limite %s à son département', (role, departementId) => {
    expect(service.where({ departementId: 'autre' } as any, { role, departementId } as any))
      .toEqual({ enseignant: { departementId } });
  });

  it('limite un enseignant à ses propres affectations', () => {
    expect(service.where({ enseignantId: 'autre' } as any, {
      role: Role.ENSEIGNANT, enseignantId: 'ens-1',
  } as any)).toEqual({ enseignantId: 'ens-1' });
  });

  it.each([Role.ENSEIGNANT, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR])(
    'conserve les filtres d’année, promotion et matière pour %s', (role) => {
      const user = {
        role,
        enseignantId: 'ens-1',
        departementId: 'dept-1',
      };
      const where = service.where({ anneeId: 'annee-1', promotionId: 'promo-1', matiereId: 'matiere-1' } as any, user as any);

      expect(where).toMatchObject({ anneeId: 'annee-1', promotionId: 'promo-1', matiereId: 'matiere-1' });
      if (role === Role.ENSEIGNANT) expect(where.enseignantId).toBe('ens-1');
      else expect((where as any).enseignant).toEqual({ departementId: 'dept-1' });
    },
  );

  it('applique la recherche sans retirer le périmètre enseignant', () => {
    expect(service.where({ search: 'algèbre' } as any, { role: Role.CONTROLEUR, departementId: 'dept-1' } as any))
      .toEqual({
        OR: [
          { matiere: { intitule: { contains: 'algèbre', mode: 'insensitive' } } },
          { enseignant: { nom: { contains: 'algèbre', mode: 'insensitive' } } },
          { promotion: { nom: { contains: 'algèbre', mode: 'insensitive' } } },
        ],
        enseignant: { departementId: 'dept-1' },
      });
  });

  it.each([
    [Role.CONTROLEUR, 'dept-1'],
    [Role.CHEF_DEPARTEMENT, undefined],
  ])('masque une affectation hors périmètre direct pour %s', async (role, departementId) => {
    const prisma = { affectation: { findUnique: jest.fn().mockResolvedValue({
      id: 'aff-1', enseignantId: 'ens-1', enseignant: { departementId: 'dept-2' },
    }) } } as any;
    const scoped = new AffectationsService(prisma);

    await expect(scoped.trouverPerimetre('aff-1', { role, departementId } as any))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('renvoie 404 quand un enseignant consulte une affectation d’un collègue', async () => {
    const prisma = { affectation: { findUnique: jest.fn().mockResolvedValue({
      id: 'aff-1', enseignantId: 'ens-2', enseignant: { departementId: 'dept-1' },
    }) } } as any;
    const scoped = new AffectationsService(prisma);

    await expect(scoped.trouverPerimetre('aff-1', { role: Role.ENSEIGNANT, enseignantId: 'ens-1' } as any))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('ne charge aucune donnée de contact, de paie ou biométrique du personnel', () => {
    const projection = AFFECTATION_INCLUDE.enseignant.select;
    expect(projection).toEqual(expect.objectContaining({
      id: true, matricule: true, nom: true, prenom: true, departementId: true,
    }));
    for (const champ of ['email', 'telephone', 'tauxHoraire', 'userId', 'empreinteDoigt', 'empreinteConsentementPar']) {
      expect(projection).not.toHaveProperty(champ);
    }
  });
});
