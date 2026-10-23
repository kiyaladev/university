import { StatutJustificatif, TypeJustificatif } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { QueryDto } from '../../../common/dto';

export class CreateJustificatifDto {
  @IsUUID() seanceId: string;
  @IsEnum(TypeJustificatif) type: TypeJustificatif;
  @IsString() motif: string;
  /** Pièce jointe encodée (data-url) : certificat médical, ordre de mission… */
  @IsOptional() @IsString() @MaxLength(500_000) piece?: string;
  /** Enseignant concerné ; à défaut, celui de la séance. */
  @IsOptional() @IsUUID() enseignantId?: string;
}

export class TraiterJustificatifDto {
  @IsIn([StatutJustificatif.VALIDE, StatutJustificatif.REJETE]) statut: StatutJustificatif;
  @IsOptional() @IsString() commentaire?: string;
}

export class JustificatifQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutJustificatif) statut?: StatutJustificatif;
  @IsOptional() @IsEnum(TypeJustificatif) type?: TypeJustificatif;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
}
