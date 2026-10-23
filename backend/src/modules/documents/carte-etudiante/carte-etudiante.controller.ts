import { Body, Controller, Get, Ip, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument, DocumentScope } from '../../../common/decorators';
import { baseApplicative } from '../../../common/utils';
import { CarteEtudianteService } from './carte-etudiante.service';
import { Throttle } from '@nestjs/throttler';
import {
  CreateCarteEtudianteDto,
  CarteEtudianteQueryDto,
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
  @Throttle({ courant: { ttl: 60_000, limit: 30 } })
  @Get('verifier')
  verifier(@Query() query: VerifierCartePubliqueDto, @Ip() ip: string) {
    return this.service.verifier(query, ip);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get()
  liste(@Query() query: CarteEtudianteQueryDto) {
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
  modifier(@Param('id') id: string, @Body() dto: UpdateCarteEtudianteDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/revoquer')
  revoquer(@Param('id') id: string, @Body() dto: RevoquerCarteDto, @CurrentUser() user: AuthUser) {
    return this.service.revoquer(id, dto, user);
  }

  /** Définition du NIP : l'étudiant, sur sa propre carte uniquement. */
  @Roles(Role.ETUDIANT)
  @Post(':id/nip')
  definirNip(@Param('id') id: string, @Body() dto: DefinirNipDto, @CurrentUser() user: AuthUser) {
    return this.service.definirNip(id, dto, user);
  }

  /**
   * Vérification interne du NIP par un service tiers (resto U, cité, contrôle
   * d'identité à distance).
   *
   * L'étudiant et le contrôleur ont été retirés de la liste. Sans vérification
   * de périmètre ni bridage, la route était un oracle : un compte étudiant
   * pouvait passer n'importe quel identifiant de carte et tester les 10 000 NIP
   * à quatre chiffres, ce qui revient à ne plus avoir de NIP. Elle reste
   * ouverte aux seuls rôles qui ont une raison professionnelle de la faire.
   */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CONTROLEUR, Role.DIRECTION)
  @Throttle({ courant: { ttl: 60_000, limit: 20 } })
  @Post(':id/verifier-nip')
  verifierNip(@Param('id') id: string, @Body() dto: VerifierNipDto) {
    return this.service.verifierNip(id, dto);
  }

  /** Document A4 : ouvert dans un nouvel onglet, jeton contrôlé par la garde globale. */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE, Role.ETUDIANT)
  @DocumentScope('carteEtudiante', { [Role.ETUDIANT]: 'etudiantId' })
  @Get(':id/imprimer')
  async imprimer(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const base = baseApplicative(req);
    const html = await this.service.imprimer(id, base);
    res.type('html').send(html);
  }
}
