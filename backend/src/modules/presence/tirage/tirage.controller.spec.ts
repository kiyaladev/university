/**
 * Droits d'accès aux routes de tirage des épreuves.
 *
 * Le circuit d'impression et de distribution des sujets est réservé à
 * l'administration et à la scolarité : c'est un circuit physique, pas une
 * consultation. Ces tests fixent ce périmètre, et notamment l'absence de la
 * direction, qui n'a pas à être dans le circuit d'impression.
 */
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators';
import { TirageController } from './tirage.controller';

const roles = (methode: string) => Reflect.getMetadata(ROLES_KEY, (TirageController.prototype as any)[methode]);

describe('TirageController — droits par rôle', () => {
  it.each(['liste', 'detail', 'creer', 'imprimer', 'mettreSousPli', 'distribuer', 'recuperer', 'annuler'])(
    'réserve %s à l’administration et à la scolarité',
    (methode) => {
      expect(roles(methode)).toEqual([Role.ADMIN, Role.SCOLARITE]);
      expect(roles(methode)).not.toContain(Role.DIRECTION);
    },
  );
});
