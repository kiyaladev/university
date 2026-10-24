/** Routes des filières. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { CreateFiliereDto, FiliereQueryDto, UpdateFiliereDto } from './filieres.dto';
import { FilieresService } from './filieres.service';
import { GESTION, LECTURE_STRUCTURE } from './structure.roles';

@ApiTags('Filières')
@ApiBearerAuth()
@Controller('filieres')
export class FilieresController {
  constructor(private readonly service: FilieresService) {}

  @Roles(...LECTURE_STRUCTURE)
  @Get()
  lister(@Query() query: FiliereQueryDto) {
    return this.service.lister(query, query.departementId ? { departementId: query.departementId } : {});
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id')
  lire(@Param('id') id: string) {
    return this.service.lire(id);
  }
  @Roles(...GESTION)
  @Post()
  creer(@Body() dto: CreateFiliereDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateFiliereDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
