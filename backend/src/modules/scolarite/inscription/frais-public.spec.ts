import { IS_PUBLIC_KEY } from '../../../common/decorators';
import { FraisController } from './inscription.controller';
import { FraisService } from './frais.service';

describe('lecture publique des tarifs d’inscription', () => {
  it('reste publique mais ne renvoie que le tarif et sa devise', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'frais-1', montant: 120, devise: 'GNF' }]);
    const count = jest.fn().mockResolvedValue(1);
    const service = new FraisService({ frais: { findMany, count } } as any);

    await expect(
      service.tarifsPublics({ page: 2, pageSize: 10 } as any, { anneeId: 'annee-1', promotionId: 'promotion-1' }),
    ).resolves.toEqual({
      data: [{ id: 'frais-1', montant: 120, devise: 'GNF' }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { AND: [{ annee: { cloturee: false } }, { anneeId: 'annee-1', promotionId: 'promotion-1' }] },
      select: { id: true, montant: true, devise: true },
      orderBy: [{ anneeId: 'desc' }, { promotionId: 'asc' }],
      skip: 10,
      take: 10,
    });
    expect(count).toHaveBeenCalledWith({
      where: { AND: [{ annee: { cloturee: false } }, { anneeId: 'annee-1', promotionId: 'promotion-1' }] },
    });
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, FraisController.prototype.lister)).toBe(true);
  });

  it('respecte all=true pour le sélecteur de tarif administratif', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'frais-1', montant: 120, devise: 'GNF' }]);
    const count = jest.fn().mockResolvedValue(1);
    const service = new FraisService({ frais: { findMany, count } } as any);

    await expect(service.tarifsPublics({ all: 'true' } as any)).resolves.toMatchObject({
      page: 1,
      pageSize: 1,
    });
    expect(findMany.mock.calls[0][0].skip).toBe(0);
    expect(findMany.mock.calls[0][0].take).toBe(1000);
    expect(findMany.mock.calls[0][0].where).toEqual({ AND: [{ annee: { cloturee: false } }, {}] });
  });
});
