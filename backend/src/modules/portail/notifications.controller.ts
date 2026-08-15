import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { NotificationsService } from './notifications.service';
import {
  DiffusionNotificationDto,
  DiffusionResultatsDto,
  ListeNotificationsQueryDto,
} from './portail.dto';

const ROLES_DIFFUSION = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE] as const;

@ApiTags('Notifications SMS')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Historique paginé, filtrable par statut et par recherche. */
  @Roles(...ROLES_DIFFUSION)
  @Get()
  lister(@Query() query: ListeNotificationsQueryDto) {
    return this.notifications.lister(query);
  }

  /** Comptage pour le badge éventuel (en file / envoyées / échouées). */
  @Roles(...ROLES_DIFFUSION)
  @Get('stats')
  stats() {
    return this.notifications.stats();
  }

  /** Délibérations validées proposables au sélecteur de diffusion. */
  @Roles(...ROLES_DIFFUSION)
  @Get('deliberations')
  deliberations() {
    return this.notifications.deliberationsDisponibles();
  }

  /**
   * Diffusion manuelle. Le débit est bridé (30 par minute) : chaque envoi
   * part en parallèle et chaque numéro fait l'objet d'une ligne d'historique.
   */
  @Throttle({ courant: { ttl: 60_000, limit: 30 } })
  @Roles(...ROLES_DIFFUSION)
  @Post()
  diffuser(@Body() dto: DiffusionNotificationDto, @CurrentUser() user: AuthUser) {
    return this.notifications.diffuser(dto, user);
  }

  /** Diffusion des résultats d'une délibération validée (ADMIS / AJOURNÉS). */
  @Throttle({ courant: { ttl: 60_000, limit: 10 } })
  @Roles(...ROLES_DIFFUSION)
  @Post('resultats-deliberation')
  diffuserResultats(@Body() dto: DiffusionResultatsDto, @CurrentUser() user: AuthUser) {
    return this.notifications.diffuserResultats(dto, user);
  }
}