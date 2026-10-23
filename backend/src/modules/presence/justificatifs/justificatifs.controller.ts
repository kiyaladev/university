import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { CreateJustificatifDto, JustificatifQueryDto, TraiterJustificatifDto } from './justificatifs.dto';
import { JustificatifsService } from './justificatifs.service';

@ApiTags('Justificatifs')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
@Controller('justificatifs')
export class JustificatifsController {
  constructor(private readonly service: JustificatifsService) {}

  @Get() liste(@Query() query: JustificatifQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOnePour(id, user);
  }

  /** Déposé par l'administration pour le compte de l'enseignant, sur pièce. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  deposer(@Body() dto: CreateJustificatifDto, @CurrentUser() user: AuthUser) {
    return this.service.deposer(dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.CHEF_DEPARTEMENT)
  @Put(':id/traiter')
  traiter(@Param('id') id: string, @Body() dto: TraiterJustificatifDto, @CurrentUser() user: AuthUser) {
    return this.service.traiter(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
