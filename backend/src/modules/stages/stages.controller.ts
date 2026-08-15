/**
 * Suivi des stages et mémoires (trois parties : étudiant, encadrant, tuteur
 * d'entreprise). Le tableau de bord est celui de la scolarité et de la
 * direction ; l'étudiant ne passe que par le portail, l'enseignant par ses
 * encadrements. Voir la machine à états documentée dans stages.service.ts.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
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
import { FicheService } from './fiche.service';
import {
  CreateSoutenanceDto,
  CreateTravailDto,
  NoteSoutenanceDto,
  TransitionDto,
  TravailQueryDto,
  UpdateTravailDto,
} from './stages.dto';
import { StagesService, ROLES_PILOTES } from './stages.service';

/** Encadrant : agit sur les travaux qu'il encadre, pas sur ceux des autres. */
const ADJUDANTS = [...ROLES_PILOTES, Role.ENSEIGNANT];

@ApiTags('Travaux encadrés')
@ApiBearerAuth()
@Controller('travaux-encadres')
export class TravauxEncadresController {
  constructor(
    private readonly service: StagesService,
    private readonly fiche: FicheService,
  ) {}

  @Get()
  liste(@Query() query: TravailQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  /** Fiche A4 : ouverte dans un nouvel onglet, le jeton passe par l'URL. */
  @Public()
  @Get(':id/fiche')
  async imprimer(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const html = await this.fiche.fiche(id, token);
    res.type('html').send(html);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.detail(id, user);
  }

  /** Création : la scolarité saisit pour n'importe quel étudiant ; l'étudiant
   *  connecté ne propose que ses stages / rapports et devient le porteur. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.ETUDIANT)
  @Post()
  creer(@Body() dto: CreateTravailDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  /** Modification administrative ; la vie du statut passe par /transition. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.ENSEIGNANT, Role.ETUDIANT)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateTravailDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  /** Suppression réservée à l'administration, dossier non engagé (PROPOSE/VALIDE). */
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.service.supprimer(id);
  }

  /** Machine à états : une cible, appliquée depuis l'état courant. */
  @Roles(...ADJUDANTS)
  @Post(':id/transition')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.transition(id, dto.statut, user);
  }
}

@ApiTags('Soutenances')
@ApiBearerAuth()
@Controller('soutenances')
export class SoutenancesController {
  constructor(private readonly service: StagesService) {}

  /** Calendrier de la scolarité : les 7 jours à venir. */
  @Roles(...ROLES_PILOTES)
  @Get()
  calendrier() {
    return this.service.calendrier();
  }

  /** Acte du bureau du jury : l'enregistrement de la soutenance place le
   *  travail en SOUTENU (défense constatée = état final du dossier). */
  @Roles(...ROLES_PILOTES)
  @Post()
  enregistrer(@Body() dto: CreateSoutenanceDto, @CurrentUser() user: AuthUser) {
    return this.service.enregistrerSoutenance(dto, user);
  }

  /** Constat du jury : note et mention sur une soutenance tenue. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Put(':id/hota')
  noter(@Param('id') id: string, @Body() dto: NoteSoutenanceDto) {
    return this.service.noter(id, dto);
  }
}