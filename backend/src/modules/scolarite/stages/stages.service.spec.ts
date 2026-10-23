import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../../common/decorators';
import { StagesService, TRAVAIL_INCLUDE } from './stages.service';

describe('Périmètre de lecture des travaux encadrés', () => {
  const db: any = {
    travailEncadre: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    soutenance: { findMany: jest.fn().mockResolvedValue([]) },
    anneeAcademique: { findUnique: jest.fn() },
  };
  const service = new StagesService(db);

  beforeEach(() => jest.clearAllMocks());

  it('refuse la liste aux rôles sans périmètre de consultation', async () => {
    const controleur = { id: 'u-1', role: Role.CONTROLEUR } as AuthUser;
    await expect(service.lister({} as any, controleur)).rejects.toThrow(ForbiddenException);
    expect(db.travailEncadre.findMany).not.toHaveBeenCalled();
  });

  it('limite la liste enseignant aux travaux qu’il encadre', async () => {
    const enseignant = { id: 'u-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;
    await service.lister({} as any, enseignant);
    expect(db.travailEncadre.findMany.mock.calls[0][0].where.encadrantId).toBe('prof-1');
  });

  it('projette les seules identités utiles, sans coordonnées ni champs biométriques', async () => {
    const admin = { id: 'admin', role: Role.ADMIN } as AuthUser;
    await service.lister({} as any, admin);
    const include = db.travailEncadre.findMany.mock.calls[0][0].include;
    expect(include.etudiant.select).toEqual({ id: true, matricule: true, nom: true, prenom: true });
    expect(include.encadrant.select).toEqual({ id: true, nom: true, prenom: true });
  });

  it('applique la projection minimale dans le calendrier des soutenances', async () => {
    await service.calendrier();
    const include = db.soutenance.findMany.mock.calls[0][0].include;
    expect(include.president.select).toEqual({ id: true, nom: true, prenom: true });
    expect(include.travailEncadre.include).toEqual(TRAVAIL_INCLUDE);
  });

  it('filtre le détail étudiant au niveau de la requête avant de charger ses relations', async () => {
    const travail = { id: 'travail-1', etudiantId: 'etudiant-1' };
    db.travailEncadre.findFirst.mockResolvedValue(travail);
    const etudiant = { id: 'user-etu', role: Role.ETUDIANT, etudiantId: 'etudiant-1' } as AuthUser;

    await expect(service.lire('travail-1', etudiant)).resolves.toEqual(travail);
    expect(db.travailEncadre.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'travail-1', etudiantId: 'etudiant-1' },
      }),
    );
  });

  it('retourne le même NotFound pour un dossier tiers et un identifiant inconnu', async () => {
    db.travailEncadre.findFirst.mockResolvedValue(null);
    const etudiant = { id: 'user-etu', role: Role.ETUDIANT, etudiantId: 'etudiant-1' } as AuthUser;

    await expect(service.lire('travail-2', etudiant)).rejects.toThrow(NotFoundException);
    expect(db.travailEncadre.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'travail-2', etudiantId: 'etudiant-1' },
      }),
    );
  });

  it('filtre le détail enseignant sur son encadrement', async () => {
    db.travailEncadre.findFirst.mockResolvedValue({ id: 'travail-1', encadrantId: 'prof-1' });
    const enseignant = { id: 'user-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;

    await service.lire('travail-1', enseignant);
    expect(db.travailEncadre.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'travail-1', encadrantId: 'prof-1' },
      }),
    );
  });
});
