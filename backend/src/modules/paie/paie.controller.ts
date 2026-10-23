import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Roles, ProtectedDocument } from '../../common/decorators';
import { CalculerFeuilleDto, CreateFeuillePaieDto, FeuilleQueryDto } from './paie.dto';
import { PaieService } from './paie.service';
import { verifierJetonImprimable } from '../../common/jeton-imprimable';

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

  /** BROUILLON → VALIDE : les montants sont figés. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/valider')
  valider(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.valider(id, user);
  }

  /** VALIDE → PAYE : mandat exécuté. */
  @Roles(Role.ADMIN)
  @Post(':id/payer')
  payer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.payer(id, user);
  }

  /** Suppression d'une feuille en brouillon uniquement. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }

  /**
   * État imprimable A4, ouvert dans un nouvel onglet : il ne peut pas porter
   * d'en-tête Authorization, le jeton passe donc en paramètre d'URL et est
   * vérifié ici manuellement (pas de passerelle de garde globale). Le HTML est
   * renvoyé tel quel, aucune enveloppe JSON, `window.print()` au chargement.
   */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Get(':id/imprimer')
  async imprimer(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // Le secret vient du JwtService injecté : plus de clé en dur qui pouvait
    // diverger de celle de la stratégie JWT.
    verifierJetonImprimable(this.jwt, req);
    res.type('html').send(await this.service.imprimer(id));
  }
}
