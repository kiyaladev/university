import { PartialType } from '@nestjs/swagger';
import { StatutAttestation, TypeAttestation } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

/** Émission d'une attestation par la scolarité. */
export class CreateAttestationDto {
  @IsEnum(TypeAttestation)
  type: TypeAttestation;

  /** Motif du document : bourse, passeport, banque… */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motif?: string;

  /** L'étudiant est obligatoire : l'attestation concerne une personne, jamais un anonymat. */
  @IsUUID()
  etudiantId: string;

  @IsOptional()
  @IsUUID()
  anneeId?: string;

  @IsOptional()
  @IsUUID()
  promotionId?: string;

  /** Inscription de rattachement (facultatif) : précise le parcours exact. */
  @IsOptional()
  @IsUUID()
  inscriptionId?: string;
}

/** Une attestation émise ne se modifie que sur son type et son motif. */
export class UpdateAttestationDto extends PartialType(CreateAttestationDto) {}

/** Révocation : motif obligatoire, car c'est une décision opposable. */
export class RevoquerAttestationDto {
  @IsString()
  @MinLength(3, { message: 'Indiquez un motif de révocation (3 caractères min.)' })
  @MaxLength(500)
  motifRevocation: string;
}

export class AttestationQueryDto extends QueryDto {
  @IsOptional()
  @IsEnum(TypeAttestation)
  type?: TypeAttestation;

  @IsOptional()
  @IsEnum(StatutAttestation)
  statut?: StatutAttestation;

  @IsOptional()
  @IsUUID()
  anneeId?: string;

  @IsOptional()
  @IsUUID()
  promotionId?: string;
}

/** Consultation publique d'une attestation via son QR code. */
export class VerifierAttestationDto {
  /** Numéro imprimé, ex. "ATT-2026-00001". */
  @IsString()
  ref: string;

  /** Jeton transporté par le QR ("UP-DOC-…"). */
  @IsString()
  k: string;
}