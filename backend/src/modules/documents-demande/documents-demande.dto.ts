import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ModePaiement,
  StatutDemande,
  TypeDemandeDocument,
} from '@prisma/client';
import { QueryDto } from '../../common/dto';

const TELEPHONE = /^\+?[\d\s().-]{6,20}$/;

/** Déclaration d'une demande par l'étudiant. */
export class CreerDemandeDto {
  @IsEnum(TypeDemandeDocument)
  type: TypeDemandeDocument;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motif?: string;

  @IsOptional()
  @IsUUID()
  inscriptionId?: string;
}

/** Initiation du paiement par l'étudiant — Mobile Money, espèces ou virement. */
export class PayerDto {
  @IsEnum(ModePaiement)
  mode: ModePaiement;

  /** Mode pilote : passe directement le paiement à REUSSI. */
  @IsOptional()
  @IsBoolean()
  simuler?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  operateur?: string;

  @IsOptional()
  @Matches(TELEPHONE, { message: 'Numéro de téléphone invalide' })
  telephone?: string;
}

/** Confirmation du paiement par l'agent au guichet (ADMIN / SCOLARITE). */
export class ModePaiementDto {
  /** Identifiant du paiement à confirmer — facultatif, contrôlé côté service. */
  @IsOptional()
  @IsUUID()
  paiementId?: string;
}

/** Bascule en EN_TRAITEMENT. */
export class LancerTraitementDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Document marqué prêt : message SMS optionnel pour l'étudiant. */
export class MarquerPreteDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  message?: string;
}

/** Remise au guichet : note libre. */
export class RemettreDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  noteRemise?: string;
}

/** Rejet : motif obligatoire. */
export class RejeterDemandeDto {
  @IsString()
  @MinLength(3, { message: 'Le motif de rejet est obligatoire (3 caractères minimum)' })
  @MaxLength(500)
  motif: string;
}

/** Création d'un tarif par type. */
export class CreerTarifDto {
  @IsEnum(TypeDemandeDocument)
  type: TypeDemandeDocument;

  @IsNumber()
  @Min(0, { message: 'Le montant doit être positif ou nul' })
  montant: number;

  @IsInt()
  @Min(1, { message: 'Le délai doit être d\'au moins une heure' })
  delaiHeures: number;
}

/** Mise à jour partielle d'un tarif. */
export class ModifierTarifDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  montant?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  delaiHeures?: number;
}

export class DocumentsDemandeQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutDemande) statut?: StatutDemande;
  @IsOptional() @IsEnum(TypeDemandeDocument) type?: TypeDemandeDocument;
  @IsOptional() @IsUUID() etudiantId?: string;
}

export class MesDemandesQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutDemande) statut?: StatutDemande;
}