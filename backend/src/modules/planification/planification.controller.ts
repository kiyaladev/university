import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreneauxService } from './creneaux.service';
import { SeancesService } from './seances.service';
import {
  AnnulerSeanceDto,
  CreateCreneauDto,
  CreateSeanceDto,
  CreneauQueryDto,
  GenerationDto,
  SeanceQueryDto,
  UpdateCreneauDto,
  UpdateSeanceDto,
} from './planification.dto';

const PLANIFICATEURS = [Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT] as const;

@ApiTags("Emploi du temps")
@ApiBearerAuth()
@Controller('creneaux')
export class CreneauxController {
  constructor(private readonly service: CreneauxService) {}

  @Get() findAll(@Query() query: CreneauQueryDto) {
    return this.service.liste(query);
  }

  @Get('emploi-du-temps') emploiDuTemps(@Query() query: CreneauQueryDto) {
    return this.service.emploiDuTemps(query);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * Le contrôleur constate l'emploi du temps réel avant tout le monde : une
   * salle changée, un créneau déplacé. Il peut donc ouvrir et corriger un
   * créneau, mais pas en supprimer — une suppression efface des séances.
   */
  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Post() create(@Body() dto: CreateCreneauDto) {
    return this.service.creer(dto);
  }

  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateCreneauDto) {
    return this.service.modifier(id, dto);
  }

  @Roles(...PLANIFICATEURS)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@ApiTags('Séances')
@ApiBearerAuth()
@Controller('seances')
export class SeancesController {
  constructor(private readonly service: SeancesService) {}

  @Get() findAll(@Query() query: SeanceQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  /** Feuille de contrôle du jour (par défaut : aujourd'hui). */
  @Get('journee') journee(@Query() query: SeanceQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.journee(query.date, query, user);
  }

  /** Espace enseignant : mes séances. */
  @Get('mes-seances') mesSeances(@Query() query: SeanceQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste({ ...query, enseignantId: user.enseignantId ?? '—' }, user);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * Séance non programmée. Le contrôleur qui trouve un cours en salle sans
   * ligne à l'emploi du temps (rattrapage, remplacement, salle changée) doit
   * pouvoir l'ouvrir puis la pointer : c'est la ligne blanche du cahier papier.
   * Il ouvre, il ne modifie ni ne supprime.
   */
  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Post() create(@Body() dto: CreateSeanceDto) {
    return this.service.creer(dto);
  }

  @Roles(...PLANIFICATEURS)
  @Post('generer') generer(@Body() dto: GenerationDto) {
    return this.service.generer(dto);
  }

  @Roles(...PLANIFICATEURS)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateSeanceDto) {
    return this.service.modifier(id, dto);
  }

  @Roles(...PLANIFICATEURS)
  @Post(':id/annuler') annuler(@Param('id') id: string, @Body() dto: AnnulerSeanceDto) {
    return this.service.annuler(id, dto.motif);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
