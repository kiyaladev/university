/** DTO d’administration des comptes utilisateurs. */

import { PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { QueryDto } from '../../../common/dto';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsString() telephone?: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
  /** Rattache le compte à une fiche enseignant existante. */
  @IsOptional() @IsUUID() enseignantId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserQueryDto extends QueryDto {
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsUUID() departementId?: string;
}
