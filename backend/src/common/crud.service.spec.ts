import { BadRequestException } from '@nestjs/common';
import { CrudService } from './crud.service';

class PrismaFaux {
  findMany = jest.fn().mockResolvedValue([]);
  count = jest.fn().mockResolvedValue(0);
  findUnique = jest.fn();
  create = jest.fn();
  update = jest.fn();
  delete = jest.fn();
}

function service(orderBy?: Record<string, unknown> | Record<string, unknown>[], sortFields?: string[]) {
  const prisma = new PrismaFaux() as any;
  prisma.salle = prisma;
  return new CrudService(prisma, 'salle', { orderBy, sortFields, label: 'Salle' });
}

describe('tri des listes génériques', () => {
  it('borne le mode all à 1 000 lignes et garde la pagination disponible', async () => {
    const s = service({ nom: 'asc' });
    s['delegate'].count.mockResolvedValue(1400);

    const resultat = await s.findAll({ all: '1' });

    expect(s['delegate'].findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 1000,
      }),
    );
    expect(resultat).toMatchObject({ total: 1400, page: 1, pageSize: 1000 });
  });

  it('plafonne aussi pageSize quand le service est appelé hors ValidationPipe', async () => {
    const s = service({ nom: 'asc' });
    await s.findAll({ pageSize: 1_000_000 } as any);
    expect(s['delegate'].findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1000 }));
  });

  it("accepte un champ déclaré dans l'ordre par défaut", async () => {
    const s = service({ nom: 'asc' });
    await s.findAll({ sort: 'nom', order: 'desc' });
    expect(s['delegate'].findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { nom: 'desc' } }));
  });

  it('refuse un champ absent du modèle avec une 400 explicite', async () => {
    // Sans liste blanche, `?sort=bogus` produisait une erreur de validation
    // Prisma, remontée en 500 sans aucun message exploitable.
    const s = service({ nom: 'asc' });
    await expect(s.findAll({ sort: 'inexistant' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('utilise les sortFields explicites quand le service en déclare', async () => {
    const s = service({ nom: 'asc' }, ['nom', 'capacite']);
    await s.findAll({ sort: 'capacite' });
    expect(s['delegate'].findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { capacite: 'asc' } }));
  });

  it('retombe sur le tri par défaut quand aucun tri est demandé', async () => {
    const s = service({ nom: 'asc' });
    await s.findAll({});
    expect(s['delegate'].findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { nom: 'asc' } }));
  });

  it('prend la première clé quand le tri par défaut en donne plusieurs', async () => {
    const s = service([{ date: 'desc' }, { heureDebut: 'asc' }]);
    await s.findAll({ sort: 'date', order: 'desc' });
    expect(s['delegate'].findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { date: 'desc' } }));
    // heureDebut n'est pas exposée : le tri est refusé plutôt que de laisser
    // Prisma renvoyer une erreur de validation.
    return expect(s.findAll({ sort: 'heureDebut' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
