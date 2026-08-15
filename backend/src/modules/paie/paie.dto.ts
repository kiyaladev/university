import { IsBooleanString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StatutPaie } from '@prisma/client';
import { QueryDto } from '../../common/dto';

/** Création manuelle d'une feuille de paie mensuelle. Le libellé
 *  ("Janvier 2026") et la période (1er … fin de mois) sont dérivés du couple
 *  mois/année — la cohérence ne dépend de personne. */
export class CreateFeuillePaieDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mois: number;

  @Type(() => Number)
  @IsInt()
  @Min(2010)
  @Max(2100)
  annee: number;
}

/** Liste paginée des feuilles : filtres par statut, année et mois. */
export class FeuilleQueryDto extends QueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  annee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mois?: number;

  @IsOptional()
  @IsEnum(StatutPaie)
  statut?: StatutPaie;
}

/** Options du recalcul : `tous=1` étend le calcul aux enseignants non vacataires. */
export class CalculerFeuilleDto {
  @IsOptional()
  @IsBooleanString()
  tous?: string;
}