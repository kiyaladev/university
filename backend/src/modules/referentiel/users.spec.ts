import { UsersService } from './users';

describe('projection des comptes utilisateurs', () => {
  const secret = {
    id: 'user-1',
    email: 'admin@example.test',
    password: '$2a$hash',
    role: 'ADMIN',
    nom: 'Diallo',
    prenom: 'Awa',
    telephone: '+224600000000',
    actif: true,
    departementId: null,
    tentativesEchouees: 9,
    verrouilleJusqua: new Date(),
    motDePasseModifieLe: new Date(),
  };

  const selection = {
    id: true,
    email: true,
    nom: true,
    prenom: true,
    telephone: true,
    role: true,
    actif: true,
    departementId: true,
  };

  it('limite la lecture par identifiant aux champs de profil et exclut tous les secrets', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(secret),
      },
    };
    const service = new UsersService(prisma);

    await expect(service.findOne('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'admin@example.test',
      role: 'ADMIN',
      nom: 'Diallo',
      prenom: 'Awa',
      telephone: '+224600000000',
      actif: true,
      departementId: null,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: selection });
  });

  it('projette aussi la liste sans exposer les compteurs de verrouillage', async () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([secret]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new UsersService(prisma);

    const resultat = await service.list({} as any);

    expect(resultat.data).toEqual([
      {
        id: 'user-1',
        email: 'admin@example.test',
        role: 'ADMIN',
        nom: 'Diallo',
        prenom: 'Awa',
        telephone: '+224600000000',
        actif: true,
        departementId: null,
      },
    ]);
    expect(prisma.user.findMany.mock.calls[0][0].select).toEqual(selection);
  });

  it('révoque les sessions existantes lors d’une réinitialisation admin du mot de passe', async () => {
    const tx: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(secret),
        update: jest.fn(({ data }: any) => Promise.resolve({ ...secret, ...data })),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new UsersService(prisma);

    const resultat = await service.modifier('user-1', { password: 'Nouveau@2026' } as any);

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        select: { ...selection, password: true },
        data: expect.objectContaining({
          password: expect.any(String),
          motDePasseModifieLe: expect.any(Date),
          tentativesEchouees: 0,
          verrouilleJusqua: null,
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(resultat).toEqual({
      id: 'user-1',
      email: 'admin@example.test',
      role: 'ADMIN',
      nom: 'Diallo',
      prenom: 'Awa',
      telephone: '+224600000000',
      actif: true,
      departementId: null,
    });
    const details = tx.auditLog.create.mock.calls[0][0].data.details;
    expect(details).toContain('motDePasse');
    for (const secretValue of ['$2a$hash', '+224600000000', 'admin@example.test', 'Nouveau@2026']) {
      expect(details).not.toContain(secretValue);
    }
  });
});
