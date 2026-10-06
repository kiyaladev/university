import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators';
import { DepartementsController, FilieresController, PromotionsController } from './structure';

describe('lecture des référentiels de structure', () => {
  it.each([DepartementsController, FilieresController, PromotionsController])(
    'réserve les listes et détails de %s aux rôles internes',
    (controller) => {
      for (const method of ['findAll', 'findOne']) {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.prototype[method]);
        expect(roles).toEqual(expect.arrayContaining([
          Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT,
          Role.CONTROLEUR, Role.ENSEIGNANT,
        ]));
        expect(roles).not.toContain(Role.ETUDIANT);
      }
    },
  );
});
