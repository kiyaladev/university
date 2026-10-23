/** Routes des promotions. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { CreatePromotionDto, PromotionQueryDto, UpdatePromotionDto } from './promotions.dto';
import { PromotionsService } from './promotions.service';
import { GESTION, LECTURE_STRUCTURE } from './structure.roles';

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Roles(...LECTURE_STRUCTURE)
  @Get()
  findAll(@Query() query: PromotionQueryDto) {
    return this.service.findAll(query, {
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.filiereId ? { filiereId: query.filiereId } : {}),
      ...(query.niveau ? { niveau: query.niveau } : {}),
    });
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post()
  create(@Body() dto: CreatePromotionDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
