/** DTO des départements. */

import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// --------------------------------------------------------------- Départements
export class CreateDepartementDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() faculte?: string;
}

export class UpdateDepartementDto extends PartialType(CreateDepartementDto) {}
