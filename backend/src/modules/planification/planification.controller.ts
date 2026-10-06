import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreneauxService } from './creneaux.service';
import { SeancesService } from './seances.service';
import {
  AnnulerSeanceDto,
  AffecterControleurDto,
  AffecterTourneeDto,
  CreateCreneauDto,
  CreateSeanceDto,
  CreneauQueryDto,
  GenerationDto,
  SeanceQueryDto,
  SyncSeancesDto,
  UpdateCreneauDto,
  UpdateSeanceDto,
} from './planification.dto';

const PLANIFICATEURS = [Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT] as const;

/**
 * Le registre des séances est un outil de service. `where()` restreint bien
 * l'enseignant à ses séances et le chef de département aux siennes, mais ne
 * connaît aucun périmètre pour un étudiant : sans cette barrière, un jeton
 * étudiant listait toutes les séances de l'université. L'étudiant lit son
 * emploi du temps par les créneaux, pas par le registre.
 */
const PERSONNEL = [
  Role.ADMIN,
  Role.DIRECTION,
  Role.SCOLARITE,
  Role.CHEF_DEPARTEMENT,
  Role.CONTROLEUR,
  Role.ENSEIGNANT,
] as const;

const LECTEURS_CRENEAUX = [...PERSONNEL, Role.ETUDIANT] as const;

@ApiTags("Emploi du temps")
@ApiBearerAuth()
// Les lectures sont réservées au personnel et aux étudiants, qui ne voient que
// les créneaux de leur inscription validée dans l'année active. Les mutations
// gardent leurs rôles propres sur chaque méthode.
@Roles(...LECTEURS_CRENEAUX)
@Controller('creneaux')
export class CreneauxController {
  constructor(private readonly service: CreneauxService) {}

  @Get() findAll(@Query() query: CreneauQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Get('emploi-du-temps') emploiDuTemps(@Query() query: CreneauQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.emploiDuTemps(query, user);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  /**
   * Le contrôleur constate l'emploi du temps réel avant tout le monde : une
   * salle changée, un créneau déplacé. Il peut donc ouvrir et corriger un
   * créneau, mais pas en supprimer — une suppression efface des séances.
   */
  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Post() create(@Body() dto: CreateCreneauDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateCreneauDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(...PLANIFICATEURS)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}

@ApiTags('Séances')
@ApiBearerAuth()
@Controller('seances')
@Roles(...PERSONNEL)
export class SeancesController {
  constructor(private readonly service: SeancesService) {}

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get('controleurs') controleurs() {
    return this.service.controleurs();
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get('tournee-apercu') apercuTournee(@Query() query: AffecterTourneeDto) {
    return this.service.apercuTournee(query);
  }

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

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.consulter(id, user);
  }

  /**
   * Séance non programmée. Le contrôleur qui trouve un cours en salle sans
   * ligne à l'emploi du temps (rattrapage, remplacement, salle changée) doit
   * pouvoir l'ouvrir puis la pointer : c'est la ligne blanche du cahier papier.
   * Il ouvre, il ne modifie ni ne supprime.
   */
  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Post() create(@Body() dto: CreateSeanceDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(...PLANIFICATEURS, Role.CONTROLEUR)
  @Post('sync') synchroniser(@Body() dto: SyncSeancesDto, @CurrentUser() user: AuthUser) {
    return this.service.synchroniser(dto, user);
  }

  @Roles(...PLANIFICATEURS)
  @Post('generer') generer(@Body() dto: GenerationDto, @CurrentUser() user: AuthUser) {
    return this.service.generer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id/controleur') affecterControleur(
    @Param('id') id: string,
    @Body() dto: AffecterControleurDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.affecterControleur(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post('tournee') affecterTournee(@Body() dto: AffecterTourneeDto, @CurrentUser() user: AuthUser) {
    return this.service.affecterTournee(dto, user);
  }

  @Roles(...PLANIFICATEURS)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateSeanceDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(...PLANIFICATEURS)
  @Post(':id/annuler') annuler(@Param('id') id: string, @Body() dto: AnnulerSeanceDto, @CurrentUser() user: AuthUser) {
    return this.service.annuler(id, dto.motif, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
