/**
 * Tableau de bord du Rectorat — contrats d'entrée.
 * Pas de DTO métier lourd : tout passe en query params simples.
 */
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { QueryDto } from '../../common/dto';

export class RectoratQueryDto extends QueryDto {
  @IsOptional()
  @IsUUID()
  anneeId?: string;
}

export class GenererBilanDto {
  @IsUUID()
  @IsString()
  anneeId: string;
}
