import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StatutExamen, TypeExamen } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateExamenDto {
  @IsString() intitule: string;
  @IsEnum(TypeExamen) type: TypeExamen;
  @IsUUID() matiereId: string;
  @IsUUID() promotionId: string;
  @IsUUID() anneeId: string;
  @IsDateString() dateExamen: string;
  @IsString() heureDebut: string;
  @IsString() heureFin: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsInt() @Min(0) nbInscrits?: number;
  @IsString() codeExamen: string;
  @IsOptional() @IsUUID() surveillantId?: string;
}

export class UpdateExamenStatutDto {
  @IsEnum(StatutExamen) statut: StatutExamen;
}

export class ScanExamenDto {
  @IsUUID() examenId: string;
  /** Référence scannée : QR resto, matricule ou id étudiant. */
  @IsString() reference: string;
  @IsOptional() @IsUUID() scanneurId?: string;
}

export class ExamenQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutExamen) statut?: StatutExamen;
  @IsOptional() @IsEnum(TypeExamen) type?: TypeExamen;
  @IsOptional() @IsUUID() matiereId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
}
