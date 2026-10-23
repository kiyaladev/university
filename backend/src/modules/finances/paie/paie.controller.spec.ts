/**
 * Droits d'accès aux routes de paie.
 *
 * La feuille de paie manipule de l'argent : les actes qui la font mouvoir
 * (création, validation, paiement, suppression) ne sont pas confiés au même
 * public que la simple lecture. Ces tests fixent ce partage — un garde de
 * rôle qui s'élargit par inadvertance reste invisible sans eux.
 */
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators';
import { PaieController } from './paie.controller';

const roles = (methode: string) => Reflect.getMetadata(ROLES_KEY, (PaieController.prototype as any)[methode]);

describe('PaieController — droits par rôle', () => {
  it('ouvre la lecture des feuilles à la scolarité', () => {
    expect(roles('liste')).toEqual([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE]);
    expect(roles('detail')).toEqual([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE]);
    expect(roles('calculer')).toEqual([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE]);
  });

  it('confie la création d’une feuille à la direction, pas à la scolarité', () => {
    expect(roles('creer')).toEqual([Role.ADMIN, Role.DIRECTION]);
    expect(roles('creer')).not.toContain(Role.SCOLARITE);
  });

  it('confie la validation des montants à la direction', () => {
    expect(roles('valider')).toEqual([Role.ADMIN, Role.DIRECTION]);
    expect(roles('valider')).not.toContain(Role.SCOLARITE);
  });

  it('réserve le paiement et la suppression à l’administration', () => {
    expect(roles('payer')).toEqual([Role.ADMIN]);
    expect(roles('supprimer')).toEqual([Role.ADMIN]);
  });
});
