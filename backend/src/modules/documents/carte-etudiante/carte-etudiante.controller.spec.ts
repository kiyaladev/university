/**
 * Droits d'accès aux routes de la carte d'étudiant.
 *
 * Trois régimes cohabitent :
 *
 *   - la vérification publique (QR), ouverte à tous — le contrôleur à la
 *     porte n'a pas de compte ;
 *   - le portail de l'étudiant, réservé à l'étudiant lui-même (sa carte,
 *     son NIP) ;
 *   - la gestion de la carte, confiée à la scolarité.
 *
 * La révocation et la vérification interne du NIP ont des périmètres
 * distincts : la révocation est une décision opposable (administration et
 * direction), la vérification de NIP est un geste professionnel (contrôleur,
 * scolarité) que l'étudiant ne doit pas pouvoir faire sur sa propre carte.
 */
import { Role } from '@prisma/client';
import { DOCUMENT_SCOPE_KEY, IS_PUBLIC_KEY, ROLES_KEY } from '../../../common/decorators';
import { CarteEtudianteController } from './carte-etudiante.controller';

const proto = CarteEtudianteController.prototype as any;
const roles = (methode: string) => Reflect.getMetadata(ROLES_KEY, proto[methode]);
const estPublic = (methode: string) => Reflect.getMetadata(IS_PUBLIC_KEY, proto[methode]) === true;

describe('CarteEtudianteController — droits par rôle', () => {
  it('laisse la vérification publique ouverte à tous', () => {
    expect(estPublic('verifier')).toBe(true);
    expect(roles('verifier')).toBeUndefined();
  });

  it('réserve le portail de l’étudiant à l’étudiant', () => {
    expect(roles('maCarte')).toEqual([Role.ETUDIANT]);
    expect(roles('definirNip')).toEqual([Role.ETUDIANT]);
  });

  it('confie la gestion de la carte à l’administration et à la scolarité', () => {
    expect(roles('liste')).toEqual([Role.ADMIN, Role.SCOLARITE]);
    expect(roles('trouver')).toEqual([Role.ADMIN, Role.SCOLARITE]);
    expect(roles('creer')).toEqual([Role.ADMIN, Role.SCOLARITE]);
    expect(roles('modifier')).toEqual([Role.ADMIN, Role.SCOLARITE]);
  });

  it('réserve la révocation à l’administration et à la direction', () => {
    expect(roles('revoquer')).toEqual([Role.ADMIN, Role.DIRECTION]);
    expect(roles('revoquer')).not.toContain(Role.SCOLARITE);
  });

  it('écarte l’étudiant de la vérification interne du NIP', () => {
    expect(roles('verifierNip')).toEqual([Role.ADMIN, Role.SCOLARITE, Role.CONTROLEUR, Role.DIRECTION]);
    expect(roles('verifierNip')).not.toContain(Role.ETUDIANT);
    expect(roles('verifierNip')).not.toContain(Role.ENSEIGNANT);
  });

  it('borne l’impression de la carte à son propriétaire pour l’étudiant', () => {
    expect(roles('imprimer')).toEqual([Role.ADMIN, Role.SCOLARITE, Role.ETUDIANT]);
    expect(Reflect.getMetadata(DOCUMENT_SCOPE_KEY, proto.imprimer)).toEqual({
      model: 'carteEtudiante',
      fields: { [Role.ETUDIANT]: 'etudiantId' },
    });
  });
});
