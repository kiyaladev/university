import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { t } from '../../../common/i18n';
import { SERVICES, ServicesActifsService } from './services-actifs.service';

@Injectable()
export class ServicesActifsGuard implements CanActivate {
  constructor(
    private readonly service: ServicesActifsService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const controller = this.reflector.get<string>(PATH_METADATA, context.getClass()) || '';
    const handler = this.reflector.get<string>(PATH_METADATA, context.getHandler()) || '';
    const path = `${controller}/${handler}`.replace(/^\/+/, '');
    // Longest prefix first: portail/resto must precede the required portail.
    const match = SERVICES.flatMap((s) => s.prefixes.map((prefix) => ({ id: s.id, prefix })))
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((s) => path === s.prefix || path.startsWith(s.prefix + '/'));
    if (match && !(await this.service.actif(match.id))) throw new NotFoundException(t('common.serviceUnavailable'));
    return true;
  }
}
