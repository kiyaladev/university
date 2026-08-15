import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { StatutNotification } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class DemandeCodeOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est requis' })
  @Matches(/^\+?[\d\s().-]{6,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone: string;
}

export class VerifierOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est requis' })
  @Matches(/^\+?[\d\s().-]{6,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code reçu par SMS est requis' })
  @Matches(/^\d{4,8}$/, { message: 'Le code est celui reçu par SMS' })
  code: string;
}

/**
 * Diffusion manuelle : soit une liste explicite de numéros, soit « tous les
 * étudiants inscrits à l'année académique en cours » (`tousInscrits`). L'une
 * des deux au moins doit être présente (contrôle dans le service).
 */
export class DiffusionNotificationDto {
  @IsOptional()
  @IsArray({ message: 'Destinataires invalides' })
  @ArrayMaxSize(500, { message: 'Trop de destinataires (500 maximum par envoi)' })
  @Matches(/^\+?[\d\s().-]{6,20}$/, {
    each: true,
    message: 'Un des numéros est invalide',
  })
  destinatairesTelephones?: string[];

  @IsOptional()
  @IsBoolean()
  tousInscrits?: boolean;

  @IsString()
  @IsNotEmpty({ message: 'Le message est requis' })
  @MaxLength(160, { message: 'Le message doit tenir en un SMS (160 caractères maximum)' })
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  motif?: string;
}

export class DiffusionResultatsDto {
  @IsString()
  @IsNotEmpty({ message: 'La délibération est requise' })
  deliberationId: string;

  /** Réservé aux canaux futurs (SMS long, WhatsApp…) : sans effet aujourd'hui. */
  @IsOptional()
  @IsObject()
  canal?: Record<string, unknown>;
}

export class ListeNotificationsQueryDto extends QueryDto {
  @IsOptional()
  @IsIn(Object.values(StatutNotification), {
    message: 'Statut de notification inconnu',
  })
  statut?: StatutNotification;
}