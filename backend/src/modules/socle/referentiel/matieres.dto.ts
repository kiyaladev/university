/** DTO des matières. */

import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { QueryDto } from '../../../common/dto';

export class CreateMatiereDto {
  @IsString() code: string;
  @IsString() intitule: string;
  @IsOptional() @IsInt() @Min(0) volumeHoraireTotal?: number;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsUUID() departementId?: string;
}

export class UpdateMatiereDto extends PartialType(CreateMatiereDto) {}

export class MatiereQueryDto extends QueryDto {
  @IsOptional() @IsUUID() departementId?: string;
}
