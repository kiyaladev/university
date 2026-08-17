import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  CreateRecetteDto,
  EncaisserRecetteDto,
  RecetteQueryDto,
  UpdateRecetteDto,
} from './recettes.dto';
import { RecettesService } from './recettes.service';

@ApiTags('Recettes externes')
@ApiBearerAuth()
@Controller('recettes')
export class RecettesController {
  constructor(private readonly service: RecettesService) {}

  /**
   * Déclaré avant `:id` pour ne pas être capturé par la route générique.
   * Réservé ADMIN + DIRECTION — KPIs de la régie.
   */
  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get()
  liste(@Query() query: RecetteQueryDto) {
    return this.service.liste(query);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateRecetteDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body() dto: UpdateRecetteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  /**
   * Encaissement : crée un Paiement REUSSI rattaché. Réservé ADMIN +
   * SCOLARITE (régie). Une recette déjà rattachée à un paiement est refusée.
   */
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/encaisser')
  encaisser(
    @Param('id') id: string,
    @Body() dto: EncaisserRecetteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.encaisser(id, dto, user);
  }
}
