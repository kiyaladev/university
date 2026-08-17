import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ModeVote, StatutElection, TypeElection } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateElectionDto {
  @IsString() @MinLength(3) @MaxLength(200) titre: string;

  @IsEnum(TypeElection)
  type: TypeElection;

  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() departementId?: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsDateString() dateOuverture: string;
  @IsDateString() dateCloture: string;

  /** Nombre de sièges à pourvoir (1 = uninominal, n = scrutin plurinominal). */
  @Type(() => Number) @IsInt() @Min(1) nbSieges: number;

  @IsOptional() @IsString() @MaxLength(2000) bulletin?: string;
}

export class UpdateElectionDto extends PartialType(CreateElectionDto) {}

export class CreateCandidatDto {
  @IsString() @MinLength(1) @MaxLength(120) nom: string;
  @IsString() @MinLength(1) @MaxLength(120) prenom: string;

  @IsOptional() @IsUUID() etudiantId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;

  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) programme?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) ordre?: number;
}

/** Item du bulletin : un candidat sélectionné par l'électeur. */
export class BulletinItemDto {
  @IsUUID()
  candidatId: string;
}

export class VoterDto {
  /** Identifiant de l'élection visée. */
  @IsUUID()
  electionId: string;

  /**
   * Bulletin : liste de candidats choisis par l'électeur, à concurrence du
   * nombre de sièges à pourvoir. Format [{ candidatId }] explicite pour
   * réserver la place à d'éventuelles annotations (rang, mention) plus tard.
   */
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BulletinItemDto)
  bulletin: BulletinItemDto[];

  @IsOptional() @IsEnum(ModeVote) mode?: ModeVote;
}

export class ElectionQueryDto extends QueryDto {
  @IsOptional() @IsEnum(TypeElection) type?: TypeElection;
  @IsOptional() @IsEnum(StatutElection) statut?: StatutElection;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() departementId?: string;
}