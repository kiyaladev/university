import { ROLES_KEY } from '../../common/decorators';
import { FraisController } from './inscription.controller';
import { FraisService } from './frais.service';
import { Role } from '@prisma/client';

/**
 * Grille de gestion des tarifs : l'administration et la scolarité voient
 * l'année et la promotion de chaque tarif, ce que la lecture publique ne
 * montre pas.
 */
describe('grille de gestion des tarifs d’inscription', () => {
  it('renvoie le tarif avec son année et sa promotion', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'frais-1',
        anneeId: 'annee-1',
        promotionId: 'promotion-1',
        montant: 120,
        devise: 'GNF',
        annee: { id: 'annee-1', libelle: '2025-2026' },
        promotion: { id: 'promotion-1', nom: 'Licence 1 A', niveau: 'L1' },
      },
    ]);
    const count = jest.fn().mockResolvedValue(1);
    const service = new FraisService({ frais: { findMany, count } } as any);

    await expect(
      service.tarifsGestion({ page: 1, pageSize: 10 } as any, { anneeId: 'annee-1' }),
    ).resolves.toMatchObject({ total: 1, page: 1, pageSize: 10 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ annee: { cloturee: false } }, { anneeId: 'annee-1' }] },
        select: expect.objectContaining({
          id: true,
          anneeId: true,
          promotionId: true,
          montant: true,
          devise: true,
          annee: { select: { id: true, libelle: true } },
          promotion: { select: { id: true, nom: true, niveau: true } },
        }),
      }),
    );
  });

  it('est réservée à l’administration et à la scolarité', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, FraisController.prototype.listeGestion);
    expect(roles).toEqual([Role.ADMIN, Role.SCOLARITE]);
  });
});
