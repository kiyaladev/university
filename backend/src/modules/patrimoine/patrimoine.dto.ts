/**
 * Patrimoine — contrats d'entrée.
 * Catégories : CRUD léger. Équipements : champs obligatoires, réparations
 * en sous-formulaires.
 */
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { QueryDto } from '../../common/dto';

export class CreateCategorieDto {
  @IsString()
  @MinLength(2)
  code: string;

  @IsString()
  @MinLength(2)
  libelle: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dureeAmortissement?: number;
}

export class UpdateCategorieDto extends PartialType(CreateCategorieDto) {}

export class CreateEquipementDto {
  @IsString()
  @MinLength(2)
  numeroSerie: string;

  @IsString()
  @MinLength(2)
  libelle: string;

  @IsUUID()
  categorieId: string;

  @IsOptional()
  @IsUUID()
  departementId?: string;

  @IsOptional()
  @IsUUID()
  salleId?: string;

  @IsOptional()
  @IsDateString()
  dateAcquisition?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valeurAcquisition?: number;

  @IsString()
  @MinLength(2)
  numeroInventaire: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  obsolescenceMois?: number;

  @IsOptional()
  @IsBooleanString()
  actif?: string;
}

export class UpdateEquipementDto extends PartialType(CreateEquipementDto) {}

export class EquipementQueryDto extends QueryDto {
  @IsOptional()
  @IsUUID()
  categorieId?: string;

  @IsOptional()
  @IsUUID()
  departementId?: string;

  @IsOptional()
  @IsBooleanString()
  actif?: string;

  @IsOptional()
  @IsBooleanString()
  enReparation?: string;
}

export class DeclarationReparationDto {
  @IsString()
  @MinLength(5)
  description: string;

  @IsOptional()
  @IsString()
  prestataire?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cout?: number;

  @IsOptional()
  @IsDateString()
  dateResolution?: string;
}

export class ResolutionReparationDto {
  @IsOptional()
  @IsString()
  noteResolution?: string;
}
