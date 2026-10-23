import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, DocumentScope, Roles } from '../../common/decorators';
import { RapportsService } from './rapports.service';
import { RapportQueryDto, perimetrePresence } from './rapports.dto';

@ApiTags('Rapports')
@ApiBearerAuth()
@Controller('rapports')
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
export class RapportsController {
  constructor(private readonly service: RapportsService) {}

  @Get('dashboard') dashboard(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.dashboard(perimetrePresence(query, user));
  }

  @Get('presence-enseignants') presence(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.presenceEnseignants(perimetrePresence(query, user));
  }

  /** Statistiques par salle : le terrain du contrôleur. */
  @Get('salles') salles(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.parSalle(perimetrePresence(query, user));
  }

  @Get('volume-horaire') volume(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.volumeHoraire(perimetrePresence(query, user));
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE)
  @Get('etat-paiement')
  paiement(@Query() query: RapportQueryDto, @CurrentUser() _user: AuthUser) {
    return this.service.etatPaiement(query);
  }

  @Get('registre') registre(@Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    const inclureObservations =
      user.role === Role.ADMIN || user.role === Role.DIRECTION || user.role === Role.SCOLARITE;
    return this.service.registre(perimetrePresence(query, user), false, inclureObservations);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
  @DocumentScope('enseignant', { [Role.ENSEIGNANT]: 'id', [Role.CHEF_DEPARTEMENT]: 'departementId' })
  @Get('fiche-enseignant/:id')
  fiche(@Param('id') id: string, @Query() query: RapportQueryDto, @CurrentUser() user: AuthUser) {
    const inclureObservations =
      user.role === Role.ADMIN || user.role === Role.DIRECTION || user.role === Role.SCOLARITE;
    return this.service.ficheEnseignant(id, perimetrePresence(query, user), inclureObservations);
  }

  /** Fiche de l'enseignant connecté. */
  @Roles(Role.ENSEIGNANT)
  @Get('ma-fiche')
  maFiche(@CurrentUser() user: AuthUser, @Query() query: RapportQueryDto) {
    return this.service.ficheEnseignant(user.enseignantId ?? '—', query);
  }
}
