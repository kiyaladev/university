import 'reflect-metadata';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { StatutEnseignant, TypeCours } from '@prisma/client';

export enum TypeImportReferentiel {
  ENSEIGNANTS = 'enseignants',
  MATIERES = 'matieres',
  SALLES = 'salles',
  CRENEAUX = 'creneaux',
}

const booleanCsv = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const texte = value.trim().toLocaleLowerCase('fr');
  if (['true', '1', 'oui', 'yes'].includes(texte)) return true;
  if (['false', '0', 'non', 'no'].includes(texte)) return false;
  return value;
};

export class ImportCsvDto {
  @IsEnum(TypeImportReferentiel) type: TypeImportReferentiel;
  @IsString() @MaxLength(1_000_000) contenu: string;
}

export class LigneEnseignantImport {
  @IsString() matricule: string;
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statut?: StatutEnseignant;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tauxHoraire?: number;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @Transform(booleanCsv) @IsBoolean() actif?: boolean;
}

export class LigneMatiereImport {
  @IsString() code: string;
  @IsString() intitule: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) volumeHoraireTotal?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsUUID() departementId?: string;
}

export class LigneSalleImport {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() batiment?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) capacite?: number;
  @IsOptional() @Transform(booleanCsv) @IsBoolean() actif?: boolean;
}

export class LigneCreneauImport {
  @IsUUID() affectationId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(7) jourSemaine: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) heureDebut: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) heureFin: string;
  @IsOptional() @IsEnum(TypeCours) type?: TypeCours;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
}
