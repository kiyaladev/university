import { Body, Controller, Delete, Get, Ip, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument, DocumentScope } from '../../../common/decorators';
import { baseApplicative } from '../../../common/utils';
import { AttestationsService } from './attestations.service';
import { Throttle } from '@nestjs/throttler';
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
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
export class AttestationsController {
  constructor(private readonly service: AttestationsService) {}

  /**
   * Vérification publique : atteinte via le QR (ou la saisie du numéro et du
   * jeton). Déclarée avant `:id` pour que le mot « verifier » ne soit pas
   * capturé comme identifiant — et marquée @Public() car le vérificateur n'a
   * pas de compte.
   */
  @Public()
  // Chaque consultation écrit une ligne de vérification, et chaque échec une
  // ligne d'audit. Sans bridage, la limite globale (1200/min) autorisait
  // ~1,7 million de lignes par jour depuis un seul appelant ; la route est
  // publique, donc rien n'y distingue unscan légitime d'un remplissage.
  @Throttle({ courant: { ttl: 60_000, limit: 30 } })
  @Get('verifier')
  verifier(@Query() query: VerifierAttestationDto, @Ip() ip: string) {
    return this.service.verifier(query, ip);
  }

  @Roles(...LECTEURS)
  @Get()
  lister(@Query() query: AttestationQueryDto) {
    return this.service.lister(query);
  }

  @Roles(...LECTEURS)
  @Get(':id')
  lire(@Param('id') id: string) {
    return this.service.lire(id);
  }

  @Roles(Role.SCOLARITE, Role.ADMIN)
  @Post()
  creer(@Body() dto: CreateAttestationDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateAttestationDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/revoquer')
  revoquer(@Param('id') id: string, @Body() dto: RevoquerAttestationDto, @CurrentUser() user: AuthUser) {
    return this.service.revoquer(id, dto, user);
  }

  /**
   * Document A4. Ouvert dans un nouvel onglet : l'en-tête Authorization n'y
   * arrive pas, le jeton passe donc en paramètre d'URL : la garde globale
   * `@ProtectedDocument` le contrôle.
   */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.ETUDIANT)
  @DocumentScope('attestation', { [Role.ETUDIANT]: 'etudiantId' })
  @Get(':id/imprimer')
  async imprimer(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const base = baseApplicative(req);
    const html = await this.service.imprimer(id, base, req.ip);
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
