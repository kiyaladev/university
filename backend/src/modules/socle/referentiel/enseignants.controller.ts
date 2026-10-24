/** Routes de l’annuaire des enseignants. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles, CurrentUser } from '../../../common/decorators';
import { AuthUser } from '../../../common/decorators';
import { CreateEnseignantDto, EnseignantQueryDto, UpdateEnseignantDto } from './enseignants.dto';
import { EnseignantsService } from './enseignants.service';

@ApiTags('Enseignants')
@ApiBearerAuth()
@Controller('enseignants')
export class EnseignantsController {
  constructor(private readonly service: EnseignantsService) {}

  @Get() lister(@Query() query: EnseignantQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listePour(query, user);
  }
  @Get(':id') lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.detailPour(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  creer(@Body() dto: CreateEnseignantDto, @CurrentUser() user: AuthUser) {
    return this.service.creerPour(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateEnseignantDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierPour(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
