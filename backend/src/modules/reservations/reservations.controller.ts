import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  CalendrierQueryDto,
  CreateReservationDto,
  DeciderReservationDto,
  ReservationQueryDto,
  UpdateReservationDto,
} from './reservations.dto';
import { ReservationsService } from './reservations.service';

/**
 * Tout le personnel peut demander une salle pour un événement ; seuls
 * l'administration et la direction la confirment ou la refusent.
 */
const DEMANDEURS = [
  Role.ADMIN,
  Role.SCOLARITE,
  Role.DIRECTION,
  Role.ENSEIGNANT,
  Role.CONTROLEUR,
] as const;

@ApiTags('Réservations de salles')
@ApiBearerAuth()
@Controller('reservations')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.ENSEIGNANT, Role.CONTROLEUR)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get() findAll(@Query() query: ReservationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  /** Vue semaine : réservations + séances de l'emploi du temps sur la grille. */
  @Get('calendrier') calendrier(@Query() query: CalendrierQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.calendrier(query, user);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.consulter(id, user);
  }

  @Roles(...DEMANDEURS)
  @Post() create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(...DEMANDEURS)
  @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(...DEMANDEURS)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Post(':id/decider') decider(
    @Param('id') id: string,
    @Body() dto: DeciderReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.decider(id, dto, user);
  }
}
