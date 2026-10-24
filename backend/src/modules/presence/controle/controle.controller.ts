import { Body, Controller, Delete, Get, Ip, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { ControleService } from './controle.service';
import { AuditQueryDto, ControleQueryDto, PointageDto, SyncPointagesDto, UpdatePointageDto } from './controle.dto';

const CONTROLEURS = [Role.CONTROLEUR, Role.ADMIN, Role.DIRECTION, Role.CHEF_DEPARTEMENT] as const;

@ApiTags('Contrôle de présence')
@ApiBearerAuth()
@Controller('controles')
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
export class ControleController {
  constructor(private readonly service: ControleService) {}

  @Get() lister(@Query() query: ControleQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.lister(query, user);
  }

  /** Scan du QR affiché dans la salle : renvoie la salle et ses séances du jour. */
  @Roles(...CONTROLEURS, Role.SCOLARITE)
  @Get('salle/:token')
  parQr(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.service.parQrSalle(token, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('audit')
  audit(@Query() query: AuditQueryDto) {
    return this.service.audit(query);
  }

  @Get(':id') lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lire(id, user);
  }

  /**
   * Pointage d'une séance en salle.
   *
   * Un pointage hors ligne renvoyé après une réponse perdue est renvoyé tel
   * quel : c'est le même pointage, la réponse est 200 et non une erreur.
   */
  @Roles(...CONTROLEURS)
  @Post()
  async pointer(
    @Body() dto: PointageDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const dejaConsigne = await this.service.dejaConsigne(dto.seanceId, dto.idClient);
    const controle = await this.service.pointer(dto, user, ip);
    if (dejaConsigne) res.status(200);
    return controle;
  }

  /** Envoi groupé des pointages saisis hors connexion. */
  @Roles(...CONTROLEURS)
  @Post('sync')
  sync(@Body() dto: SyncPointagesDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.service.synchroniser(dto, user, ip);
  }

  @Roles(...CONTROLEURS)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdatePointageDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.service.modifier(id, dto, user, ip);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
