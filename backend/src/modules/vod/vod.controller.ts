import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { VodService } from './vod.service';
import {
  ArchiverVODDto,
  CreateCoursVODDto,
  EnregistrerVueDto,
  UpdateCoursVODDto,
  VodQueryDto,
} from './vod.dto';

/**
 * Plateforme VOD — cours filmés ou retranscrits.
 *
 * - Lecture : ouverte à tout utilisateur connecté (énumère aussi les
 *   ressources publiques côté étudiant).
 * - Écriture / publication / archivage : ADMIN et ENSEIGNANT.
 * - Enregistrement de vue : tout le monde (mêmes anonymes qui détiennent
 *   le lien, mais leur IP est tracée).
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
  recherche(@Query('q') q: string) {
    if (!q || q.length < 2) return [];
    return this.service.recherche(q);
  }

  @Get()
  liste(@Query() query: VodQueryDto) {
    return this.service.liste(query);
  }

  @Get(':id')
  trouver(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.service.statistiques(id);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Post()
  creer(@Body() dto: CreateCoursVODDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateCoursVODDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Post(':id/publier')
  publier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publier(id, user);
  }

  @Roles(Role.ADMIN, Role.ENSEIGNANT)
  @Post(':id/archiver')
  archiver(
    @Param('id') id: string,
    @Body() dto: ArchiverVODDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.archiver(id, dto, user);
  }

  /**
   * Enregistrement d'une vue (signaux de progression). La route est ouverte
   * à tout le monde : la page de lecteur, même déconnectée d'un étudiant,
   * peut signaler sa progression (compteur global uniquement, pas de ligne
   * étiquetée par un etudiantId si le visiteur n'est pas connu).
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