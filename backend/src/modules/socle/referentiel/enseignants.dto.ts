/** DTO des enseignants. */

import { PartialType } from '@nestjs/swagger';
import { StatutEnseignant } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { QueryDto } from '../../../common/dto';

export class CreateEnseignantDto {
  @IsString() matricule: string;
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statut?: StatutEnseignant;
  @IsOptional() @IsNumber() @Min(0) tauxHoraire?: number;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
}

export class UpdateEnseignantDto extends PartialType(CreateEnseignantDto) {}

export class EnseignantQueryDto extends QueryDto {
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statut?: StatutEnseignant;
}
