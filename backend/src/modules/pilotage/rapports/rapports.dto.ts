import { AuthUser } from '../../../common/decorators';
import { Role, StatutEnseignant } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { estChefDeDepartement } from '../../../common/perimetre';

export class RapportQueryDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() salleId?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statutEnseignant?: StatutEnseignant;
}

/**
 * Filtres d'un état imprimable ou d'un export : mêmes critères que les
 * rapports, plus le jeton facultatif passé en URL (voir jeton-imprimable.ts).
 */
export class RapportImprimableQueryDto extends RapportQueryDto {
  @IsOptional() @IsString() @MaxLength(4096) token?: string;
}

/** Affiches QR : une salle précise, ou toutes les salles si absente. */
export class AffichesQrQueryDto {
  @IsOptional() @IsString() @MaxLength(4096) token?: string;
  @IsOptional() @IsUUID() salleId?: string;
}

/** Le chef signe un relevé limité à son département et à une semaine civile. */
export class ReleveHebdomadaireDto {
  @IsUUID() departementId: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @MaxLength(1_000_000)
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
  signatureBase64: string;
}

/** Les filtres fournis par le client ne peuvent pas élargir son périmètre. */
export function perimetrePresence<T extends RapportQueryDto>(query: T, user: AuthUser): T {
  if (user.role === Role.ENSEIGNANT) return { ...query, enseignantId: user.enseignantId ?? '__aucun__' };
  if (estChefDeDepartement(user) || user.role === Role.CONTROLEUR) {
    return { ...query, departementId: user.departementId ?? '__aucun__' };
  }
  return query;
}
