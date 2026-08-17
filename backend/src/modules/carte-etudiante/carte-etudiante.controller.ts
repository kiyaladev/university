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
import { CarteEtudianteService } from './carte-etudiante.service';
import {
  CreateCarteEtudianteDto,
  DefinirNipDto,
  RevoquerCarteDto,
  UpdateCarteEtudianteDto,
  VerifierCartePubliqueDto,
  VerifierNipDto,
} from './carte-etudiante.dto';

/**
 * Carte d'étudiant numérique.
 *
 * - Liste et émission : scolarité / administration.
 * - L'étudiant voit sa propre carte et définit son NIP (4 chiffres).
 * - Révocation : décision opposable, restreinte à ADMIN/DIRECTION.
 * - Vérification publique : ouverte, journalisée.
 */
@ApiTags('Carte étudiante')
@ApiBearerAuth()
@Controller('cartes-etudiantes')
export class CarteEtudianteController {
  constructor(private readonly service: CarteEtudianteService) {}

  /**
   * Vérification publique via QR : déclarée avant `:id` pour que « verifier »
   * ne soit pas capturé comme identifiant. La route est @Public() car le
   * vérificateur (employeur, douane, etc.) n'a pas de compte.
   */
  @Public()
  @Get('verifier')
  verifier(@Query() query: VerifierCartePubliqueDto, @Ip() ip: string) {
    return this.service.verifier(query, ip);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get()
  liste(@Query() query: { page?: number; pageSize?: number; all?: string; search?: string; etudiantId?: string }) {
    return this.service.liste(query);
  }

  @Roles(Role.ETUDIANT)
  @Get('me')
  maCarte(@CurrentUser() user: AuthUser) {
    return this.service.maCarte(user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get(':id')
  trouver(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateCarteEtudianteDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateCarteEtudianteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/revoquer')
  revoquer(
    @Param('id') id: string,
    @Body() dto: RevoquerCarteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revoquer(id, dto, user);
  }

  /** Définition du NIP : l'étudiant, sur sa propre carte uniquement. */
  @Roles(Role.ETUDIANT)
  @Post(':id/nip')
  definirNip(
    @Param('id') id: string,
    @Body() dto: DefinirNipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.definirNip(id, dto, user);
  }

  /**
   * Vérification interne du NIP par un service tiers : aucun rôle requis
   * — ce sont les routes parentes qui décident qui y accède en pratique.
   * La route elle-même reste neutre pour ne pas figer un nouveau rôle.
   */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.ETUDIANT, Role.CONTROLEUR, Role.DIRECTION)
  @Post(':id/verifier-nip')
  verifierNip(@Param('id') id: string, @Body() dto: VerifierNipDto) {
    return this.service.verifierNip(id, dto);
  }

  /** Document A4 : ouvert dans un nouvel onglet, jeton vérifié à la main. */
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