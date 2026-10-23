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

  @Get() findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }

  @Get('active') active() {
    return this.service.active();
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  create(@Body() dto: CreateAnneeDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnneeDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
