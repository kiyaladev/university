import { Body, Controller, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Roles, ProtectedDocument } from '../../../common/decorators';
import {
  CloturerCourrierDto,
  CourrierQueryDto,
  CreateCourrierDto,
  ParapherCourrierDto,
  UpdateCourrierDto,
} from './courrier.dto';
import { CourrierService } from './courrier.service';

@ApiTags('Courrier')
@ApiBearerAuth()
@Controller('courrier')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT)
export class CourrierController {
  constructor(private readonly service: CourrierService) {}

  @Get()
  lister(@Query() query: CourrierQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.lister(query, user);
  }

  /** Déclaré avant `:id` pour ne pas être capturé par le handler générique. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get(':id')
  lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouver(id, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  creer(@Body() dto: CreateCourrierDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateCourrierDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  /**
   * Valideur courant : paraphe à l'étape `circuitId`. Le service trace quel
   * utilisateur a fait quoi ; le statut du courrier passe à TRAITE lorsque
   * toutes les étapes le sont.
   */
  @Post(':id/parapher/:circuitId')
  parapher(
    @Param('id') id: string,
    @Param('circuitId') circuitId: string,
    @Body() dto: ParapherCourrierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.parapher(id, circuitId, dto, user);
  }

  /** ADMIN : EN_CIRCUIT → TRAITE → CLASSE → ARCHIVE. */
  @Roles(Role.ADMIN)
  @Post(':id/cloturer')
  cloturer(@Param('id') id: string, @Body() dto: CloturerCourrierDto, @CurrentUser() user: AuthUser) {
    return this.service.cloturer(id, dto, user);
  }

  /**
   * Feuille A4 — ouverte dans un nouvel onglet ; l'en-tête Authorization
   * n'y arrive pas, le jeton passe donc en query string : la garde globale
   * `@ProtectedDocument` le contrôle.
   */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT)
  @Get(':id/imprimer')
  async imprimer(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const user = req.user as AuthUser;
    res.type('html').send(await this.service.imprimer(id, user));
  }
}
