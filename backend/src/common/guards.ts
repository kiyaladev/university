import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, AuthUser, DOCUMENT_ACCESS_KEY } from './decorators';
import { t } from './i18n';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.reflector.get<boolean>(DOCUMENT_ACCESS_KEY, context.getHandler())) {
      const request = context.switchToHttp().getRequest();
      if (!request.headers.authorization && typeof request.query?.token === 'string') {
        request.headers.authorization = `Bearer ${request.query.token}`;
      }
      // Passport vérifie aussi le compte actif et les sessions révoquées.
      return super.canActivate(context);
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/**
 * Le registre de présence reste en lecture seule pour l'enseignant.
 * Ses actes métier (encadrements, examen, ressources pédagogiques) et ses
 * démarches personnelles disposent d'exceptions précises par route et méthode.
 * Leurs services vérifient également le propriétaire de la ressource.
 */
const ECRITURES_TOLEREES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/auth\/mot-de-passe\/?$/ },
  { method: 'PUT', path: /^\/api\/travaux-encadres\/[^/]+\/?$/ },
  { method: 'POST', path: /^\/api\/travaux-encadres\/[^/]+\/transition\/?$/ },
  { method: 'POST', path: /^\/api\/tickets\/?$/ },
  // Voter ne permet aucune modification du registre de présence.
  { method: 'POST', path: /^\/api\/elections\/vote\/?$/ },
  { method: 'POST', path: /^\/api\/examens\/scan\/?$/ },
  { method: 'POST', path: /^\/api\/vod\/?$/ },
  { method: 'PUT', path: /^\/api\/vod\/[^/]+\/?$/ },
  { method: 'POST', path: /^\/api\/vod\/[^/]+\/(publier|archiver|vue)\/?$/ },
];

@Injectable()
export class LectureSeuleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requete = context.switchToHttp().getRequest();
    const user = requete.user as AuthUser | undefined;

    if (!user || user.role !== Role.ENSEIGNANT) return true;
    if (['GET', 'HEAD', 'OPTIONS'].includes(requete.method)) return true;
    const chemin = String(requete.originalUrl ?? requete.url).split('?')[0];
    if (ECRITURES_TOLEREES.some((regle) => regle.method === requete.method && regle.path.test(chemin))) return true;

    throw new ForbiddenException(t('common.readOnly.detail'));
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(t('common.roles.notAllowed'));
    }
    return true;
  }
}
