/**
 * Droits d'accès aux routes du Rectorat.
 *
 * Le Rectorat est un public resserré (administration et direction) : ni la
 * scolarité, ni les enseignants, ni les étudiants n'y ont accès. La
 * régénération du bilan MESRS — qui fige une archive transmise au ministère —
 * reste une prérogative de l'administration seule.
 */
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators';
import { RectoratController } from './rectorat.controller';

const roles = (methode: string) => Reflect.getMetadata(ROLES_KEY, (RectoratController.prototype as any)[methode]);

describe('RectoratController — droits par rôle', () => {
  it.each(['dashboard', 'chiffres', 'bilans'])('restreint %s à l’administration et à la direction', (methode) => {
    expect(roles(methode)).toEqual([Role.ADMIN, Role.DIRECTION]);
  });

  it('réserve la génération du bilan MESRS à l’administration', () => {
    expect(roles('generer')).toEqual([Role.ADMIN]);
    expect(roles('generer')).not.toContain(Role.DIRECTION);
  });
});
