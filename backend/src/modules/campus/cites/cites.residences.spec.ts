import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttributionsController, ChambresController, ResidencesController } from './cites.controller';
import { ResidenceQueryDto } from './cites.dto';
import { AttributionsService, ChambresService, ResidencesService } from './cites.service';

/** Service CRUD minimal : seules les lectures du delegate sont observées. */
function preparer(modele: 'residence' | 'chambre' | 'attributionLogement') {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma: any = { [modele]: { findMany, count } };
  const service =
    modele === 'residence'
      ? new ResidencesService(prisma)
      : modele === 'chambre'
        ? new ChambresService(prisma)
        : new AttributionsService(prisma);
  return { prisma, findMany, count, service };
}

async function valider(dto: object): Promise<string[]> {
  const instance = plainToInstance(ResidenceQueryDto, dto, { enableImplicitConversion: true });
  const erreurs = await validate(instance);
  return erreurs.map((erreur) => erreur.property);
}

describe('filtres de la liste des résidences', () => {
  it('traduit « actif=false » en false, et non en true', async () => {
    // Sans transformateur, la conversion implicite de class-transformer
    // applique Boolean('false') et le filtre demandé deviendrait son contraire.
    const dto = plainToInstance(ResidenceQueryDto, { actif: 'false' }, { enableImplicitConversion: true });
    expect(await validate(dto)).toEqual([]);
    expect(dto.actif).toBe(false);
  });

  it('accepte les autres écritures du booléen', async () => {
    for (const [brut, attendu] of [
      ['true', true],
      ['1', true],
      ['oui', true],
      ['0', false],
      ['non', false],
    ] as const) {
      const dto = plainToInstance(ResidenceQueryDto, { actif: brut }, { enableImplicitConversion: true });
      expect(await validate(dto)).toEqual([]);
      expect(dto.actif).toBe(attendu);
    }
  });

  it("refuse une valeur qui n'est pas un booléen", async () => {
    expect(await valider({ actif: 'peut-être' })).toEqual(['actif']);
  });

  it('applique le filtre de ville, insensible à la casse', async () => {
    const { service, findMany, count } = preparer('residence');

    await service.lister({ ville: 'conakry' } as any);

    const attendu = { ville: { contains: 'conakry', mode: 'insensitive' } };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: attendu }));
    expect(count).toHaveBeenCalledWith({ where: attendu });
  });

  it("applique le filtre d'état actif", async () => {
    const { service, findMany } = preparer('residence');

    await service.lister({ actif: false } as any);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { actif: false } }));
  });

  it('cumule ville et état', async () => {
    const { service, findMany } = preparer('residence');

    await service.lister({ ville: 'Kindia', actif: true } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ville: { contains: 'Kindia', mode: 'insensitive' }, actif: true } }),
    );
  });

  it("ne filtre rien quand l'écran n'a rien demandé", async () => {
    const { service, findMany } = preparer('residence');

    await service.lister({} as any);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('laisse la recherche textuelle au service CRUD', async () => {
    const { service, findMany } = preparer('residence');

    await service.lister({ search: 'Cité', ville: 'Kindia' } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ville: { contains: 'Kindia', mode: 'insensitive' },
          OR: [
            { code: { contains: 'Cité', mode: 'insensitive' } },
            { nom: { contains: 'Cité', mode: 'insensitive' } },
            { ville: { contains: 'Cité', mode: 'insensitive' } },
            { responsable: { contains: 'Cité', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('transmet bien la requête du contrôleur au service', async () => {
    const { prisma } = preparer('residence');
    const service = new ResidencesService(prisma);
    const lister = jest.spyOn(service, 'lister');
    const controller = new ResidencesController(service);

    await controller.lister({ ville: 'Kindia', actif: false } as any);

    expect(lister).toHaveBeenCalledWith({ ville: 'Kindia', actif: false });
  });
});

describe('filtres des chambres et des attributions', () => {
  it('applique les filtres déclarés par ChambreQueryDto', async () => {
    const { prisma, findMany } = preparer('chambre');
    const controller = new ChambresController(new ChambresService(prisma));

    await controller.lister({ residenceId: 'residence-1', statut: 'LIBRE', categorie: 'CHAMBRE_SOLO' } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { residenceId: 'residence-1', statut: 'LIBRE', categorie: 'CHAMBRE_SOLO' },
      }),
    );
  });

  it('applique les filtres déclarés par AttributionQueryDto', async () => {
    const { prisma, findMany } = preparer('attributionLogement');
    const controller = new AttributionsController(new AttributionsService(prisma));

    await controller.lister({ residenceId: 'residence-1', statut: 'EN_ATTENTE' } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { statut: 'EN_ATTENTE', chambre: { residenceId: 'residence-1' } },
      }),
    );
  });
});
