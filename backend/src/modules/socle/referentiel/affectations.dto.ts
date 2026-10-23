/** DTO des affectations d’enseignants. */

import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { QueryDto } from '../../../common/dto';

export class CreateAffectationDto {
  @IsUUID() enseignantId: string;
  @IsUUID() matiereId: string;
  @IsUUID() promotionId: string;
  @IsUUID() anneeId: string;
  @IsOptional() @IsInt() @Min(0) volumeHorairePrevu?: number;
}

export class UpdateAffectationDto extends PartialType(CreateAffectationDto) {}

export class AffectationQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() matiereId?: string;
}
