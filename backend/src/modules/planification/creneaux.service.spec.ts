import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/decorators';
import { CreneauxController } from './planification.controller';
import { ROLES_KEY } from '../../common/decorators';
import { CreneauxService } from './creneaux.service';

describe('Périmètre des créneaux', () => {
  const enseignant = { id: 'u-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;
  const chef = { id: 'u-chef', role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' } as AuthUser;
  const controleur = { id: 'u-controlleur', role: Role.CONTROLEUR, departementId: 'dept-2' } as AuthUser;
  const etudiant = { id: 'u-etudiant', role: Role.ETUDIANT, etudiantId: 'etudiant-1' } as AuthUser;
  const prepare = () => {
    const db: any = {
      creneau: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      affectation: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((operation: any) => operation(db)),
    };
    return { db, service: new CreneauxService(db) };
  };

  it('force le professeur connecté même si une autre identité est demandée', async () => {
    const { db, service } = prepare();
    await service.liste({ enseignantId: 'prof-2' } as any, enseignant);
    expect(db.creneau.findMany.mock.calls[0][0].where.affectation.enseignantId).toBe('prof-1');
    expect(db.creneau.count.mock.calls[0][0].where.affectation.enseignantId).toBe('prof-1');
  });

  it('borne l’emploi du temps à une semaine et limite le nombre de créneaux lus', async () => {
    const { db, service } = prepare();
    const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

    await service.emploiDuTemps({ semaineDu: '2026-10-07' } as any, admin);

    const args = db.creneau.findMany.mock.calls[0][0];
    expect(args.take).toBe(2000);
    expect(args.where.AND).toEqual(expect.arrayContaining([
      { OR: [{ dateDebut: null }, { dateDebut: { lte: new Date('2026-10-11T00:00:00.000Z') } }] },
      { OR: [{ dateFin: null }, { dateFin: { gte: new Date('2026-10-05T00:00:00.000Z') } }] },
    ]));
  });

  it('limite le chef au département du créneau dans la liste', async () => {
    const { db, service } = prepare();
    await service.liste({} as any, chef);
    expect(db.creneau.findMany.mock.calls[0][0].where.affectation.enseignant.departementId).toBe('dept-1');
  });

  it('limite le contrôleur à son département dans la liste et l’accès direct', async () => {
    const { db, service } = prepare();
    await service.liste({ promotionId: 'promo-1' } as any, controleur);
    expect(db.creneau.findMany.mock.calls[0][0].where.affectation.enseignant.departementId).toBe('dept-2');
    expect(db.creneau.findMany.mock.calls[0][0].where.affectation.promotionId).toBe('promo-1');

    db.creneau.findFirst.mockResolvedValue(null);
    await expect(service.findOne('c-2', controleur)).rejects.toThrow(NotFoundException);
    expect(db.creneau.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'c-2', affectation: { enseignant: { departementId: 'dept-2' } } },
    }));
  });

  it('limite la liste étudiante à sa promotion validée de l’année active et projette les seuls champs d’affichage', async () => {
    const { db, service } = prepare();
    await service.liste({ anneeId: 'annee-demandee', promotionId: 'promo-demandee' } as any, etudiant);
    const requete = db.creneau.findMany.mock.calls[0][0];
    expect(requete.where.affectation).toEqual({
      anneeId: 'annee-demandee',
      promotionId: 'promo-demandee',
      annee: { active: true, cloturee: false },
      promotion: {
        inscriptions: {
          some: {
            etudiantId: 'etudiant-1',
            statut: 'VALIDEE',
            annee: { active: true, cloturee: false },
          },
        },
      },
    });
    expect(requete.include.affectation.select.enseignant.select).toEqual({ id: true, nom: true, prenom: true });
    expect(requete.include.affectation.select.matiere.select).toEqual({ id: true, code: true, intitule: true });
    expect(db.creneau.count.mock.calls[0][0].where).toEqual(requete.where);
  });

  it('permet aux étudiants de lire les créneaux mais leur interdit toutes les mutations', () => {
    const rolesLecture = Reflect.getMetadata(ROLES_KEY, CreneauxController);
    expect(rolesLecture).toContain(Role.ETUDIANT);
    expect(Reflect.getMetadata(ROLES_KEY, CreneauxController.prototype.create)).not.toContain(Role.ETUDIANT);
    expect(Reflect.getMetadata(ROLES_KEY, CreneauxController.prototype.update)).not.toContain(Role.ETUDIANT);
    expect(Reflect.getMetadata(ROLES_KEY, CreneauxController.prototype.remove)).not.toContain(Role.ETUDIANT);
  });

  it('masque un créneau hors périmètre lorsqu’il est demandé directement', async () => {
    const { db, service } = prepare();
    db.creneau.findFirst.mockResolvedValue(null);
    await expect(service.findOne('c-1', enseignant)).rejects.toThrow(NotFoundException);
    expect(db.creneau.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c-1', affectation: { enseignantId: 'prof-1' } },
    }));
  });

  it('refuse le détail direct sans session au lieu de lire sans filtre', async () => {
    const { db, service } = prepare();
    await expect(service.findOne('c-1')).rejects.toThrow(UnauthorizedException);
    expect(db.creneau.findFirst).not.toHaveBeenCalled();
    expect(db.creneau.findUnique).not.toHaveBeenCalled();
  });

  it('retourne un périmètre vide à un chef sans département', async () => {
    const { db, service } = prepare();
    await service.liste({} as any, { ...chef, departementId: null });
    expect(db.creneau.findMany.mock.calls[0][0].where.affectation.enseignant.departementId).toBe('__aucun_departement__');
  });

  it('refuse la création avec une affectation d’un autre département', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Affectation introuvable' } as never);
    const { db, service } = prepare();
    await expect(service.creer({
      affectationId: 'aff-dept-2', jourSemaine: 1, heureDebut: '08:00', heureFin: '10:00',
    } as any, chef)).rejects.toThrow(BadRequestException);
    expect(db.affectation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enseignant: { departementId: 'dept-1' } }),
    }));
    expect(db.creneau.create).not.toHaveBeenCalled();
  });

  it('refuse la modification et la suppression d’un créneau d’un autre département', async () => {
    const { db, service } = prepare();
    await expect(service.modifier('cr-dept-2', { heureDebut: '09:00' } as any, chef))
      .rejects.toThrow(NotFoundException);
    await expect(service.remove('cr-dept-2', chef)).rejects.toThrow(NotFoundException);
    expect(db.creneau.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ affectation: { enseignant: { departementId: 'dept-1' } } }),
    }));
    expect(db.creneau.update).not.toHaveBeenCalled();
    expect(db.creneau.delete).not.toHaveBeenCalled();
  });
});

