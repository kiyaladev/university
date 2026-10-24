import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles, ProtectedDocument } from '../../../common/decorators';
import { CreateTirageDto, ImprimerTirageDto, TirageQueryDto, UpdateStadeTirageDto } from './tirage.dto';
import { TirageService } from './tirage.service';

@ApiTags('Tirage des épreuves')
@ApiBearerAuth()
@Controller('tirage')
export class TirageController {
  constructor(private readonly service: TirageService) {}

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get()
  lister(@Query() query: TirageQueryDto) {
    return this.service.lister(query);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Get(':id')
  lire(@Param('id') id: string) {
    return this.service.trouver(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post()
  creer(@Body() dto: CreateTirageDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  /**
   * PROGRAMME → IMPRIME — vérification obligatoire de l'empreinte source.
   * Si elle ne correspond pas à celle enregistrée à la création, l'impression
   * est refusée : c'est le verrou anti-substitution du module.
   */
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/imprimer')
  imprimer(@Param('id') id: string, @Body() dto: ImprimerTirageDto, @CurrentUser() user: AuthUser) {
    return this.service.imprimer(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/mettre-sous-pli')
  mettreSousPli(@Param('id') id: string, @Body() dto: UpdateStadeTirageDto, @CurrentUser() user: AuthUser) {
    return this.service.mettreSousPli(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/distribuer')
  distribuer(@Param('id') id: string, @Body() dto: UpdateStadeTirageDto, @CurrentUser() user: AuthUser) {
    return this.service.distribuer(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/recuperer')
  recuperer(@Param('id') id: string, @Body() dto: UpdateStadeTirageDto, @CurrentUser() user: AuthUser) {
    return this.service.recuperer(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post(':id/annuler')
  annuler(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.annuler(id, user);
  }

  /**
   * Bordereau A4 — ouvert dans un nouvel onglet (pas d'en-tête Authorization).
   * Le jeton est contrôlé par la garde globale avant l'appel au service.
   */
  @ProtectedDocument(Role.ADMIN, Role.SCOLARITE)
  @Get(':id/imprimer-bordereau')
  async imprimerBordereau(@Param('id') id: string, @Res() res: Response) {
    res.type('html').send(await this.service.imprimerBordereau(id));
  }
}
