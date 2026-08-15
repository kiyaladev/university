/** Schémas de validation du module Scolarité — messages en français, validés
 *  par class-validator à la volée (ValidationPipe global). */
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { StatutEvaluation, SessionDeliberation, TypeEvaluation } from '@prisma/client';
import { QueryDto } from '../../common/dto';

// ----------------------------------------------------------------------
// Évaluations
// ----------------------------------------------------------------------

export class EvaluationQueryDto extends QueryDto {
  @IsOptional() @IsUUID() @Type(() => String) anneeId?: string;
  @IsOptional() @IsUUID() @Type(() => String) promotionId?: string;
  @IsOptional() @IsUUID() @Type(() => String) matiereId?: string;
  @IsOptional() @IsEnum(TypeEvaluation) type?: TypeEvaluation;
  @IsOptional() @IsEnum(StatutEvaluation) statut?: StatutEvaluation;
}

export class CreateEvaluationDto {
  @IsString() @IsNotEmpty({ message: 'L’intitulé est obligatoire' }) @MaxLength(160)
  intitule: string;

  @IsEnum(TypeEvaluation, { message: 'Type d’évaluation inconnu' })
  type: TypeEvaluation = 'CC';

  @IsOptional() @IsNumber() @Min(0.1)
  coefficient?: number;

  @IsUUID() matiereId: string;
  @IsUUID() anneeId: string;
  @IsUUID() promotionId: string;

  @IsOptional() @IsInt() @Min(1) @Max(2) semestre?: number = 1;

  @IsOptional() @IsDateString() date?: string;
}

export class UpdateEvaluationDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'L’intitulé ne peut pas être vide' }) @MaxLength(160)
  intitule?: string;

  @IsOptional() @IsEnum(TypeEvaluation) type?: TypeEvaluation;

  @IsOptional() @IsNumber() @Min(0.1) coefficient?: number;

  @IsOptional() @IsUUID() matiereId?: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() promotionId?: string;

  @IsOptional() @IsInt() @Min(1) @Max(2) semestre?: number;

  @IsOptional() @IsDateString() date?: string;
}

// ----------------------------------------------------------------------
// Notes
// ----------------------------------------------------------------------

export class NoteQueryDto extends QueryDto {
  @IsOptional() @IsUUID() evaluationId?: string;
}

export class NoteLigneDto {
  @IsUUID() inscriptionId: string;

  /** Note /20 ; absente si l'étudiant n'est pas noté. */
  @IsOptional() @IsNumber() @Min(0, { message: 'Une note ne peut pas être négative' }) @Max(20, { message: 'Une note ne peut pas dépasser 20' })
  note?: number;

  @IsOptional() @IsBoolean()
  present?: boolean;
}

export class SaisieNotesDto {
  @IsUUID() @Type(() => String) evaluationId: string;

  @IsArray() @ValidateNested({ each: true })  @Type(() => NoteLigneDto)
  notes: NoteLigneDto[];
}

// ----------------------------------------------------------------------
// Délibérations
// ----------------------------------------------------------------------

export class DeliberationQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
}

export class CreateDeliberationDto {
  @IsUUID() anneeId: string;
  @IsUUID() promotionId: string;

  @IsOptional() @IsEnum(SessionDeliberation, { message: 'Session inconnue' })
  session?: SessionDeliberation = 'NORMALE';
}