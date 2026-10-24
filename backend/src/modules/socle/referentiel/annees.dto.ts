/** DTO des années académiques. */

import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAnneeDto {
  @IsString() libelle: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAnneeDto extends PartialType(CreateAnneeDto) {
  @IsOptional() @IsBoolean() cloturee?: boolean;
}
