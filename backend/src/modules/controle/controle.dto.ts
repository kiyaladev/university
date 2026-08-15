import { PartialType } from '@nestjs/swagger';
import { MethodeVerification, StatutPresence } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { QueryDto } from '../../common/dto';
import { PreuveEmpreinteDto } from '../attestation/attestation.dto';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ce que le contrôleur consigne en salle — l'équivalent numérique du registre. */
export class PointageDto {
  @IsUUID() seanceId: string;

  /** Laissé vide : déduit automatiquement de l'heure d'arrivée. */
  @IsOptional() @IsEnum(StatutPresence) statut?: StatutPresence;

  @IsOptional() @Matches(HEURE, { message: 'Heure d’arrivée au format HH:mm' })
  heureArrivee?: string;

  @IsOptional() @Matches(HEURE, { message: 'Heure de fin au format HH:mm' })
  heureFinReelle?: string;

  @IsOptional() @IsInt() @Min(0) effectifPresent?: number;
  @IsOptional() @IsString() thematiqueTraitee?: string;
  @IsOptional() @IsString() observation?: string;

  /** Jeton lu sur le QR affiché dans la salle. */
  @IsOptional() @IsString() qrToken?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;

  // --- Attestation donnée par l'enseignant sur l'appareil du contrôleur,
  //     en salle (une seule de ces preuves suffit)
  /** Signature manuscrite tracée sur l'écran du contrôleur. */
  @IsOptional() @IsString() signatureBase64?: string;

  /** Code personnel de l'enseignant saisi sur l'écran du contrôleur. */
  @IsOptional() @Matches(/^\d{4,6}$/, { message: 'Le code personnel comporte 4 à 6 chiffres' })
  codePinEnseignant?: string;

  /** Résultat signé par la passerelle biométrique (lecteur d'empreintes). */
  @IsOptional() @ValidateNested() @Type(() => PreuveEmpreinteDto)
  empreinte?: PreuveEmpreinteDto;


  /** Cours assuré par un remplaçant. */
  @IsOptional() @IsUUID() enseignantRemplacantId?: string;

  /** Pointage saisi hors connexion puis synchronisé. */
  @IsOptional() @IsBoolean() horsLigne?: boolean;
  @IsOptional() @IsDateString() horodatage?: string;
}

export class UpdatePointageDto extends PartialType(PointageDto) {}

export class SyncPointagesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PointageDto)
  pointages: PointageDto[];
}

export class ControleQueryDto extends QueryDto {
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsEnum(StatutPresence) statut?: StatutPresence;
  @IsOptional() @IsEnum(MethodeVerification) methode?: MethodeVerification;
  @IsOptional() @IsUUID() controleurId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsUUID() salleId?: string;
}
