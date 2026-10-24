/** Routes des départements. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { QueryDto } from '../../../common/dto';
import { AuthUser, CurrentUser, Public, Roles } from '../../../common/decorators';
import { CreateDepartementDto, UpdateDepartementDto } from './departements.dto';
import { DepartementsService } from './departements.service';
import { GESTION, LECTURE_STRUCTURE } from './structure.roles';

@ApiTags('Départements')
@ApiBearerAuth()
@Controller('departements')
export class DepartementsController {
  constructor(private readonly service: DepartementsService) {}

  @Roles(...LECTURE_STRUCTURE)
  @Get()
  lister(@Query() query: QueryDto) {
    return this.service.lister(query);
  }
  @Public()
  @Get('public')
  listePublique() {
    return this.service.listePublique();
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id')
  lire(@Param('id') id: string) {
    return this.service.lire(id);
  }
  @Roles(...GESTION)
  @Post()
  creer(@Body() dto: CreateDepartementDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateDepartementDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
