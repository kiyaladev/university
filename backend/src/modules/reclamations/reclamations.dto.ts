import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PrioriteReclamation,
  StatutReclamation,
  TypeReclamation,
} from '@prisma/client';
import { QueryDto } from '../../common/dto';

/**
 * Déclaration d'une réclamation par un utilisateur connecté. L'anonymat est
 * un choix du déclarant : un étudiant identifié peut préférer l'anonymat
 * sur un sujet sensible (harcèlement, note litigieuse). Dans ce cas, ni
 * l'étudiant ni son compte ne sont reliés à la réclamation — on conserve
 * uniquement un nom et un email libres pour le suivi.
 */
export class CreateReclamationDto {
  @IsEnum(TypeReclamation)
  type: TypeReclamation;

  @IsString()
  @MinLength(3, { message: 'Le sujet est trop court (3 caractères minimum)' })
  @MaxLength(200)
  sujet: string;

  @IsString()
  @MinLength(10, { message: 'Décrivez le problème en quelques phrases (10 caractères minimum)' })
  @MaxLength(4000)
  description: string;

  @IsOptional()
  @IsEnum(PrioriteReclamation)
  priorite?: PrioriteReclamation;

  @IsOptional()
  @IsBoolean()
  anonyme?: boolean;

  @IsOptional()
  @IsUUID()
  departementId?: string;

  /** Si la réclamation est anonyme : nom et email conservés à part. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomAuteur?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email de contact invalide' })
  @MaxLength(160)
  emailAuteur?: string;
}

/** Message posté par un participant sur le fil de la réclamation. */
export class PosterMessageDto {
  @IsString()
  @MinLength(1, { message: 'Le message est vide' })
  @MaxLength(4000)
  contenu: string;

  /** Pièce jointe (data-URL ou chemin interne), facultative. */
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  @Matches(/^(data:[a-z0-9.-]+\/[a-z0-9.+-]+;base64,|https?:\/\/|[\w./-]+\.\w{2,5}$)/i, {
    message: 'Pièce jointe invalide',
  })
  joint?: string;
}

/** Changement de statut : RESOLUE / FERMEE / REJETEE requièrent une note. */
export class ChangerStatutDto {
  @IsEnum(StatutReclamation)
  statut: StatutReclamation;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

/** Assignation d'un agent — prend en charge automatique si la réclamation était OUVERTE. */
export class AssignerReclamationDto {
  @IsUUID()
  assigneAId: string;
}

/** Clôture avec note libre — la réclamation doit déjà être dans un état terminal. */
export class CloturerReclamationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  noteCloture?: string;
}

export class ReclamationQueryDto extends QueryDto {
  @IsOptional()
  @IsEnum(StatutReclamation)
  statut?: StatutReclamation;

  @IsOptional()
  @IsEnum(TypeReclamation)
  type?: TypeReclamation;

  @IsOptional()
  @IsEnum(PrioriteReclamation)
  priorite?: PrioriteReclamation;

  @IsOptional()
  @IsUUID()
  departementId?: string;

  @IsOptional()
  @IsUUID()
  assigneAId?: string;

  /** "oui" : escaladées, "non" : non escaladées. */
  @IsOptional()
  @IsString()
  escalade?: string;
}