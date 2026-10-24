import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ParametreItemDto {
  @IsString() cle: string;
  @IsString() valeur: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateParametresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParametreItemDto)
  parametres: ParametreItemDto[];
}
