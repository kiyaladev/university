/** L'enseignant consulte, il n'écrit pas. */
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LectureSeuleGuard } from './guards';
import { AuthUser } from './decorators';

const contexte = (user: Partial<AuthUser> | null, method: string, url = '/api/controles') =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user, method, url }) }),
  }) as any;

const ENSEIGNANT: Partial<AuthUser> = { id: 'u1', role: Role.ENSEIGNANT, enseignantId: 'e1' };
const CONTROLEUR: Partial<AuthUser> = { id: 'u2', role: Role.CONTROLEUR };

describe('LectureSeuleGuard', () => {
  const guard = new LectureSeuleGuard();

  it('laisse un enseignant consulter', () => {
    expect(guard.canActivate(contexte(ENSEIGNANT, 'GET', '/api/seances/mes-seances'))).toBe(true);
  });

  it('empêche un enseignant de consigner un pointage', () => {
    expect(() => guard.canActivate(contexte(ENSEIGNANT, 'POST', '/api/controles'))).toThrow(
      ForbiddenException,
    );
  });

  it('empêche un enseignant de déposer un justificatif', () => {
    expect(() => guard.canActivate(contexte(ENSEIGNANT, 'POST', '/api/justificatifs'))).toThrow(
      ForbiddenException,
    );
  });

  it('empêche un enseignant de définir son propre code personnel', () => {
    expect(() =>
      guard.canActivate(contexte(ENSEIGNANT, 'PUT', '/api/attestation/enseignants/e1/code-pin')),
    ).toThrow(ForbiddenException);
  });

  it('empêche un enseignant de corriger une séance', () => {
    expect(() => guard.canActivate(contexte(ENSEIGNANT, 'PUT', '/api/seances/s1'))).toThrow(
      ForbiddenException,
    );
  });

  it('lui laisse changer son mot de passe : ce n’est pas une donnée du registre', () => {
    expect(guard.canActivate(contexte(ENSEIGNANT, 'POST', '/api/auth/mot-de-passe'))).toBe(true);
  });

  it('lui laisse faire vivre ses encadrements (transition de stages/mémoires)', () => {
    expect(
      guard.canActivate(contexte(ENSEIGNANT, 'POST', '/api/travaux-encadres/t1/transition')),
    ).toBe(true);
  });

  it('reste intraitable sur les autres écritures', () => {
    expect(() =>
      guard.canActivate(contexte(ENSEIGNANT, 'PUT', '/api/salles/s1')),
    ).toThrow(ForbiddenException);
  });

  it('n’entrave pas les autres rôles', () => {
    expect(guard.canActivate(contexte(CONTROLEUR, 'POST', '/api/controles'))).toBe(true);
  });

  it('laisse passer les routes publiques non authentifiées', () => {
    expect(guard.canActivate(contexte(null, 'POST', '/api/auth/login'))).toBe(true);
  });
});
