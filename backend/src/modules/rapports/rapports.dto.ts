import { StatutEnseignant } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class RapportQueryDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statutEnseignant?: StatutEnseignant;
}
