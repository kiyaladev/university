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
import { Throttle } from '@nestjs/throttler';
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
const ROLES_LECTURE = [...ROLES_GESTION, Role.ETUDIANT] as const;
const ROLES_CREATION = [...ROLES_GESTION, Role.ETUDIANT] as const;
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

  @Roles(...ROLES_GESTION)
  @Get('agents')
  agents() {
    return this.service.agents();
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

  @Roles(...ROLES_LECTURE)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOnePour(id, user);
  }

  /** Déclaration ouverte à tout utilisateur connecté. */
  @Roles(...ROLES_CREATION)
  @Post()
  creer(@Body() dto: CreateReclamationDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  /** Tout utilisateur peut poster sur la réclamation qu'il a ouverte. */
  @Throttle({ courant: { ttl: 60_000, limit: 30 } })
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

  /** Déclenchement manuel de l'escalade horaire (ReclamationsService.escaladerReclamationsEchues). */
  @Roles(Role.ADMIN)
  @Post('cron/escalade')
  cronEscalade(@CurrentUser() user: AuthUser) {
    return this.service.cronEscalade(user);
  }
}
