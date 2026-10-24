/** DTO des promotions. */

import { PartialType } from '@nestjs/swagger';
import { Niveau } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { QueryDto } from '../../../common/dto';

// ----------------------------------------------------------------- Promotions
export class CreatePromotionDto {
  @IsString() nom: string;
  @IsEnum(Niveau) niveau: Niveau;
  @IsOptional() @IsInt() @Min(0) effectif?: number;
  @IsUUID() filiereId: string;
  @IsUUID() anneeId: string;
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

export class PromotionQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() filiereId?: string;
  @IsOptional() @IsEnum(Niveau) niveau?: Niveau;
}
