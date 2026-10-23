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
  findAll(@Query() query: FiliereQueryDto) {
    return this.service.findAll(query, query.departementId ? { departementId: query.departementId } : {});
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post()
  create(@Body() dto: CreateFiliereDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFiliereDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
