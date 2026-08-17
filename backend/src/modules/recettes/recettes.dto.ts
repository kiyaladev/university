import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StatutPaiement, TypeRecette } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateRecetteDto {
  @IsString() numero: string;
  @IsEnum(TypeRecette) type: TypeRecette;
  @IsString() libelle: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() devise?: string;
  @IsDateString() date: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() factureNum?: string;
}

export class UpdateRecetteDto {
  @IsOptional() @IsString() libelle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) montant?: number;
  @IsOptional() @IsString() devise?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() factureNum?: string;
  @IsOptional() @IsEnum(TypeRecette) type?: TypeRecette;
}

export class EncaisserRecetteDto {
  /** Mode d'encaissement ; l'API crée un Paiement REUSSI rattaché. */
  @IsOptional() @IsString() mode?: 'ESPECES' | 'VIREMENT' | 'MOBILE_MONEY';
  @IsOptional() @IsString() operateur?: string;
  @IsOptional() @IsString() nomComplet?: string;
  @IsOptional() @IsString() telephone?: string;
}

export class RecetteQueryDto extends QueryDto {
  @IsOptional() @IsEnum(TypeRecette) type?: TypeRecette;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsEnum(StatutPaiement) paiementStatut?: StatutPaiement;
}
