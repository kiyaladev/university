import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators';
import { ExamensController } from './examens.controller';

describe('Accès au scan d’examen', () => {
  it('réserve le scan aux agents de surveillance et de scolarité', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ExamensController.prototype.scan)).toEqual([
      Role.ADMIN,
      Role.SCOLARITE,
      Role.CONTROLEUR,
      Role.ENSEIGNANT,
    ]);
  });
});
