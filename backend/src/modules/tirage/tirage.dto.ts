import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { StadeTirage } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateTirageDto {
  @IsUUID() examenId: string;
  @IsDateString() dateTirage: string;
  @IsInt() @Min(1) nbExemplaires: number;
  /** Empreinte SHA-256 du fichier source à imprimer. */
  @IsString() @Matches(/^[a-fA-F0-9]{64}$/) empreinteSource: string;
  @IsOptional() @IsString() circuitImpression?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ImprimerTirageDto {
  /** Empreinte à re-vérifier avant impression ; doit matcher `empreinteSource`. */
  @IsString() @Matches(/^[a-fA-F0-9]{64}$/) empreinteSource: string;
  /** Empreintes par exemplaire "hash1,hash2,..." ; nul autorise la transition. */
  @IsOptional() @IsString() empreinteExemplaires?: string;
}

export class UpdateStadeTirageDto {
  @IsEnum(StadeTirage) stade: StadeTirage;
  @IsOptional() @IsString() notes?: string;
}

export class TirageQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StadeTirage) stade?: StadeTirage;
  @IsOptional() @IsUUID() examenId?: string;
  @IsOptional() @IsUUID() imprimeurId?: string;
}
