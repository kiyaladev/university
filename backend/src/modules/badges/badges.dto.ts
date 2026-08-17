import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

export const TYPES_BADGE = ['VISITEUR', 'INTERVENANT', 'TECHNICIEN', 'VIP'] as const;
export type TypeBadge = (typeof TYPES_BADGE)[number];

export class CreateBadgeDto {
  @IsIn(TYPES_BADGE)
  type: TypeBadge;

  @IsString()
  @MinLength(1)
  nom: string;

  @IsString()
  @MinLength(1)
  prenom: string;

  @IsOptional() @IsString() @MaxLength(160) fonction?: string;
  @IsOptional() @IsString() @MaxLength(160) organisation?: string;
  @IsOptional() @IsString() @MaxLength(40) telephone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(60) pieceIdentite?: string;
  @IsOptional() @IsString() @MaxLength(60) numeroPiece?: string;

  @IsDateString()
  dateValidite: string;

  /** Liste CSV des zones autorisées (optionnel). */
  @IsOptional() @IsString() @MaxLength(500) zonesAccess?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string;
}

export class UpdateBadgeDto extends PartialType(CreateBadgeDto) {
  @IsOptional() @IsString() @MaxLength(500) motif?: string;
}

export class AnnulerBadgeDto {
  @IsString() @MinLength(3) @MaxLength(500)
  motif: string;
}

export class RallongerBadgeDto {
  @IsDateString()
  dateValidite: string;
}

export class BadgeQueryDto extends QueryDto {
  @IsOptional() @IsIn(TYPES_BADGE) type?: TypeBadge;
  @IsOptional() @IsIn(['ACTIF', 'EXPIRE', 'ANNULE']) statut?: string;
}