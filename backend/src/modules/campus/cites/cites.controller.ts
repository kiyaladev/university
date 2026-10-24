import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import {
  AttributionQueryDto,
  ChambreQueryDto,
  CreateAttributionDto,
  CreateChambreDto,
  CreateResidenceDto,
  DeciderAttributionDto,
  ResidenceQueryDto,
  RetirerAttributionDto,
  UpdateChambreDto,
  UpdateResidenceDto,
} from './cites.dto';
import { AttributionsService, ChambresService, ResidencesService } from './cites.service';

/** Parc : les résidences sont gérées par l'administration avec la scolarité
 *  et la direction ; leur structure n'est supprimable que par un administrateur. */
@ApiTags('Cités universitaires')
@ApiBearerAuth()
@Controller('residences')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
export class ResidencesController {
  constructor(private readonly service: ResidencesService) {}

  @Get() lister(@Query() query: ResidenceQueryDto) {
    return this.service.lister(query);
  }

  @Get(':id') lire(@Param('id') id: string) {
    return this.service.lire(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateResidenceDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateResidenceDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}

@ApiTags('Cités universitaires')
@ApiBearerAuth()
@Controller('chambres')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
export class ChambresController {
  constructor(private readonly service: ChambresService) {}

  @Get() lister(@Query() query: ChambreQueryDto) {
    return this.service.lister(query, {
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.categorie ? { categorie: query.categorie } : {}),
    });
  }

  @Get(':id') lire(@Param('id') id: string) {
    return this.service.lire(id);
  }

  /** La structure du parc (chambres, loyers) relève de la direction. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateChambreDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateChambreDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}

@ApiTags('Cités universitaires')
@ApiBearerAuth()
@Controller('attributions-logement')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
export class AttributionsController {
  constructor(private readonly service: AttributionsService) {}

  @Get() lister(@Query() query: AttributionQueryDto) {
    return this.service.lister(query);
  }

  @Get(':id') lire(@Param('id') id: string) {
    return this.service.lire(id);
  }

  /** La demande est posée par la scolarité ou la direction, sur pièce. */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post()
  creer(@Body() dto: CreateAttributionDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  /** Seul le jury (direction) tranche — jamais la demande elle-même. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Put(':id/decider')
  decider(@Param('id') id: string, @Body() dto: DeciderAttributionDto, @CurrentUser() user: AuthUser) {
    return this.service.decider(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Put(':id/retirer')
  retirer(@Param('id') id: string, @Body() dto: RetirerAttributionDto, @CurrentUser() user: AuthUser) {
    return this.service.retirer(id, dto, user);
  }
}
