/**
 * Droits d'accès aux routes des badges d'accès.
 *
 * L'émission et l'annulation d'un badge sont des actes de scolarité ; la
 * vérification publique, elle, est ouverte à tous : le vigile scanne, il ne
 * se connecte pas. C'est le jeton porté par le QR qui fait foi.
 */
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../../common/decorators';
import { BadgesController } from './badges.controller';

const roles = (methode: string) => Reflect.getMetadata(ROLES_KEY, (BadgesController.prototype as any)[methode]);
const estPublic = (methode: string) =>
  Reflect.getMetadata(IS_PUBLIC_KEY, (BadgesController.prototype as any)[methode]) === true;

describe('BadgesController — droits par rôle', () => {
  it.each(['lister', 'trouver', 'creer', 'modifier', 'annuler', 'rallonger'])(
    'confie %s à l’administration et à la scolarité',
    (methode) => {
      expect(roles(methode)).toEqual([Role.ADMIN, Role.SCOLARITE]);
    },
  );

  it('laisse la vérification publique ouverte à tous', () => {
    expect(estPublic('verifier')).toBe(true);
    expect(roles('verifier')).toBeUndefined();
  });
});
