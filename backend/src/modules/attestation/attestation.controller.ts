import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { AttestationService } from './attestation.service';
import {
  DefinirCodePinDto,
  EnrolerAppareilDto,
  EnrolerEmpreinteDto,
} from './attestation.dto';

/**
 * Moyens d'attestation d'un enseignant. Ils sont administrés par
 * l'établissement : l'enseignant ne définit ni son code, ni son empreinte, et
 * n'atteste jamais depuis son propre appareil.
 */
const GESTION = [Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.DIRECTION] as const;

@ApiTags('Attestation enseignant')
@ApiBearerAuth()
@Controller('attestation')
export class AttestationController {
  constructor(private readonly service: AttestationService) {}

  /** Consulté par l'écran de pointage pour savoir quoi proposer au contrôleur. */
  @Get('enseignants/:id/moyens')
  moyens(@Param('id') id: string) {
    return this.service.moyens(id);
  }

  @Roles(...GESTION)
  @Put('enseignants/:id/code-pin')
  definirPin(
    @Param('id') id: string,
    @Body() dto: DefinirCodePinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.definirCodePin(id, dto, user);
  }

  @Roles(...GESTION)
  @Post('enseignants/:id/code-pin/reinitialiser')
  reinitialiserPin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.reinitialiserCodePin(id, user);
  }

  @Roles(...GESTION)
  @Delete('enseignants/:id/code-pin')
  supprimerPin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerCodePin(id, user);
  }

  @Roles(...GESTION)
  @Put('enseignants/:id/empreinte')
  enrolerEmpreinte(
    @Param('id') id: string,
    @Body() dto: EnrolerEmpreinteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.enrolerEmpreinte(id, dto, user);
  }

  @Roles(...GESTION)
  @Delete('enseignants/:id/empreinte')
  supprimerEmpreinte(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerEmpreinte(id, user);
  }

  // ------------------------------------------------------------- appareils

  /**
   * Un appareil de contrôle réclame sa clé de signature. Le contrôleur doit
   * être connecté : c'est sa session qui autorise l'appareil, et le lien reste
   * tracé pour qu'on sache quel téléphone révoquer.
   */
  @Roles(Role.CONTROLEUR, Role.ADMIN, Role.DIRECTION, Role.CHEF_DEPARTEMENT, Role.SCOLARITE)
  @Post('appareils')
  enrolerAppareil(@Body() dto: EnrolerAppareilDto, @CurrentUser() user: AuthUser) {
    return this.service.enrolerAppareil(dto.libelle, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Get('appareils')
  listerAppareils() {
    return this.service.listerAppareils();
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Delete('appareils/:id')
  revoquerAppareil(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.revoquerAppareil(id, user);
  }

  /** Gabarit transmis à la passerelle pour la comparaison en salle. */
  @Roles(Role.CONTROLEUR, Role.ADMIN, Role.DIRECTION, Role.CHEF_DEPARTEMENT, Role.SCOLARITE)
  @Get('enseignants/:id/gabarit')
  gabarit(@Param('id') id: string) {
    return this.service.gabarit(id);
  }
}
