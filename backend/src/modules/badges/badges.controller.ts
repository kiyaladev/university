import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { baseApplicative } from '../../common/utils';
import { BadgesService } from './badges.service';
import {
  AnnulerBadgeDto,
  BadgeQueryDto,
  CreateBadgeDto,
  RallongerBadgeDto,
  UpdateBadgeDto,
  VerifierBadgePubliqueDto,
} from './badges.dto';

/**
 * Badges d'accès : émetteur = scolarité, valideur = administration.
 *
 * - Création / modification : scolarité et admin.
 * - Annulation : décision opposable, mêmes rôles.
 * - Rallonge : un badge expiré peut être remis en service tant qu'il n'est
 *   pas annulé (utile pour les intervenants récurrents).
 * - Impression : ouverte dans un nouvel onglet, jeton vérifié à la main.
 */
@ApiTags('Badges')
@ApiBearerAuth()
@Controller('badges')
export class BadgesController {
  constructor(private readonly service: BadgesService) {}

  /**
   * Vérification publique par QR : déclarée avant `:id` pour que « verifier »
   * ne soit pas capturé comme identifiant. Ouverte, car celui qui contrôle un
   * badge à l'entrée n'a pas de compte — c'est le jeton qui fait foi.
   */
  @Public()
  @Get('verifier')
  verifier(@Query() query: VerifierBadgePubliqueDto, @Ip() ip: string) {
    return this.service.verifier(query, ip);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get()
  liste(@Query() query: BadgeQueryDto) {
    return this.service.liste(query);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get(':id')
  trouver(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateBadgeDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateBadgeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/annuler')
  annuler(
    @Param('id') id: string,
    @Body() dto: AnnulerBadgeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.annuler(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/rallonger')
  rallonger(
    @Param('id') id: string,
    @Body() dto: RallongerBadgeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rallonger(id, dto, user);
  }

  @Public()
  @Get(':id/imprimer')
  async imprimer(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = baseApplicative(req);
    const html = await this.service.imprimer(id, token, base);
    res.type('html').send(html);
  }
}