import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, DOCUMENT_SCOPE_KEY, DocumentScopeOptions } from './decorators';
import { t } from './i18n';

@Injectable()
export class DocumentScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.get<DocumentScopeOptions>(DOCUMENT_SCOPE_KEY, context.getHandler());
    if (!scope) return true;
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    const field = scope.fields[user.role];
    if (!field) {
      // Seuls les rôles centraux de gestion peuvent ignorer un propriétaire.
      // Tout autre rôle admis par la route doit avoir un périmètre explicite.
      if (([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE] as Role[]).includes(user.role)) return true;
      throw new NotFoundException(t('common.notFound'));
    }
    const owner =
      field === 'etudiantId'
        ? user.etudiantId
        : field.endsWith('departementId')
          ? user.departementId
          : user.enseignantId;
    if (!owner || typeof request.params.id !== 'string') throw new NotFoundException(t('common.notFound'));
    const delegate = (this.prisma as any)[scope.model];
    if (!delegate || typeof delegate.findFirst !== 'function') throw new NotFoundException(t('common.notFound'));
    // `id` is used by a few profile documents where the resource itself is the
    // owner's identity. Check equality before querying; never let an ownership
    // condition overwrite the route ID in the Prisma `where` object.
    if (field === 'id' && request.params.id !== owner) throw new NotFoundException(t('common.notFound'));
    if (field === 'id') {
      const record = await delegate.findFirst({ where: { id: request.params.id }, select: { id: true } });
      if (!record) throw new NotFoundException(t('common.notFound'));
      return true;
    }
    const condition = field.split('.').reduceRight((value, key) => ({ [key]: value }), owner as any);
    const record = await delegate.findFirst({
      where: { ...condition, id: request.params.id },
      select: { id: true },
    });
    if (!record) throw new NotFoundException(t('common.notFound'));
    return true;
  }
}
