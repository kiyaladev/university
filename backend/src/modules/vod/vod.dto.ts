import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { StatutVOD, TypeRessourceVOD } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateCoursVODDto {
  @IsString() @MaxLength(200) titre: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsOptional() @IsUUID() matiereId?: string;
  @IsOptional() @IsUUID() seanceId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;

  @IsEnum(TypeRessourceVOD)
  type: TypeRessourceVOD;

  /** URL du média (Mux, S3, CDN, ou chemin local). */
  @IsString()
  @MaxLength(1000)
  url: string;

  @IsOptional() @IsString() @MaxLength(1000) thumbnailUrl?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) dureeSecondes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) tailleKo?: number;

  @IsOptional() @IsString() @MaxLength(200_000) transcription?: string;

  @IsOptional() @IsBoolean() public?: boolean;
  @IsOptional() @IsUUID() inscriptionId?: string;
}

export class UpdateCoursVODDto extends PartialType(CreateCoursVODDto) {}

export class ArchiverVODDto {
  @IsOptional() @IsString() @MaxLength(500) motif?: string;
}

export class EnregistrerVueDto {
  @Type(() => Number) @IsInt() @Min(0) positionSecondes: number;
  @Type(() => Number) @IsInt() @Min(0) dureeSecondes: number;
  @IsOptional() @IsBoolean() termine?: boolean;
}

export class VodQueryDto extends QueryDto {
  @IsOptional() @IsEnum(TypeRessourceVOD) type?: TypeRessourceVOD;
  @IsOptional() @IsEnum(StatutVOD) statut?: StatutVOD;
  @IsOptional() @IsUUID() matiereId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  /** Filtre l'onglet « par promotion ». */
  @IsOptional() @IsUUID() inscriptionId?: string;
  @IsOptional() @IsBooleanString() public?: string;
}