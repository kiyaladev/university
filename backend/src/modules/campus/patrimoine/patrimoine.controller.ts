/**
 * Patrimoine — routes.
 *
 * Routes publiques : résolution par QR (scan terrain) et impression
 * d'étiquette (la fenêtre d'impression n'envoie pas l'Authorization).
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument } from '../../../common/decorators';
import { baseApplicative } from '../../../common/utils';
import { PatrimoineService } from './patrimoine.service';
import {
  CreateCategorieDto,
  CreateEquipementDto,
  DeclarationReparationDto,
  EquipementQueryDto,
  ResolutionReparationDto,
  ReparationQueryDto,
  UpdateCategorieDto,
  UpdateEquipementDto,
} from './patrimoine.dto';

/** Qui peut gérer le matériel : scolarité + admin. */
const ROLES_GESTION = [Role.ADMIN, Role.SCOLARITE];
const ROLES_DIRECTION = [Role.ADMIN, Role.DIRECTION];

@ApiTags('Patrimoine')
@ApiBearerAuth()
@Controller('patrimoine')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
export class PatrimoineController {
  constructor(private readonly service: PatrimoineService) {}

  // =========================================================== Catégories

  @Get('categories')
  categories() {
    return this.service.listeCategories();
  }

  @Roles(...ROLES_GESTION)
  @Post('categories')
  creerCategorie(@Body() dto: CreateCategorieDto, @CurrentUser() user: AuthUser) {
    return this.service.creerCategorie(dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Put('categories/:id')
  modifierCategorie(@Param('id') id: string, @Body() dto: UpdateCategorieDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierCategorie(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete('categories/:id')
  supprimerCategorie(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerCategorie(id, user);
  }

  // ========================================================== Équipements

  @Get('equipements')
  equipements(@Query() query: EquipementQueryDto) {
    return this.service.listeEquipements(query);
  }

  /**
   * Résolution publique par QR. Déclarée avant `:id` pour que « par-qr » ne
   * soit pas capturé comme identifiant — l'utilisateur scanne le QR avec
   * son téléphone, on ne veut pas qu'il doive se connecter.
   */
  @Public()
  @Throttle({ courant: { ttl: 60_000, limit: 30 } })
  @Get('equipements/par-qr/:qrCode')
  parQr(@Param('qrCode') qrCode: string) {
    return this.service.parQr(qrCode);
  }

  /**
   * Étiquette A4. Ouverte dans un nouvel onglet : l'en-tête Authorization
   * n'y arrive pas, le jeton passe en query string et est contrôlé par la
   * garde globale (même motif que les attestations et les certifications).
   */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Get('equipements/:id/imprimer')
  async imprimerEtiquette(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const base = baseApplicative(req);
    res.type('html').send(await this.service.imprimerEtiquette(id, base));
  }

  @Get('equipements/:id')
  detailEquipement(@Param('id') id: string) {
    return this.service.detailEquipement(id);
  }

  @Roles(...ROLES_GESTION)
  @Post('equipements')
  creerEquipement(@Body() dto: CreateEquipementDto, @CurrentUser() user: AuthUser) {
    return this.service.creerEquipement(dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Put('equipements/:id')
  modifierEquipement(@Param('id') id: string, @Body() dto: UpdateEquipementDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierEquipement(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete('equipements/:id')
  supprimerEquipement(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerEquipement(id, user);
  }

  @Roles(...ROLES_GESTION)
  @Post('equipements/:id/qr')
  regenererQr(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.regenererQr(id, user);
  }

  // ============================================================ Réparations

  @Roles(...ROLES_GESTION)
  @Post('equipements/:id/reparation')
  declarerReparation(@Param('id') id: string, @Body() dto: DeclarationReparationDto, @CurrentUser() user: AuthUser) {
    return this.service.declarerReparation(id, dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Post('equipements/:id/reparation/resoudre')
  resoudreReparation(@Param('id') id: string, @Body() dto: ResolutionReparationDto, @CurrentUser() user: AuthUser) {
    return this.service.resoudreReparation(id, dto, user);
  }

  @Get('equipements/:id/reparations')
  reparations(@Param('id') id: string) {
    return this.service.reparations(id);
  }

  /**
   * Registre global des réparations, tous équipements confondus. Remplace
   * le N+1 que la page « Réparations » faisait sur l'onglet : un seul
   * findMany, on évite de recharger la liste des équipements pour chaque
   * fiche. Filtre optionnel sur le statut (DECLARE, EN_COURS, TERMINE,
   * ANNULE).
   */
  @Roles(...ROLES_GESTION, ...ROLES_DIRECTION)
  @Get('reparations')
  listeReparations(@Query() query: ReparationQueryDto) {
    return this.service.listeReparations(query);
  }

  // ============================================================ Dashboard

  @Roles(...ROLES_GESTION, ...ROLES_DIRECTION)
  @Get('dashboard')
  dashboard(@Query('anneeId') anneeId?: string) {
    return this.service.dashboard(anneeId);
  }
}
