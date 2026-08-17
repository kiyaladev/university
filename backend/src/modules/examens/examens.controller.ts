import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  CreateExamenDto,
  ExamenQueryDto,
  ScanExamenDto,
  UpdateExamenStatutDto,
} from './examens.dto';
import { ExamensService } from './examens.service';

@ApiTags('Examens')
@ApiBearerAuth()
@Controller('examens')
export class ExamensController {
  constructor(private readonly service: ExamensService) {}

  @Get()
  liste(@Query() query: ExamenQueryDto) {
    return this.service.liste(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Get(':id/scans')
  scans(@Param('id') id: string) {
    return this.service.listeScans(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.service.stats(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateExamenDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id/statut')
  changerStatut(
    @Param('id') id: string,
    @Body() dto: UpdateExamenStatutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changerStatut(id, dto.statut, user);
  }

  /**
   * ADMIN, SCOLARITE, CONTROLEUR (le surveillant de salle est profilé
   * `CONTROLEUR` dans le référentiel — c'est lui qui tient le pointage en
   * salle). Le service recalcule immédiatement `nbInscrits` à partir des
   * inscriptions VALIDEE de la promotion. `nbPresents` est remis à 0.
   */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CONTROLEUR)
  @Post(':id/demarrer')
  demarrer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.demarrer(id, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/terminer')
  terminer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.terminer(id, user);
  }

  /**
   * Scan à l'entrée — ouvert à tous les rôles. Nul ne lance ici d'exception
   * métier si la référence est inconnue : un scan raté est consigné, jamais
   * bloquant. L'IP de l'appareil est tracée dans `ScanExamen.ipAppareil`.
   */
  @Post('scan')
  scan(
    @Body() dto: ScanExamenDto,
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress ?? undefined;
    return this.service.scanner(dto, ip, user);
  }
}
