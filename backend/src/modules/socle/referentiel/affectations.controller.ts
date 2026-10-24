/** Routes des affectations d’enseignants. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { AffectationQueryDto, CreateAffectationDto, UpdateAffectationDto } from './affectations.dto';
import { AffectationsService } from './affectations.service';

@ApiTags('Affectations')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
@Controller('affectations')
export class AffectationsController {
  constructor(private readonly service: AffectationsService) {}

  @Get() lister(@Query() query: AffectationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.lister({ ...query, search: undefined }, this.service.where(query, user));
  }
  @Get(':id') lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouverPerimetre(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  creer(@Body() dto: CreateAffectationDto, @CurrentUser() user: AuthUser) {
    return this.service.creerPour(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateAffectationDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierPour(id, dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
