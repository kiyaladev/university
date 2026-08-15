/**
 * Hub de formation continue & certifications — contrats d'entrée.
 * L'inscription publique est payante et sans compte : identité + téléphone
 * Mobile Money (+ matricule INE facultatif pour rattacher la fiche étudiant).
 */
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { StatutFormation } from '@prisma/client';
import { QueryDto } from '../../common/dto';

/** Demande d'inscription à une formation, déposée sans compte (page publique). */
export class InscriptionFormationPubliqueDto {
  @IsString() @MinLength(2) nomComplet: string;
  @IsString() @MinLength(6) telephone: string;
  @IsOptional() @IsEmail() email?: string;
  /** Fiche déjà fichée au registre : le numéro INE « 2026-0004 » suffit. */
  @IsOptional() @IsString() matricule?: string;
  /** Variante machine : identifiant UUID de la fiche, connu du registre. */
  @IsOptional() @IsUUID() etudiantId?: string;
}

export class CreateFormationDto {
  @IsString() @MinLength(3) titre: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categorie?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) prix?: number;
  @IsOptional() @IsString() devise?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) dureeHeures?: number;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsString() lieu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacite?: number;
}

export class UpdateFormationDto extends PartialType(CreateFormationDto) {}

export class FormationQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutFormation) statut?: StatutFormation;
}