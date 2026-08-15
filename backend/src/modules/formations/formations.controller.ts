/**
 * Hub de formation continue & certifications — routes.
 * Vitrine publique (sans jeton), inscription payante Mobile Money, gestion
 * par la direction / scolarité / administration, certificat A4 imprimable.
 * Les routes « publiques » sont déclarées avant « :id » pour que le mot ne
 * soit jamais capturé comme identifiant.
 */
import {
  Body,
  Controller,
  Delete,
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
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { baseApplicative } from '../../common/utils';
import { FormationsService } from './formations.service';
import {
  CreateFormationDto,
  FormationQueryDto,
  InscriptionFormationPubliqueDto,
  UpdateFormationDto,
} from './formations.dto';

/** Gestion du hub : la scolarité encaisse, la direction arbitre, l'admin tient. */
const GESTIONNAIRES = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

@ApiTags('Formations')
@ApiBearerAuth()
@Controller('formations')
export class FormationsController {
  constructor(
    private readonly service: FormationsService,
    private readonly jwt: JwtService,
  ) {}

  // ------------------------------------------------------- vitrine publique

  /** Vitrine : formations PUBLIEE, places restantes, triées par date de début. */
  @Public()
  @Get('publiques')
  publiques() {
    return this.service.formationsPubliques();
  }

  @Public()
  @Get('publiques/:id')
  publique(@Param('id') id: string) {
    return this.service.formationPublique(id);
  }

  /**
   * Demande d'inscription sans compte : 10 dépôts par quart d'heure et par
   * adresse — la vitrine se protège des bourrages comme la préinscription.
   */
  @Public()
  @Throttle({
    default: { limit: 10, ttl: 900_000 },
    courant: { limit: 10, ttl: 900_000 },
  })
  @Post(':id/inscription')
  inscrire(
    @Param('id') id: string,
    @Body() dto: InscriptionFormationPubliqueDto,
    @Ip() ip: string,
  ) {
    return this.service.inscriptionPublique(id, dto, ip);
  }

  // ------------------------------------------------------------- gestion

  @Roles(...GESTIONNAIRES)
  @Get()
  liste(@Query() query: FormationQueryDto) {
    return this.service.liste(query);
  }

  /** Toute création naît en BROUILLON : rien ne s'expose sans publication. */
  @Roles(...GESTIONNAIRES)
  @Post()
  creer(@Body() dto: CreateFormationDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(...GESTIONNAIRES)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateFormationDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(...GESTIONNAIRES)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }

  /** BROUILLON → PUBLIEE : la formation entre en vitrine. */
  @Roles(...GESTIONNAIRES)
  @Post(':id/publier')
  publier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publier(id, user);
  }

  /** PUBLIEE → COMPLETE : le circuit est clos, plus aucune demande acceptée. */
  @Roles(...GESTIONNAIRES)
  @Post(':id/cloturer')
  cloturer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.cloturer(id, user);
  }

  /** Registre d'une formation : dossiers, statuts, paiements liés, montants. */
  @Roles(...GESTIONNAIRES)
  @Get(':id/inscriptions')
  inscriptions(@Param('id') id: string) {
    return this.service.inscriptionsDe(id);
  }

  /**
   * Confirmation pilote : la scolarité / la direction répercute la réponse de
   * l'opérateur Mobile Money — paiement REUSSI, puis demande CONFIRMEE.
   */
  @Roles(...GESTIONNAIRES)
  @Post('inscriptions/:id/confirmer')
  confirmer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.confirmer(id, user);
  }

  @Roles(...GESTIONNAIRES)
  @Post('inscriptions/:id/annuler')
  annuler(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.annuler(id, user);
  }

  /**
   * Attestation A4 ouverte dans un nouvel onglet : l'en-tête Authorization n'y
   * arrive pas, le jeton passe en paramètre d'URL et est vérifié à la main.
   * :id est ici l'identifiant de l'inscription (dossier FOR-AAAA-NNNNN).
   */
  @Public()
  @Get(':id/certificat')
  async certificat(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = baseApplicative(req);
    res.type('html').send(await this.service.certificat(id, token, base));
  }
}