import { PartialType } from '@nestjs/swagger';
import { CategorieIncident, PrioriteTicket, StatutTicket } from '@prisma/client';
import {
  IsBoolean,
  IsBooleanString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QueryDto } from '../../common/dto';

export class CreateEquipementDto {
  /** Ex : "Vidéoprojecteur salle S204" */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  libelle: string;

  /** Ex : "Bâtiment A — étage 2, salle 204" */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emplacement?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class UpdateEquipementDto extends PartialType(CreateEquipementDto) {}

export class EquipementQueryDto extends QueryDto {
  @IsOptional()
  @IsBooleanString()
  actif?: string;
}

/** Déclaration rapide : l'enseignant décrit le problème, la DSI suit. */
export class DeclarerTicketDto {
  /** Équipement visé, généralement résolu depuis le QR scanné. */
  @IsOptional()
  @IsUUID()
  equipementId?: string;

  @IsEnum(CategorieIncident)
  categorie: CategorieIncident;

  @IsString()
  @MinLength(5, { message: 'Décrivez le problème en quelques mots (5 caractères minimum)' })
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsEnum(PrioriteTicket)
  priorite?: PrioriteTicket;
}

/** Changement de statut par la DSI : EN_COURS, RESOLU ou CLOTURE. */
export class TraiterTicketDto {
  @IsIn([StatutTicket.EN_COURS, StatutTicket.RESOLU, StatutTicket.CLOTURE])
  statut: StatutTicket;
}

export class TicketQueryDto extends QueryDto {
  @IsOptional()
  @IsEnum(StatutTicket)
  statut?: StatutTicket;

  @IsOptional()
  @IsEnum(CategorieIncident)
  categorie?: CategorieIncident;

  @IsOptional()
  @IsEnum(PrioriteTicket)
  priorite?: PrioriteTicket;

  @IsOptional()
  @IsUUID()
  equipementId?: string;
}