/** Scolarité LMD — routes API des évaluations, notes et délibérations.
 *  Les états imprimables (PV, bulletins) suivent le même dispositif que les
 *  rapports : ouverts dans un nouvel onglet sans en-tête Authorization, le
 *  jeton est passé en URL et vérifié ici à la main.
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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument, DocumentScope } from '../../common/decorators';
import { QueryDto } from '../../common/dto';
import { verifierJetonImprimable } from '../../common/jeton-imprimable';
import {
  CreateDeliberationDto,
  CreateEvaluationDto,
  DeliberationQueryDto,
  EvaluationQueryDto,
  NoteQueryDto,
  SaisieNotesDto,
  UpdateEvaluationDto,
} from './scolarite.dto';
import { ScolariteService } from './scolarite.service';

const SAISIE = [Role.SCOLARITE, Role.ADMIN] as const;
const JURY = [Role.ADMIN, Role.DIRECTION] as const;
/** Lecture des notes et des décisions de jury : jamais ouverte à l'étudiant. */
const NOTES = [Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT] as const;

// --------------------------------------------------------------- Évaluations

@ApiTags('Évaluations')
@ApiBearerAuth()
@Controller('evaluations')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT)
export class EvaluationsController {
  constructor(private readonly service: ScolariteService) {}

  @Get()
  lister(@Query() query: EvaluationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listerEvaluations(query, user);
  }

  @Get(':id')
  @DocumentScope('evaluation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  detail(@Param('id') id: string) {
    return this.service.findEvaluation(id);
  }

  /** Les inscrits de la promotion, pour la feuille de notes. */
  @Roles(...NOTES)
  @Get(':id/etudiants')
  @DocumentScope('evaluation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  feuille(@Param('id') id: string) {
    return this.service.feuilleEvaluation(id);
  }

  @Roles(...SAISIE)
  @Post()
  creer(@Body() dto: CreateEvaluationDto, @CurrentUser() user: AuthUser) {
    return this.service.creerEvaluation(dto, user);
  }

  @Roles(...SAISIE)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateEvaluationDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierEvaluation(id, dto, user);
  }

  @Roles(...SAISIE)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerEvaluation(id, user);
  }

  @Roles(...SAISIE)
  @Post(':id/cloturer')
  cloturer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.cloturerEvaluation(id, user);
  }
}

// -------------------------------------------------------------------- Notes

@ApiTags('Notes')
@ApiBearerAuth()
@Controller('notes')
export class NotesController {
  constructor(private readonly service: ScolariteService) {}

  @Roles(...NOTES)
  @Get()
  lister(@Query() query: NoteQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listerNotes(query, user);
  }

  /** Feuille complète de saisie (avec les cases « présent » cochables). */
  @Roles(...NOTES)
  @Get('evaluation/:id')
  @DocumentScope('evaluation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  feuille(@Param('id') id: string) {
    return this.service.feuilleEvaluation(id);
  }

  /** Saisie en bloc d'une feuille d'évaluation. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put('saisie')
  saisir(@Body() dto: SaisieNotesDto, @CurrentUser() user: AuthUser) {
    return this.service.saisirNotes(dto, user);
  }
}

// ------------------------------------------------------------ Délibérations

@ApiTags('Délibérations')
@ApiBearerAuth()
@Controller('deliberations')
export class DeliberationsController {
  constructor(
    private readonly service: ScolariteService,
    private readonly jwt: JwtService,
  ) {}

  @Roles(...NOTES)
  @Get()
  lister(@Query() query: DeliberationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listerDeliberations(query, user);
  }

  @Roles(...NOTES)
  @Get(':id')
  @DocumentScope('deliberation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  detail(@Param('id') id: string) {
    return this.service.detailDeliberation(id);
  }

  @Roles(...SAISIE)
  @Post()
  creer(@Body() dto: CreateDeliberationDto, @CurrentUser() user: AuthUser) {
    return this.service.creerDeliberation(dto, user);
  }

  @Roles(...SAISIE)
  @Post(':id/calculer')
  calculer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.calculerDeliberation(id, undefined, user);
  }

  /** Le jury fige les résultats : plus aucun recalcul. */
  @Roles(...JURY)
  @Post(':id/valider')
  valider(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.validerDeliberation(id, user.id);
  }

  // ------------------------------------------------------------ Impression

  /** Procès-verbal de délibération (PV du jury). */
  @ProtectedDocument(...NOTES)
  @Get(':id/imprimer')
  @DocumentScope('deliberation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  async imprimer(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    verifierJetonImprimable(this.jwt, req);
    res.type('html').send(await this.service.imprimerPv(id));
  }

  /** Bulletin individuel de notes (relevé), une page A4 par étudiant. */
  @ProtectedDocument(...NOTES)
  @Get(':id/releve/:inscriptionId')
  @DocumentScope('deliberation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  async releve(
    @Param('id') id: string,
    @Param('inscriptionId') inscriptionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    verifierJetonImprimable(this.jwt, req);
    res.type('html').send(await this.service.imprimerBulletin(id, inscriptionId));
  }
}
