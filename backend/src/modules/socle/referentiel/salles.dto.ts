/** DTO des salles. */

import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSalleDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() batiment?: string;
  @IsOptional() @IsInt() @Min(0) capacite?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsInt() @Min(10) rayonMetres?: number;
  @IsOptional() @IsBoolean() actif?: boolean;
}

export class UpdateSalleDto extends PartialType(CreateSalleDto) {}
