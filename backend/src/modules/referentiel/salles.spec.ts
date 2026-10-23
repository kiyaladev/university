import { Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { SallesService } from './salles';

describe('Projection des salles', () => {
  const user = (role: Role) => ({ role }) as AuthUser;
  const salle = {
    id: 'salle-1',
    code: 'S204',
    nom: 'Salle 204',
    batiment: 'A',
    capacite: 30,
    actif: true,
    qrToken: 'secret-qr',
    latitude: 12,
    longitude: 13,
    rayonMetres: 80,
  };

  function preparer() {
    const project = (select?: Record<string, boolean>) =>
      select ? Object.fromEntries(Object.keys(select).map((key) => [key, salle[key as keyof typeof salle]])) : salle;
    const prisma = {
      salle: {
        findMany: jest.fn(({ select }: any = {}) => Promise.resolve([project(select)])),
        findUnique: jest.fn(({ select }: any = {}) => Promise.resolve(project(select))),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    return { service: new SallesService(prisma as any), prisma };
  }

  it('limite la liste des rôles opérationnels aux informations utiles', async () => {
    const { service, prisma } = preparer();
    const result = await service.listePour({ all: '1' } as any, user(Role.CONTROLEUR));
    expect(prisma.salle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, code: true, nom: true, batiment: true, capacite: true, actif: true },
      }),
    );
    expect(prisma.salle.findMany.mock.calls[0][0].select).not.toHaveProperty('qrToken');
    expect(prisma.salle.findMany.mock.calls[0][0].select).not.toHaveProperty('latitude');
    expect(result.data[0]).not.toHaveProperty('qrToken');
    expect(result.data[0]).not.toHaveProperty('latitude');
  });

  it('limite aussi la lecture directe des rôles opérationnels', async () => {
    const { service, prisma } = preparer();
    await service.fichePour('salle-1', user(Role.ENSEIGNANT));
    expect(prisma.salle.findUnique).toHaveBeenCalledWith({
      where: { id: 'salle-1' },
      select: { id: true, code: true, nom: true, batiment: true, capacite: true, actif: true },
    });
  });

  it.each([Role.ADMIN, Role.SCOLARITE])('%s conserve les champs de gestion', async (role) => {
    const { service, prisma } = preparer();
    const result = await service.listePour({ all: '1' } as any, user(role));
    expect(result.data[0]).toHaveProperty('qrToken', 'secret-qr');
    expect(prisma.salle.findMany.mock.calls[0][0]).not.toHaveProperty('select');
  });

  it('autorise le tri API sur les colonnes de salles affichées comme triables', async () => {
    const { service, prisma } = preparer();
    await service.listePour({ sort: 'capacite', order: 'desc' } as any, user(Role.ADMIN));
    expect(prisma.salle.findMany.mock.calls[0][0].orderBy).toEqual({ capacite: 'desc' });
  });

  it('garde la réponse introuvable localisée sans interroger la base deux fois', async () => {
    const { service, prisma } = preparer();
    (prisma.salle.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.fichePour('unknown', user(Role.CONTROLEUR))).rejects.toThrow();
    expect(prisma.salle.findUnique).toHaveBeenCalledTimes(1);
  });
});
