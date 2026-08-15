import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ModePaiement, StatutInscription, StatutPaiement } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export const OPERATEURS_MOBILE_MONEY = ['ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE'] as const;

/** Dossier déposé en ligne, sans compte : identité du candidat + choix de promotion. */
export class InscriptionPubliqueDto {
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsIn(['M', 'F']) sexe?: string;
  @IsOptional() @IsDateString() dateNaissance?: string;
  @IsOptional() @IsString() lieuNaissance?: string;
  @IsString() telephone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() adresse?: string;
  /** À défaut, l'année académique active. */
  @IsOptional() @IsUUID() anneeId?: string;
  @IsUUID() promotionId: string;
}

export class CreateEtudiantDto {
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsIn(['M', 'F']) sexe?: string;
  @IsOptional() @IsDateString() dateNaissance?: string;
  @IsOptional() @IsString() lieuNaissance?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
  /** `true` : crée aussi le compte portail (User role ETUDIANT) rattaché à la fiche. */
  @IsOptional() @IsBoolean() creerCompte?: boolean;
  @IsOptional() @IsString() @MinLength(8) motDePasse?: string;
}

export class UpdateEtudiantDto extends PartialType(CreateEtudiantDto) {}

export class EtudiantQueryDto extends QueryDto {
  @IsOptional() @IsIn(['true', 'false', '1', '0']) actif?: string;
}

export class CreateFraisDto {
  @IsUUID() anneeId: string;
  @IsUUID() promotionId: string;
  @Type(() => Number) @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsString() devise?: string;
}

export class UpdateFraisDto extends PartialType(CreateFraisDto) {}

export class FraisQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
}

/** Inscription au guichet : étudiant existant, promotion et montant choisis. */
export class CreateInscriptionDto {
  @IsUUID() etudiantId: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsUUID() promotionId: string;
  /** Montant saisi à la main quand aucun tarif n'est paramétré. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) montantFrais?: number;
}

export class InscriptionQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsEnum(StatutInscription) statut?: StatutInscription;
}

export class CreatePaiementDto {
  @Type(() => Number) @IsNumber() @Min(1) montant: number;
  @IsOptional() @IsString() devise?: string;
  @IsEnum(ModePaiement) mode: ModePaiement;
  @IsOptional() @IsIn(OPERATEURS_MOBILE_MONEY) operateur?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() nomComplet?: string;
  @IsOptional() @IsString() motif?: string;
  @IsOptional() @IsUUID() inscriptionId?: string;
  @IsOptional() @IsUUID() etudiantId?: string;
}

/** Confirmation pilote : l'agent comptable / le DAF répercute la réponse opérateur. */
export class SimulerPaiementDto {
  @IsIn(['REUSSI', 'ECHOUE']) statut: 'REUSSI' | 'ECHOUE';
}

export class AnnulerPaiementDto {
  @IsString() @MinLength(3) motif: string;
}

export class PaiementQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutPaiement) statut?: StatutPaiement;
  @IsOptional() @IsEnum(ModePaiement) mode?: ModePaiement;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() etudiantId?: string;
  @IsOptional() @IsUUID() inscriptionId?: string;
}