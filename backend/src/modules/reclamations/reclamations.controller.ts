import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  CreateReclamationDto,
  PosterMessageDto,
  ReclamationQueryDto,
  ChangerStatutDto,
  AssignerReclamationDto,
  CloturerReclamationDto,
} from './reclamations.dto';
import { ReclamationsService } from './reclamations.service';

/**
 * Plateforme de réclamations : ADMIN, DIRECTION et SCOLARITE gèrent le
 * registre ; l'étudiant ne voit que ses propres réclamations via /me et /:id.
 */
const ROLES_GESTION = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE] as const;
const ROLES_ASSIGNATION = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE] as const;
const ROLES_ESCALADE = [Role.ADMIN, Role.DIRECTION] as const;
const ROLES_CLOTURE = [Role.ADMIN, Role.DIRECTION] as const;

@ApiTags('Réclamations')
@ApiBearerAuth()
@Controller('reclamations')
export class ReclamationsController {
  constructor(private readonly service: ReclamationsService) {}

  /**
   * Vue d'ensemble — déclarée avant /:id pour ne pas être capturée comme
   * identifiant par le routing.
   */
  @Roles(...ROLES_GESTION)
  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  /** Vue propre à l'étudiant connecté : strictement ses réclamations. */
  @Roles(Role.ETUDIANT)
  @Get('me')
  mesReclamations(@Query() query: ReclamationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.mesReclamations(query, user);
  }

  @Roles(...ROLES_GESTION)
  @Get()
  liste(@Query() query: ReclamationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOnePour(id, user);
  }

  /** Déclaration ouverte à tout utilisateur connecté. */
  @Post()
  creer(@Body() dto: CreateReclamationDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  /** Tout utilisateur peut poster sur la réclamation qu'il a ouverte. */
  @Post(':id/messages')
  poster(
    @Param('id') id: string,
    @Body() dto: PosterMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.posterMessage(id, dto, user);
  }

  @Roles(...ROLES_GESTION)
  @Put(':id/statut')
  changerStatut(
    @Param('id') id: string,
    @Body() dto: ChangerStatutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changerStatut(id, dto, user);
  }

  @Roles(...ROLES_ASSIGNATION)
  @Put(':id/assigner')
  assigner(
    @Param('id') id: string,
    @Body() dto: AssignerReclamationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assigner(id, dto, user);
  }

  @Roles(...ROLES_ESCALADE)
  @Post(':id/escalader')
  escalader(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.escalader(id, user);
  }

  @Roles(...ROLES_CLOTURE)
  @Post(':id/cloturer')
  cloturer(
    @Param('id') id: string,
    @Body() dto: CloturerReclamationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cloturer(id, dto, user);
  }

  /** Cron manuel — escalade en série toutes les réclamations en retard. */
  @Roles(Role.ADMIN)
  @Post('cron/escalade')
  cronEscalade(@CurrentUser() user: AuthUser) {
    return this.service.cronEscalade(user);
  }
}