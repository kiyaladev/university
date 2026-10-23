import { NotFoundException } from '@nestjs/common';
import { Role, StatutCourrier, TypeCourrier } from '@prisma/client';
import type { AuthUser } from '../../common/decorators';
import { CourrierService } from './courrier.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Périmètre des courriers', () => {
  const admin = { id: 'admin', role: Role.ADMIN } as AuthUser;
  const scolarite = { id: 'sco', role: Role.SCOLARITE } as AuthUser;
  const chef = { id: 'chef', role: Role.CHEF_DEPARTEMENT } as AuthUser;
  const courrier = {
    id: 'courrier-1',
    numero: 'C-1',
    type: TypeCourrier.ENTRANT,
    statut: StatutCourrier.EN_CIRCUIT,
    enregistreParId: 'auteur',
    circuits: [
      { id: 'etape-sco', courrierId: 'courrier-1', roleValideur: 'Secrétariat', statut: StatutCourrier.EN_CIRCUIT },
    ],
  };
  const prepare = () => {
    const db: any = {
      courrier: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(courrier),
      },
      circuitCourrier: { findUnique: jest.fn().mockResolvedValue(courrier.circuits[0]) },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    return { db, service: new CourrierService(db) };
  };

  it('limite liste et total aux courriers créés ou adressés aux étapes du rôle', async () => {
    const { db, service } = prepare();
    await service.liste({ dateDebut: '2026-01-01' } as any, scolarite);
    const where = db.courrier.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { enregistreParId: 'sco' },
      { circuits: { some: { roleValideur: { in: ['Secrétariat', 'Secrétariat général', 'Scolarité', 'Archives'] } } } },
    ]);
    expect(where.AND).toHaveLength(1);
    expect(db.courrier.count).toHaveBeenCalledWith({ where });
  });

  it('refuse le détail direct à un rôle qui ne figure pas dans le circuit', async () => {
    const { db, service } = prepare();
    await expect(service.trouver(courrier.id, chef)).rejects.toThrow(NotFoundException);
    await expect(service.trouver(courrier.id, scolarite)).resolves.toEqual(courrier);
    expect(db.courrier.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: courrier.id,
        departementId: '__aucun_departement__',
        OR: [
          { enregistreParId: chef.id },
          { circuits: { some: { roleValideur: { in: ['Chef département', 'Chef de département'] } } } },
        ],
      },
      include: expect.any(Object),
    });
  });

  it('inclut un courrier sans date métier sur sa journée entière de création', async () => {
    const { db, service } = prepare();
    await service.liste({ dateDebut: '2026-10-01', dateFin: '2026-10-06' } as any, admin);
    expect(db.courrier.findMany.mock.calls[0][0].where.AND[0].OR).toContainEqual({
      dateReception: null,
      dateEnvoi: null,
      createdAt: { gte: new Date('2026-10-01T00:00:00.000Z'), lt: new Date('2026-10-07T00:00:00.000Z') },
    });
  });

  it('autorise les responsables à consulter tout le courrier', async () => {
    const { service } = prepare();
    await expect(service.trouver(courrier.id, admin)).resolves.toEqual(courrier);
  });

  it('refuse le chef d’un autre département même si le circuit vise son rôle', async () => {
    const { db, service } = prepare();
    const routage = { ...courrier, departementId: 'dep-a', circuits: [{ roleValideur: 'Chef département' }] };
    db.courrier.findFirst.mockResolvedValue(routage);
    await expect(service.trouver(courrier.id, { ...chef, departementId: 'dep-b' })).rejects.toThrow(NotFoundException);
    await expect(service.trouver(courrier.id, { ...chef, departementId: 'dep-a' })).resolves.toEqual(routage);
  });

  it('applique aussi le département à la liste et au compteur du chef', async () => {
    const { db, service } = prepare();
    await service.liste({} as any, { ...chef, departementId: 'dep-a' });
    const where = db.courrier.findMany.mock.calls[0][0].where;
    expect(where.departementId).toBe('dep-a');
    expect(db.courrier.count).toHaveBeenCalledWith({ where });
  });

  it('refuse un chef sans département et la création pour un autre département', async () => {
    const { db, service } = prepare();
    await expect(service.creer({} as any, chef)).rejects.toThrow();
    await expect(
      service.creer({ departementId: 'dep-b' } as any, { ...chef, departementId: 'dep-a' }),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('refuse un paraphe lorsque le rôle ne correspond pas à celui de l’étape', async () => {
    const { db, service } = prepare();
    await expect(service.parapher(courrier.id, 'etape-sco', {}, chef)).rejects.toThrow(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('permet à la scolarité de parapher une étape Secrétariat', async () => {
    const { db, service } = prepare();
    const auditCreate = jest.fn();
    db.$transaction.mockImplementation(async (fn: (tx: any) => unknown) =>
      fn({
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'courrier-1' }]),
        circuitCourrier: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          count: jest.fn().mockResolvedValue(1),
        },
        courrier: { findUnique: jest.fn().mockResolvedValue(courrier) },
        auditLog: { create: auditCreate },
      }),
    );
    db.circuitCourrier.findUnique.mockResolvedValue(courrier.circuits[0]);
    await service.parapher(courrier.id, 'etape-sco', {}, scolarite);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // Le journal est écrit par la transaction qui porte le paraphe.
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
