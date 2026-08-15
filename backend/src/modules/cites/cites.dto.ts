import { PartialType } from '@nestjs/swagger';
import {
  CategorieChambre,
  StatutAttributionLogement,
  StatutChambre,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

// ---------------------------------------------------------------------------
// Résidences
// ---------------------------------------------------------------------------

export class CreateResidenceDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsInt() @Min(0) capacite?: number;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
}

export class UpdateResidenceDto extends PartialType(CreateResidenceDto) {}

export class ResidenceQueryDto extends QueryDto {
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
}

// ---------------------------------------------------------------------------
// Chambres
// ---------------------------------------------------------------------------

export class CreateChambreDto {
  @IsString() code: string;
  @IsUUID() residenceId: string;
  @IsOptional() @IsEnum(CategorieChambre) categorie?: CategorieChambre;
  @IsOptional() @IsInt() @Min(1) lits?: number;
  @IsOptional() @IsNumber() @Min(0) loyer?: number;
  @IsOptional() @IsString() devise?: string;
  @IsOptional() @IsEnum(StatutChambre) statut?: StatutChambre;
}

export class UpdateChambreDto extends PartialType(CreateChambreDto) {}

export class ChambreQueryDto extends QueryDto {
  @IsOptional() @IsUUID() residenceId?: string;
  @IsOptional() @IsEnum(StatutChambre) statut?: StatutChambre;
  @IsOptional() @IsEnum(CategorieChambre) categorie?: CategorieChambre;
}

// ---------------------------------------------------------------------------
// Attributions de logement
// ---------------------------------------------------------------------------

export class CreateAttributionDto {
  @IsUUID() chambreId: string;
  @IsUUID() etudiantId: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) critereScore?: number;
  @IsOptional() @IsString() justificatif?: string;
}

/** Décision du jury : seule une demande EN_ATTENTE peut être tranchée. */
export class DeciderAttributionDto {
  @IsIn([StatutAttributionLogement.ACCORDEE, StatutAttributionLogement.REFUSEE])
  statut: StatutAttributionLogement;
  @IsOptional() @IsString() commentaire?: string;
}

export class RetirerAttributionDto {
  @IsOptional() @IsString() motif?: string;
}

export class AttributionQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutAttributionLogement) statut?: StatutAttributionLogement;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() residenceId?: string;
  @IsOptional() @IsUUID() etudiantId?: string;
}