describe('Validation des collisions de créneaux', () => {
  afterEach(() => jest.restoreAllMocks());

  const dtoBase = {
    affectationId: 'aff-1',
    jourSemaine: 1,
    heureDebut: '08:00',
    heureFin: '10:00',
    salleId: 'salle-1',
  };
  const baseExistante = {
    id: 'cr-1',
    ...dtoBase,
    dateDebut: new Date('2026-08-10T00:00:00Z'),
    dateFin: new Date('2026-08-31T00:00:00Z'),
    affectation: { id: 'aff-1', anneeId: 'annee-1' },
  };
  const creneauConcurrent = {
    id: 'cr-2',
    affectationId: 'aff-2',
    jourSemaine: 1,
    heureDebut: '08:00',
    heureFin: '10:00',
    salleId: 'salle-1',
    dateDebut: new Date('2026-08-01T00:00:00Z'),
    dateFin: new Date('2026-08-05T00:00:00Z'),
  };

  function preparerCollision() {
    const prisma: any = {
      creneau: {
        findMany: jest.fn().mockResolvedValue([creneauConcurrent]),
        findUnique: jest.fn().mockResolvedValue(baseExistante),
        findFirst: jest.fn().mockResolvedValue(baseExistante),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      affectation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'aff-1', anneeId: 'annee-1', enseignantId: 'ens-1', promotionId: 'promo-1', annee: { cloturee: false } }),
        findFirst: jest.fn().mockResolvedValue({ id: 'aff-1', anneeId: 'annee-1', enseignantId: 'ens-1', promotionId: 'promo-1', annee: { cloturee: false } }),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((operation: any) => operation(prisma)),
    };
    return { prisma, service: new CreneauxService(prisma) };
  }

  it('refuse la suppression d’une borne de période qui rend le créneau concurrent', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Conflit de créneau' } as never);
    const { service, prisma } = preparerCollision();

    await expect(service.modifier('cr-1', { dateDebut: null } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creneau.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.creneau.update).not.toHaveBeenCalled();
  });

  it('refuse aussi de supprimer la borne de fin si cela crée une collision future', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Conflit de créneau' } as never);
    const { service, prisma } = preparerCollision();
    prisma.creneau.findMany.mockResolvedValue([{
      ...creneauConcurrent,
      dateDebut: new Date('2026-09-01T00:00:00Z'),
      dateFin: new Date('2026-09-30T00:00:00Z'),
    }]);

    await expect(service.modifier('cr-1', { dateFin: null } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creneau.update).not.toHaveBeenCalled();
  });

  it('permet deux créneaux aux mêmes heures si leurs périodes ne se chevauchent pas', async () => {
    const { service, prisma } = preparerCollision();
    prisma.creneau.findMany.mockResolvedValue([{
      ...creneauConcurrent,
      dateDebut: new Date('2026-09-01T00:00:00Z'),
      dateFin: new Date('2026-09-30T00:00:00Z'),
    }]);
    prisma.creneau.findUnique
      .mockResolvedValueOnce(baseExistante)
      .mockResolvedValueOnce(baseExistante);
    prisma.creneau.update.mockResolvedValue({ id: 'cr-1' });

    await expect(service.modifier('cr-1', {
      dateDebut: '2026-08-10',
      dateFin: '2026-08-31',
    } as any)).resolves.toEqual({ id: 'cr-1' });
    expect(prisma.creneau.findMany).toHaveBeenCalledTimes(1);
  });

  it('refuse une heure de fin partielle qui précède le début déjà enregistré', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Heures incohérentes' } as never);
    const { service, prisma } = preparerCollision();

    await expect(service.modifier('cr-1', { heureFin: '07:00' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creneau.update).not.toHaveBeenCalled();
    expect(prisma.creneau.findMany).not.toHaveBeenCalled();
  });

  it('refuse une borne de fin partielle antérieure à la date de début enregistrée', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Période incohérente' } as never);
    const { service, prisma } = preparerCollision();

    await expect(service.modifier('cr-1', { dateFin: '2026-08-01' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creneau.update).not.toHaveBeenCalled();
    expect(prisma.creneau.findMany).not.toHaveBeenCalled();
  });
});
