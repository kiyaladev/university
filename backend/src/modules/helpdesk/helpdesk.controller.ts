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
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { baseApplicative } from '../../common/utils';
import { EquipementsService, TicketsService } from './helpdesk.service';
import {
  CreateEquipementDto,
  DeclarerTicketDto,
  EquipementQueryDto,
  TicketQueryDto,
  TraiterTicketDto,
  UpdateEquipementDto,
} from './helpdesk.dto';

@ApiTags('Support IT')
@ApiBearerAuth()
@Controller('equipements')
export class EquipementsController {
  constructor(private readonly service: EquipementsService) {}

  /** Inventaire du parc : tout utilisateur connecté (le déclarant choisit). */
  @Get()
  liste(@Query() query: EquipementQueryDto) {
    return this.service.liste(query);
  }

  /**
   * Résolution du QR scanné. Déclarée avant `:id` pour que « par-code » ne
   * soit pas capturé comme identifiant — et publique : le QR est imprimé à
   * hauteur d'homme, son code ne cache rien que l'étiquette elle-même.
   */
  @Public()
  @Get('par-code/:codeQr')
  parCode(@Param('codeQr') codeQr: string) {
    return this.service.parCode(codeQr);
  }

  /**
   * Feuille A4 d'étiquettes. Ouverte dans un nouvel onglet : l'en-tête
   * Authorization n'y arrive pas, le jeton passe en paramètre d'URL et est
   * vérifié à la main (même motif que l'impression des attestations).
   */
  @Public()
  @Get(':id/imprimer-qr')
  async imprimerQr(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = baseApplicative(req);
    const html = await this.service.imprimerQr(id, token, base);
    res.type('html').send(html);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateEquipementDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateEquipementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}

@ApiTags('Support IT')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  /**
   * Registre des tickets. La DSI (administration) voit tout et filtre ;
   * chaque autre rôle ne voit que ses propres déclarations.
   */
  @Get()
  liste(@Query() query: TicketQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  /** Compteurs pour le panneau DSI — déclaré avant `:id` pour la même raison. */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findTicket(id, user);
  }

  /**
   * Déclaration rapide : n'importe quel utilisateur connecté. Limite modérée
   * (10 par minute) : de quoi signaler une panne, pas de quoi noyer le registre.
   */
  @Throttle({ courant: { ttl: 60_000, limit: 10 } })
  @Post()
  declarer(@Body() dto: DeclarerTicketDto, @CurrentUser() user: AuthUser) {
    return this.service.declarer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post(':id/statut')
  changerStatut(
    @Param('id') id: string,
    @Body() dto: TraiterTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changerStatut(id, dto, user);
  }
}