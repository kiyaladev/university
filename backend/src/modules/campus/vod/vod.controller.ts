import { Body, Controller, Get, Ip, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { VodService } from './vod.service';
import { ArchiverVODDto, CreateCoursVODDto, EnregistrerVueDto, UpdateCoursVODDto, VodQueryDto } from './vod.dto';

/**
 * Plateforme VOD — cours filmés ou retranscrits.
 *
 * - Lecture : ouverte à tout utilisateur connecté (énumère aussi les
 *   ressources publiques côté étudiant).
 * - Écriture / publication / archivage : ADMIN et ENSEIGNANT.
 * - Enregistrement de vue : utilisateurs connectés, dans leur périmètre de lecture.
 * - Stats : ADMIN/ENSEIGNANT, avec liste des dernières vues.
 *
 * Routes « /ma-collecte », « /recherche » et « :id/vue » déclarées avant
 * `:id` pour ne pas être capturées comme identifiants.
 */
@ApiTags('VOD')
@ApiBearerAuth()
@Controller('vod')
export class VodController {
  constructor(private readonly service: VodService) {}

  /** Catalogue de l'étudiant : ce qu'il a accès via ses inscriptions + public. */
  @Roles(Role.ETUDIANT)
  @Get('ma-collecte')
  maCollecte(@CurrentUser() user: AuthUser) {
    return this.service.maCollecte(user);
  }

  /** Recherche plein texte : titre, description, transcription. */
  @Get('recherche')
  recherche(@Query('q') q: string, @CurrentUser() user: AuthUser) {
    if (!q || q.length < 2) return [];
    return this.service.recherche(q, user);
  }

  @Get()
  liste(@Query() query: VodQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Get(':id')
  trouver(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouverPour(id, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Get(':id/stats')
  stats(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.statistiques(id, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Post()
  creer(@Body() dto: CreateCoursVODDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateCoursVODDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Post(':id/publier')
  publier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publier(id, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Post(':id/archiver')
  archiver(@Param('id') id: string, @Body() dto: ArchiverVODDto, @CurrentUser() user: AuthUser) {
    return this.service.archiver(id, dto, user);
  }

  /**
   * Enregistrement d'une vue pour l'utilisateur connecté autorisé à lire.
   * Le service impose l'identité étudiante du jeton et recontrôle l'accès
   * dans la transaction ; aucune identité de lecteur n'est acceptée du corps.
   */
  @Post(':id/vue')
  enregistrerVue(
    @Param('id') id: string,
    @Body() dto: EnregistrerVueDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.service.enregistrerVue(id, dto, user, ip);
  }
}
