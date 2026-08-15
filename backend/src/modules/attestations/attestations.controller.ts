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
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { baseApplicative } from '../../common/utils';
import { AttestationsService } from './attestations.service';
import {
  AttestationQueryDto,
  CreateAttestationDto,
  RevoquerAttestationDto,
  UpdateAttestationDto,
  VerifierAttestationDto,
} from './attestations.dto';

/** Consultation du registre : direction, scolarité, administration. */
const LECTEURS = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

@ApiTags('Attestations')
@ApiBearerAuth()
@Controller('attestations')
export class AttestationsController {
  constructor(private readonly service: AttestationsService) {}

  /**
   * Vérification publique : atteinte via le QR (ou la saisie du numéro et du
   * jeton). Déclarée avant `:id` pour que le mot « verifier » ne soit pas
   * capturé comme identifiant — et marquée @Public() car le vérificateur n'a
   * pas de compte.
   */
  @Public()
  @Get('verifier')
  verifier(@Query() query: VerifierAttestationDto, @Ip() ip: string) {
    return this.service.verifier(query, ip);
  }

  @Roles(...LECTEURS)
  @Get()
  liste(@Query() query: AttestationQueryDto) {
    return this.service.liste(query);
  }

  @Roles(...LECTEURS)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.SCOLARITE, Role.ADMIN)
  @Post()
  creer(@Body() dto: CreateAttestationDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateAttestationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/revoquer')
  revoquer(
    @Param('id') id: string,
    @Body() dto: RevoquerAttestationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revoquer(id, dto, user);
  }

  /**
   * Document A4. Ouvert dans un nouvel onglet : l'en-tête Authorization n'y
   * arrive pas, le jeton passe donc en paramètre d'URL et est vérifié à la main.
   */
  @Public()
  @Get(':id/imprimer')
  async imprimer(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = baseApplicative(req);
    const html = await this.service.imprimer(id, token, base, req.ip);
    res.type('html').send(html);
  }

  /** Journal des vérifications d'un document (direction générale). */
  @Roles(Role.ADMIN)
  @Get(':id/verifications')
  verifications(@Param('id') id: string) {
    return this.service.verifications(id);
  }

  /**
   * Interdiction par choix produit : les attestations sont probantes et se
   * révoquent, jamais elles ne s'effacent.
   */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Delete(':id')
  supprimer() {
    return this.service.supprimerInterdit();
  }
}