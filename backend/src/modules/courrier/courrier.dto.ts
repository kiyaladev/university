import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StatutCourrier, TypeCourrier } from '@prisma/client';
import { QueryDto } from '../../common/dto';

/** Étape de validation : qui paraphe, dans quel ordre. */
export class CircuitEtapeDto {
  @IsInt()
  @Min(1)
  ordre: number;

  @IsString()
  roleValideur: string;
}

/** Création / enregistrement d'un courrier. Si `circuit` est omis, un
 *  circuit par défaut (secrétariat → chef → archives) est créé. */
export class CreateCourrierDto {
  @IsString()
  numero: string;

  @IsEnum(TypeCourrier)
  type: TypeCourrier;

  @IsString()
  objet: string;

  @IsOptional() @IsString() expediteur?: string;
  @IsOptional() @IsString() destinataire?: string;

  @IsOptional() @IsDateString() dateReception?: string;
  @IsOptional() @IsDateString() dateEnvoi?: string;
  @IsOptional() @IsString() fichier?: string;
  @IsOptional() @IsString() typeMime?: string;
  @IsOptional() @IsInt() @Min(0) tailleKo?: number;
  @IsOptional() @IsString() numeroReference?: string;
  @IsOptional() @IsString() paraphe?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CircuitEtapeDto)
  circuit?: CircuitEtapeDto[];
}

export class UpdateCourrierDto {
  @IsOptional() @IsString() objet?: string;
  @IsOptional() @IsString() expediteur?: string;
  @IsOptional() @IsString() destinataire?: string;
  @IsOptional() @IsDateString() dateReception?: string;
  @IsOptional() @IsDateString() dateEnvoi?: string;
  @IsOptional() @IsString() fichier?: string;
  @IsOptional() @IsString() typeMime?: string;
  @IsOptional() @IsInt() @Min(0) tailleKo?: number;
  @IsOptional() @IsString() numeroReference?: string;
  @IsOptional() @IsString() paraphe?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(StatutCourrier) statut?: StatutCourrier;
}

export class ParapherCourrierDto {
  @IsOptional() @IsString() paraphe?: string;
  @IsOptional() @IsString() commentaire?: string;
}

export class CloturerCourrierDto {
  @IsOptional() @IsString() notes?: string;
}

/** Liste : filtre par type, statut, dates. */
export class CourrierQueryDto extends QueryDto {
  @IsOptional() @IsEnum(TypeCourrier) type?: TypeCourrier;
  @IsOptional() @IsEnum(StatutCourrier) statut?: StatutCourrier;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsUUID() enregistreParId?: string;
}
