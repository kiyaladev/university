import { AuthUser } from '../../common/decorators';
import { Role, StatutEnseignant } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';

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

/** Le chef signe un relevé limité à son département et à une semaine civile. */
export class ReleveHebdomadaireDto {
  @IsUUID() departementId: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @MaxLength(1_000_000) @Matches(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
  signatureBase64: string;
}

/** Les filtres fournis par le client ne peuvent pas élargir son périmètre. */
export function perimetrePresence<T extends RapportQueryDto>(query: T, user: AuthUser): T {
  if (user.role === Role.ENSEIGNANT) return { ...query, enseignantId: user.enseignantId ?? '__aucun__' };
  if (user.role === Role.CHEF_DEPARTEMENT || user.role === Role.CONTROLEUR) {
    return { ...query, departementId: user.departementId ?? '__aucun__' };
  }
  return query;
}
