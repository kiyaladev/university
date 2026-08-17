import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

export class CreateCarteEtudianteDto {
  @IsUUID()
  etudiantId: string;

  @IsOptional()
  @IsDateString()
  dateValidite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  /** Code PIN initialisé directement par la scolarité (cas exceptionnel). */
  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'Le NIP doit comporter 4 à 6 chiffres.' })
  nip?: string;
}

export class UpdateCarteEtudianteDto extends PartialType(CreateCarteEtudianteDto) {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  motifRevocation?: string;
}

export class RevoquerCarteDto {
  @IsString()
  @MinLength(3, { message: 'Indiquez un motif de révocation (3 caractères min.)' })
  @MaxLength(500)
  motif: string;
}

export class DefinirNipDto {
  @Matches(/^\d{4,6}$/, { message: 'Le NIP doit comporter 4 à 6 chiffres.' })
  nip: string;
}

export class VerifierNipDto {
  @Matches(/^\d{4,6}$/, { message: 'Le NIP doit comporter 4 à 6 chiffres.' })
  nip: string;
}

export class VerifierCartePubliqueDto {
  @IsString()
  carte: string;

  @IsString()
  k: string;
}

export class CarteQueryDto extends QueryDto {
  @IsOptional()
  @IsUUID()
  etudiantId?: string;
}