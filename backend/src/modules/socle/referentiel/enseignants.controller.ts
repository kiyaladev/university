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

  @Get() findAll(@Query() query: EnseignantQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listePour(query, user);
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.detailPour(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  create(@Body() dto: CreateEnseignantDto, @CurrentUser() user: AuthUser) {
    return this.service.creerPour(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEnseignantDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierPour(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
