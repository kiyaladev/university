import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, AuthUser } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/**
 * L'enseignant consulte, il n'écrit pas. C'est la règle qui fait tenir le
 * registre devant une contestation : nul ne peut consigner sa propre présence
 * ni corriger son propre relevé. Toute écriture lui est donc fermée, à la
 * seule exception de son mot de passe, qui n'est pas une donnée du registre,
 * et de ses encadrements : faire avancer un stage/mémoire qu'il encadre
 * (validation, démarrage, abandon) est son métier, pas une écriture comptable.
 */
const ECRITURES_TOLEREES = [
  '/auth/mot-de-passe',
  // Module stages : l'enseignant fait vivre ses encadrements. Chaque route
  // de ce préfixe vérifie elle-même, en service, que le travail lui appartient.
  '/api/travaux-encadres',
  // Helpdesk campus : déclarer un ticket (POST /api/tickets) est le geste même
  // qu'on attend de l'enseignant devant une panne. Les autres routes du module
  // restent fermées par les rôles (changement de statut, gestion du parc).
  '/api/tickets',
];

@Injectable()
export class LectureSeuleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requete = context.switchToHttp().getRequest();
    const user = requete.user as AuthUser | undefined;

    if (!user || user.role !== Role.ENSEIGNANT) return true;
    if (['GET', 'HEAD', 'OPTIONS'].includes(requete.method)) return true;
    if (ECRITURES_TOLEREES.some((chemin) => String(requete.url).includes(chemin))) return true;

    throw new ForbiddenException(
      'Votre compte est en consultation seule : le contrôleur consigne les séances, ' +
        'la scolarité gère les moyens d’attestation et les justificatifs.',
    );
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("Votre rôle ne permet pas d'effectuer cette action");
    }
    return true;
  }
}
