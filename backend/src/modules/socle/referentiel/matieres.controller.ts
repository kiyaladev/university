/** Routes du catalogue des matières. */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../../common/decorators';
import { estChefDeDepartement, exigerPerimetre, filtreDepartement } from '../../../common/perimetre';
import { CreateMatiereDto, MatiereQueryDto, UpdateMatiereDto } from './matieres.dto';
import { MatieresService } from './matieres.service';

/** Filtre de liste : un chef de département ne voit que son département. */
function perimetreMatiere(user: AuthUser, departementId?: string) {
  if (estChefDeDepartement(user)) return filtreDepartement(user);
  return departementId ? { departementId } : {};
}

@ApiTags('Matières')
@ApiBearerAuth()
@Controller('matieres')
export class MatieresController {
  constructor(private readonly service: MatieresService) {}

  // La lecture était ouverte à tout le monde, y compris aux chefs de département
  // d'autres filières ; l'écriture, elle, laissait un chef de département
  // réécrire n'importe quelle UE et en déplacer le rattachement.
  @Get() lister(@Query() query: MatiereQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.lister(query, perimetreMatiere(user, query.departementId));
  }
  @Get(':id') lire(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouverPerimetre(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post()
  creer(@Body() dto: CreateMatiereDto, @CurrentUser() user: AuthUser) {
    exigerPerimetre(user, dto.departementId);
    return this.service.creer(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateMatiereDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierPerimetre(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
