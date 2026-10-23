/** Routes des salles. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { QueryDto } from '../../../common/dto';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { CreateSalleDto, UpdateSalleDto } from './salles.dto';
import { SallesService } from './salles.service';

@ApiTags('Salles')
@ApiBearerAuth()
@Controller('salles')
export class SallesController {
  constructor(private readonly service: SallesService) {}

  @Get() findAll(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listePour(query, user);
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.fichePour(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  create(@Body() dto: CreateSalleDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSalleDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/qr')
  regenerer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.regenererQr(id, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
