import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, AuthUser, DOCUMENT_ACCESS_KEY } from './decorators';
import { t } from './i18n';
import { UTILISATEUR_OPTIONNEL_KEY } from './utilisateur-optionnel';
import { jetonImprimable } from './jeton-imprimable';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const handler = context.getHandler();
    if (this.reflector.get<boolean>(DOCUMENT_ACCESS_KEY, handler)) {
      const request = context.switchToHttp().getRequest();
      this.reporterJetonEnUrl(request);
      // Passport vérifie aussi le compte actif et les sessions révoquées.
      return super.canActivate(context);
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, context.getClass()]);
    if (isPublic) {
      if (this.reflector.get<boolean>(UTILISATEUR_OPTIONNEL_KEY, handler)) {
        return this.authentifierOptionnellement(context);
      }
      return true;
    }
    return super.canActivate(context);
  }

  /**
   * Authentification « au mieux » : la route reste publique, mais un jeton
   * valide donne l'utilisateur. Celui-ci est rangé dans
   * `request.utilisateurOptionnel` et **pas** dans `request.user` : les gardes
   * suivantes (lecture seule du registre enseignant, limitation de débit par
   * compte) doivent voir exactement ce qu'elles voyaient avant sur une route
   * publique. Un jeton absent, invalide ou expiré ne fait jamais échouer la
   * requête.
   */
  private async authentifierOptionnellement(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    this.reporterJetonEnUrl(request);
    const utilisateurPrecedent = request.user;
    try {
      await super.canActivate(context);
      request.utilisateurOptionnel = request.user;
    } catch {
      request.utilisateurOptionnel = undefined;
    } finally {
      request.user = utilisateurPrecedent;
    }
    return true;
  }

  /**
   * Les documents ouverts dans un nouvel onglet ne peuvent pas porter d'en-tête
   * `Authorization` : le jeton passe alors en paramètre d'URL. On le recopie
   * dans l'en-tête pour que Passport — qui ne lit que l'en-tête — le contrôle
   * comme les autres routes. Un en-tête déjà présent n'est jamais écrasé.
   */
  private reporterJetonEnUrl(request: { headers: Record<string, unknown>; query?: unknown }) {
    if (request.headers.authorization) return;
    const jeton = jetonImprimable(request as never);
    if (jeton) request.headers.authorization = `Bearer ${jeton}`;
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
