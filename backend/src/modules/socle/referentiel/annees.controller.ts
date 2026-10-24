/** Routes des années académiques. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { QueryDto } from '../../../common/dto';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { CreateAnneeDto, UpdateAnneeDto } from './annees.dto';
import { AnneesService } from './annees.service';

@ApiTags('Années académiques')
@ApiBearerAuth()
@Controller('annees')
export class AnneesController {
  constructor(private readonly service: AnneesService) {}

  @Get() lister(@Query() query: QueryDto) {
    return this.service.lister(query);
  }

  @Get('active') active() {
    return this.service.active();
  }

  @Get(':id') lire(@Param('id') id: string) {
    return this.service.lire(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateAnneeDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateAnneeDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
