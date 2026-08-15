import { PartialType } from '@nestjs/swagger';
import { StatutReservationSalle } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateReservationDto {
  @IsUUID() salleId: string;

  @IsString() motif: string;

  @IsOptional() @IsString() organisme?: string;

  @IsDateString() dateJour: string;

  @Matches(HEURE, { message: 'Heure de début attendue au format HH:mm' })
  heureDebut: string;

  @Matches(HEURE, { message: 'Heure de fin attendue au format HH:mm' })
  heureFin: string;

  @IsOptional() @IsString() responsable?: string;
}

export class UpdateReservationDto extends PartialType(CreateReservationDto) {}

/** Décision prise par l'administration : confirmer ou refuser proprement. */
export class DeciderReservationDto {
  @IsIn(['CONFIRMEE', 'REFUSEE']) statut: 'CONFIRMEE' | 'REFUSEE';

  @IsOptional() @IsString() motif?: string;
}

export class ReservationQueryDto extends QueryDto {
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsDateString() dateJour?: string;
  @IsOptional() @IsEnum(StatutReservationSalle) statut?: StatutReservationSalle;
}

/** Fenêtre de la vue semaine : du lundi au dimanche, toutes les salles. */
export class CalendrierQueryDto {
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @IsOptional() @IsUUID() salleId?: string;
}