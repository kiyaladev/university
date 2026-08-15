import {
  Body,
  Controller,
  Delete,
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
import {
  AttributionsService,
  ChambresService,
  ResidencesService,
} from './cites.service';

/** Parc : les résidences sont gérées par l'administration avec la scolarité
 *  et la direction ; leur structure n'est supprimable que par un administrateur. */
@ApiTags('Cités universitaires')
@ApiBearerAuth()
@Controller('residences')
export class ResidencesController {
  constructor(private readonly service: ResidencesService) {}

  @Get() findAll(@Query() query: ResidenceQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post() create(@Body() dto: CreateResidenceDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateResidenceDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@ApiTags('Cités universitaires')
@ApiBearerAuth()
@Controller('chambres')
export class ChambresController {
  constructor(private readonly service: ChambresService) {}

  @Get() findAll(@Query() query: ChambreQueryDto) {
    return this.service.findAll(query, {
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.categorie ? { categorie: query.categorie } : {}),
    });
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** La structure du parc (chambres, loyers) relève de la direction. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post() create(@Body() dto: CreateChambreDto) {
    return this.service.creer(dto);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateChambreDto) {
    return this.service.modifier(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@ApiTags('Cités universitaires')
@ApiBearerAuth()
@Controller('attributions-logement')
export class AttributionsController {
  constructor(private readonly service: AttributionsService) {}

  @Get() liste(@Query() query: AttributionQueryDto) {
    return this.service.liste(query);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** La demande est posée par la scolarité ou la direction, sur pièce. */
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION)
  @Post() creer(@Body() dto: CreateAttributionDto) {
    return this.service.creer(dto);
  }

  /** Seul le jury (direction) tranche — jamais la demande elle-même. */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Put(':id/decider') decider(
    @Param('id') id: string,
    @Body() dto: DeciderAttributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.decider(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Put(':id/retirer') retirer(
    @Param('id') id: string,
    @Body() dto: RetirerAttributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.retirer(id, dto, user);
  }
}