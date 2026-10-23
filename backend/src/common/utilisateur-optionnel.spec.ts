import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from './guards';
import { AuthUser, Public } from './decorators';
import { AuthentificationOptionnelle, UtilisateurOptionnel } from './utilisateur-optionnel';

class Vitrine {
  @Public()
  @AuthentificationOptionnelle()
  liste(@UtilisateurOptionnel() utilisateur?: AuthUser) {
    return utilisateur;
  }
}

class VitrineSimple {
  @Public()
  liste() {
    return null;
  }
}

function context(handler: any = Vitrine.prototype.liste, classe: any = Vitrine): ExecutionContext {
  const request: any = { method: 'GET', url: '/api/documents', headers: {}, query: {} };
  return {
    getHandler: () => handler,
    getClass: () => classe,
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('authentification optionnelle', () => {
  const garde = new JwtAuthGuard(new Reflector());
  const parent = Object.getPrototypeOf(JwtAuthGuard.prototype);

  afterEach(() => jest.restoreAllMocks());

  it('garde la route publique et résout l’utilisateur quand le jeton est valide', async () => {
    const ctx = context();
    const request = ctx.switchToHttp().getRequest();
    request.headers.authorization = 'Bearer jeton-valide';
    const utilisateur = { id: 'u1', role: Role.ADMIN };
    jest.spyOn(parent, 'canActivate').mockImplementation(async () => {
      request.user = utilisateur;
      return true;
    });

    await expect(garde.canActivate(ctx)).resolves.toBe(true);
    expect(request.utilisateurOptionnel).toBe(utilisateur);
    // La route reste publique : `request.user` n’est pas rempli.
    expect(request.user).toBeUndefined();
  });

  it('laisse la route passer sans utilisateur si le jeton est invalide', async () => {
    const ctx = context();
    jest.spyOn(parent, 'canActivate').mockRejectedValue(new Error('expired'));

    await expect(garde.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().utilisateurOptionnel).toBeUndefined();
  });

  it('accepte le jeton passé en paramètre d’URL', async () => {
    const ctx = context();
    const request = ctx.switchToHttp().getRequest();
    request.query.token = 'jeton-en-url';
    jest.spyOn(parent, 'canActivate').mockImplementation(async () => {
      request.user = { id: 'u2' };
      return true;
    });

    await garde.canActivate(ctx);
    expect(request.headers.authorization).toBe('Bearer jeton-en-url');
    expect(request.utilisateurOptionnel).toEqual({ id: 'u2' });
  });

  it('ne touche pas aux routes publiques sans authentification optionnelle', async () => {
    const ctx = context(VitrineSimple.prototype.liste, VitrineSimple);
    const passport = jest.spyOn(parent, 'canActivate');
    expect(await garde.canActivate(ctx)).toBe(true);
    expect(passport).not.toHaveBeenCalled();
    expect(ctx.switchToHttp().getRequest().utilisateurOptionnel).toBeUndefined();
  });

  it('le paramètre de handler renvoie l’utilisateur résolu, sinon undefined', () => {
    const request: any = { utilisateurOptionnel: { id: 'u3', nom: 'Awa' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
    const argumentsRoute: any = Reflect.getMetadata('__routeArguments__', Vitrine, 'liste');
    expect(argumentsRoute).toBeDefined();
    const parametre = Object.values(argumentsRoute).find((entree: any) => entree.index === 0) as any;
    expect(parametre).toBeDefined();
    expect(parametre.factory(undefined, ctx)).toEqual({ id: 'u3', nom: 'Awa' });

    request.utilisateurOptionnel = undefined;
    expect(parametre.factory(undefined, ctx)).toBeUndefined();
  });

  it('expose le décorateur de route', () => {
    expect(Reflect.getMetadata('utilisateurOptionnel', Vitrine.prototype.liste)).toBe(true);
  });
});
