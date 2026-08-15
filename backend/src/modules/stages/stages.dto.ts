/** Contrats de saisie du module Stages & Mémoires. */
import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { StatutEncadrement, TypeEncadrement } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateTravailDto {
  @IsOptional() @IsEnum(TypeEncadrement) type?: TypeEncadrement;
  @IsString() intitule: string;
  @IsOptional() @IsString() description?: string;
  /** L'étudiant porteur du travail. Un étudiant connecté devient toujours son propre travail. */
  @IsUUID() etudiantId: string;
  @IsOptional() @IsUUID() encadrantId?: string;
  @IsOptional() @IsString() entreprise?: string;
  @IsOptional() @IsString() tuteurEntreprise?: string;
  @IsOptional() @IsString() lieu?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  /**
   * Statut initial à la création : PROPOSE par défaut, VALIDE pour un dossier
   * déjà tranché par la scolarité. Les états suivants relèvent de la
   * machine à états (POST /:id/transition), jamais de la création.
   */
  @IsOptional() @IsEnum(StatutEncadrement) statut?: StatutEncadrement;
}

export class UpdateTravailDto extends PartialType(CreateTravailDto) {}

/** Cible de la machine à états : une seule valeur, appliquée depuis l'état courant. */
export class TransitionDto {
  @IsEnum(StatutEncadrement) statut: StatutEncadrement;
}

export class TravailQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutEncadrement) statut?: StatutEncadrement;
  @IsOptional() @IsEnum(TypeEncadrement) type?: TypeEncadrement;
  /**
   * Année académique : borne le filtre à la période de l'année (le travail a été
   * créé entre sa date de début et la fin de son année). Pas de colonne
   * anneeId sur TravailEncadre : la référence est l'année de création.
   */
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() encadrantId?: string;
}

export class CreateSoutenanceDto {
  @IsUUID() travailEncadreId: string;
  /** Date-heure complète de la soutenance (ISO). */
  @IsDateString() date: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsUUID() presidentId?: string;
  /** « Pr. X ; Dr. Y » — membres du jury hors président. */
  @IsOptional() @IsString() assesseurs?: string;
}

/** Résultat de soutenance, constaté par le jury (ADMIN / DIRECTION). */
export class NoteSoutenanceDto {
  @IsOptional() @IsNumber() @Min(0) @Max(20) note?: number;
  @IsOptional() @IsString() mention?: string;
}

