import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ModePaiement, StatutConsommation, StatutPaiement, TypeRepas } from '@prisma/client';
import { QueryDto } from '../../common/dto';

/** Opérateurs Mobile Money acceptés pour la cantine. */
export const OPERATEURS_MOBILE_MONEY = ['ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE'] as const;

// ---------------------------------------------------------------------------
// Portefeuilles
// ---------------------------------------------------------------------------

export class PortefeuillesQueryDto extends QueryDto {
  @IsOptional()
  @IsUUID()
  etudiantId?: string;
}

/**
 * Rechargement au guichet (espèces) ou par Mobile Money.
 * `simuler: true` confirme immédiatement la transaction (pilote) : le mode
 * Mobile Money est alors crédité sur-le-champ comme les espèces.
 */
export class RechargerPortefeuilleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  montant: number;

  @IsOptional()
  @IsIn([ModePaiement.MOBILE_MONEY, ModePaiement.ESPECES])
  mode?: ModePaiement;

  @IsOptional()
  @IsIn(OPERATEURS_MOBILE_MONEY)
  operateur?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsBoolean()
  simuler?: boolean;
}

/** Confirmation pilote d'une recharge en attente (miroir du module paiement). */
export class SimulerRechargeDto {
  @IsIn([StatutPaiement.REUSSI, StatutPaiement.ECHOUE])
  statut: StatutPaiement;
}

// ---------------------------------------------------------------------------
// Guichet : validation d'un repas
// ---------------------------------------------------------------------------

/**
 * La « référence » portée par le QR de la carte (UP-RESTO-<base64url>), par le
 * matricule INE ou par le numéro de téléphone de l'étudiant : le guichet tape
 * ou scanne indistinctement.
 */
export class ValiderRepasDto {
  @IsString()
  reference: string;

  @IsEnum(TypeRepas)
  repas: TypeRepas;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  montant: number;

  @IsOptional()
  @IsString()
  cantine?: string;
}

// ---------------------------------------------------------------------------
// Consommations
// ---------------------------------------------------------------------------

export class ConsommationsQueryDto extends QueryDto {
  @IsOptional()
  @IsEnum(StatutConsommation)
  statut?: StatutConsommation;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsString()
  cantine?: string;
}

export class AnnulerConsommationDto {
  @IsOptional()
  @IsString()
  motif?: string;
}

/** Filtres des recharges : le statut est un statut de paiement, pas un repas. */
export class RechargesQueryDto extends QueryDto {
  @IsOptional()
  @IsEnum(StatutPaiement)
  statut?: StatutPaiement;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;
}

// ---------------------------------------------------------------------------
// Portail étudiant
// ---------------------------------------------------------------------------

/**
 * Rechargement depuis le portail : toujours Mobile Money, jamais crédité
 * directement. L'étudiant reçoit les instructions de paiement et le guichet
 * (ou la caisse) confirme ensuite la transaction.
 */
export class RechargerPortailDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  montant: number;

  @IsOptional()
  @IsIn([ModePaiement.MOBILE_MONEY])
  mode?: ModePaiement;

  @IsOptional()
  @IsIn(OPERATEURS_MOBILE_MONEY)
  operateur?: string;
}