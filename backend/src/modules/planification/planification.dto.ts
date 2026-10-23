import { PartialType } from '@nestjs/swagger';
import { TypeCours } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateCreneauDto {
  @IsUUID() affectationId: string;

  @IsInt() @Min(1) @Max(7) jourSemaine: number;

  @Matches(HEURE, { message: 'Heure de début attendue au format HH:mm' })
  heureDebut: string;

  @Matches(HEURE, { message: 'Heure de fin attendue au format HH:mm' })
  heureFin: string;

  @IsOptional() @IsEnum(TypeCours) type?: TypeCours;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsBoolean() actif?: boolean;

  /**
   * Période de validité — « chaque lundi 08h-12h, du 1er au 31 janvier ».
   * Laissées vides, elles font courir le créneau sur toute l'année.
   */
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
}

export class UpdateCreneauDto extends PartialType(CreateCreneauDto) {}

export class CreneauQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  /** Lundi de la semaine affichée : masque les créneaux hors période. */
  @IsOptional() @IsDateString() semaineDu?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @Type(() => Number) @IsInt() jourSemaine?: number;
}

/** Génère les séances d'une période à partir des créneaux de l'emploi du temps. */
export class GenerationDto {
  @IsUUID() anneeId: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;

  /** Limiter la génération à certains créneaux (sinon tous les créneaux actifs). */
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) creneauIds?: string[];

  /** Dates fériées / non ouvrées à sauter (YYYY-MM-DD). */
  @IsOptional() @IsArray() @IsString({ each: true }) joursExclus?: string[];
}

export class CreateSeanceDto {
  @IsUUID() affectationId: string;
  @IsDateString() date: string;
  @Matches(HEURE) heureDebut: string;
  @Matches(HEURE) heureFin: string;
  @IsOptional() @IsEnum(TypeCours) type?: TypeCours;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsString() thematique?: string;
}

/** Une clé UUID créée sur l’appareil rend le rejeu hors ligne idempotent. */
export class SeanceHorsLigneDto extends CreateSeanceDto {
  @IsUUID() idClient: string;
}

export class SyncSeancesDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true })
  @Type(() => SeanceHorsLigneDto)
  seances: SeanceHorsLigneDto[];
}

export class UpdateSeanceDto extends PartialType(CreateSeanceDto) {}

export class SeanceQueryDto extends QueryDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsUUID() matiereId?: string;

  /** `1` : uniquement les séances non encore contrôlées. */
  @IsOptional() @IsString() nonControlees?: string;
}

export class AnnulerSeanceDto {
  @IsOptional() @IsString() motif?: string;
}

/** Un planificateur attribue une séance à un contrôleur ou retire l’affectation. */
export class AffecterControleurDto {
  @IsOptional() @IsUUID() controleurId?: string | null;
}

/** Affectation groupée des séances non attribuées d’une période, par établissement/département. */
export class AffecterTourneeDto {
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @IsUUID() controleurId: string;
  @IsOptional() @IsUUID() departementId?: string;
}
