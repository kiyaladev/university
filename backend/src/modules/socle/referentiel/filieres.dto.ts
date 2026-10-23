/** DTO des filières. */

import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { QueryDto } from '../../../common/dto';

// ------------------------------------------------------------------- Filières
export class CreateFiliereDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsUUID() departementId: string;
}

export class UpdateFiliereDto extends PartialType(CreateFiliereDto) {}

export class FiliereQueryDto extends QueryDto {
  @IsOptional() @IsUUID() departementId?: string;
}
