/**
 * Droits d'accès aux routes du hub de formations.
 *
 * La vitrine et le dépôt d'une demande sont publics : c'est une formation
 * continue, ouverte à des personnes sans compte. La gestion du catalogue et
 * du registre est confiée aux trois rôles qui l'exercent au quotidien.
 */
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/decorators';
import { FormationsController } from './formations.controller';

const proto = FormationsController.prototype as any;
const roles = (methode: string) => Reflect.getMetadata(ROLES_KEY, proto[methode]);
const estPublic = (methode: string) => Reflect.getMetadata(IS_PUBLIC_KEY, proto[methode]) === true;

const GESTIONNAIRES = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

describe('FormationsController — droits par rôle', () => {
  it('ouvre la vitrine et le dépôt d’une demande à tous', () => {
    expect(estPublic('publiques')).toBe(true);
    expect(estPublic('publique')).toBe(true);
    expect(estPublic('inscrire')).toBe(true);
    expect(roles('publiques')).toBeUndefined();
    expect(roles('inscrire')).toBeUndefined();
  });

  it.each([
    'liste',
    'dashboard',
    'creer',
    'modifier',
    'supprimer',
    'publier',
    'cloturer',
    'inscriptions',
    'confirmer',
    'annuler',
  ])('confie %s aux gestionnaires du hub', (methode) => {
    expect(roles(methode)).toEqual(GESTIONNAIRES);
  });

  it('n’expose pas le certificat A4 à l’étudiant', () => {
    expect(roles('certificat')).toEqual([Role.ADMIN, Role.SCOLARITE, Role.DIRECTION]);
    expect(roles('certificat')).not.toContain(Role.ETUDIANT);
  });
});
