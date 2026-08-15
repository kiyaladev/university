import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { CalculerFeuilleDto, CreateFeuillePaieDto, FeuilleQueryDto } from './paie.dto';
import { PaieService } from './paie.service';

@ApiTags('Paie des vacataires')
@ApiBearerAuth()
@Controller('feuilles-paie')
export class PaieController {
  constructor(
    private readonly service: PaieService,
    private readonly jwt: JwtService,
  ) {}

  /** Liste paginée, filtrable par statut / année / mois. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get()
  liste(@Query() query: FeuilleQueryDto) {
    return this.service.liste(query);
  }

  /** Détail d'une feuille avec ses lignes (enseignant inclus). */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  /** Création manuelle : mois + année → libellé « Janvier 2026 », période 1er … fin de mois. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateFeuillePaieDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  /** Recalcul idempotent des lignes depuis les séances contrôlées de la période. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Post(':id/calculer')
  calculer(@Param('id') id: string, @Query() query: CalculerFeuilleDto, @CurrentUser() user: AuthUser) {
    return this.service.calculer(id, query.tous === 'true' || query.tous === '1', user);
  }

  /** BROUILLON → VALIDEE : les montants sont figés. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/valider')
  valider(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.valider(id, user);
  }

  /** VALIDEE → PAYEE : mandat exécuté. */
  @Roles(Role.ADMIN)
  @Post(':id/payer')
  payer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.payer(id, user);
  }

  /** Suppression d'une feuille en brouillon uniquement. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.service.supprimer(id);
  }

  /**
   * État imprimable A4, ouvert dans un nouvel onglet : il ne peut pas porter
   * d'en-tête Authorization, le jeton passe donc en paramètre d'URL et est
   * vérifié ici manuellement (pas de passerelle de garde globale). Le HTML est
   * renvoyé tel quel, aucune enveloppe JSON, `window.print()` au chargement.
   */
  @Public()
  @Get(':id/imprimer')
  async imprimer(
    @Param('id') id: string,
    @Query() query: { token?: string },
    @Res() res: Response,
  ) {
    try {
      this.jwt.verify(query.token ?? '', {
        secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      });
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    res.type('html').send(await this.service.imprimer(id));
  }
}