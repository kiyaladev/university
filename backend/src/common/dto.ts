import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Paramètres de liste communs à tous les référentiels. */
export class QueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  /** `all=1` : raccourci borné à 1 000 lignes pour les listes déroulantes. */
  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  all?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
