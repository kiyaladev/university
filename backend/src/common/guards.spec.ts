import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { JwtAuthGuard, LectureSeuleGuard, RolesGuard } from './guards';
import { ProtectedDocument, Public, Roles } from './decorators';

class Documents {
  @ProtectedDocument(Role.ADMIN) imprimer() {}
  @Public() verifier() {}
  @Roles(Role.ADMIN) registre() {}
}

function context(method = 'POST', url = '/api/controles', handler = Documents.prototype.registre): ExecutionContext {
  const request = { method, url, headers: {}, query: {}, user: { role: Role.ENSEIGNANT } };
  return { getHandler: () => handler, getClass: () => Documents, switchToHttp: () => ({ getRequest: () => request }) } as any;
}

describe('Lecture seule du registre enseignant', () => {
  const guard = new LectureSeuleGuard();
  it.each(['/api/elections/vote', '/api/auth/mot-de-passe', '/api/tickets', '/api/travaux-encadres/id/transition'])('autorise l’acte personnel POST %s', url => {
    expect(guard.canActivate(context('POST', url))).toBe(true);
  });
  it.each([
    ['POST', '/api/controles?redirect=/api/tickets'],
    ['PUT', '/api/elections/vote'],
    ['POST', '/api/elections/vote/ouvrir'],
    ['DELETE', '/api/travaux-encadres/id'],
    ['POST', '/api/tickets/id/statut'],
  ])('refuse le contournement %s %s', (method, url) => {
    expect(() => guard.canActivate(context(method, url))).toThrow(ForbiddenException);
  });
});

describe('Documents authentifiés', () => {
  it('fait vérifier le jeton d’URL par Passport', () => {
    const ctx = context('GET', '/api/documents/id/imprimer', Documents.prototype.imprimer);
    const request = ctx.switchToHttp().getRequest();
    request.query.token = 'signed-token';
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const passport = jest.spyOn(parent, 'canActivate').mockReturnValue(true);
    try {
      expect(new JwtAuthGuard(new Reflector()).canActivate(ctx)).toBe(true);
      expect(request.headers.authorization).toBe('Bearer signed-token');
      expect(passport).toHaveBeenCalledWith(ctx);
    } finally { passport.mockRestore(); }
  });
  it('refuse le rôle enseignant sur une impression administrative', () => {
    expect(() => new RolesGuard(new Reflector()).canActivate(context('GET', '/', Documents.prototype.imprimer)))
      .toThrow(ForbiddenException);
  });
  it('garde les vérifications QR publiques', () => {
    const ctx = context('GET', '/', Documents.prototype.verifier);
    delete ctx.switchToHttp().getRequest().user;
    expect(new JwtAuthGuard(new Reflector()).canActivate(ctx)).toBe(true);
    expect(new RolesGuard(new Reflector()).canActivate(ctx)).toBe(true);
  });
});
