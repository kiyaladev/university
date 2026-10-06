import { Body, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { t } from '../../common/i18n';

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

@Injectable()
export class UsersService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'user', {
      searchFields: ['nom', 'prenom', 'email'],
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        departementId: true,
      },
      label: 'Utilisateur',
    });
  }

  private profilSecurise(u: any) {
    return {
      id: u.id,
      email: u.email,
      nom: u.nom,
      prenom: u.prenom,
      telephone: u.telephone,
      role: u.role,
      actif: u.actif,
      departementId: u.departementId,
    };
  }

  /** L'audit des comptes ne conserve ni identité, ni secret, ni verrouillage. */
  private instantaneAudit(u: any) {
    return {
      id: u.id,
      role: u.role,
      actif: u.actif,
      departementId: u.departementId,
      motDePasseConfigure: Boolean(u.password),
    };
  }

  private selectAudit() {
    return { ...this.selectProfil(), password: true };
  }

  async findOne(id: string) {
    return this.profilSecurise(await super.findOne(id));
  }

  async list(query: UserQueryDto) {
    const res = await this.findAll(query, {
      ...(query.role ? { role: query.role } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
    });
    return { ...res, data: res.data.map((u: any) => this.profilSecurise(u)) };
  }

  async creer(dto: CreateUserDto, acteur?: AuthUser) {
    const { password, enseignantId, ...rest } = dto;
    const hash = await bcrypt.hash(password, 10);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { ...rest, email: dto.email.toLowerCase().trim(), password: hash },
        select: this.selectAudit(),
      });
      if (enseignantId) await tx.enseignant.update({ where: { id: enseignantId }, data: { userId: user.id } });
      await tx.auditLog.create({ data: {
        userId: acteur?.id ?? null,
        action: 'UTILISATEUR_CREE',
        entite: 'Utilisateur',
        entiteId: user.id,
        details: JSON.stringify({ avant: null, apres: this.instantaneAudit(user), champsModifies: Object.keys(rest) }),
      } });
      return this.profilSecurise(user);
    });
  }

  async modifier(id: string, dto: UpdateUserDto, acteur?: AuthUser) {
    const { password, enseignantId, ...rest } = dto;
    const hash = password ? await bcrypt.hash(password, 10) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.user.findUnique({ where: { id }, select: this.selectAudit() });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Utilisateur' }));
      const apres = await tx.user.update({
        where: { id },
        data: {
          ...rest,
          ...(dto.email ? { email: dto.email.toLowerCase().trim() } : {}),
          ...(hash
            ? { password: hash, motDePasseModifieLe: new Date(), tentativesEchouees: 0, verrouilleJusqua: null }
            : {}),
        },
        select: this.selectAudit(),
      });
      if (enseignantId) await tx.enseignant.update({ where: { id: enseignantId }, data: { userId: id } });
      await tx.auditLog.create({ data: {
        userId: acteur?.id ?? null,
        action: 'UTILISATEUR_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: JSON.stringify({
          avant: this.instantaneAudit(avant),
          apres: this.instantaneAudit(apres),
          champsModifies: [...Object.keys(rest), ...(password ? ['motDePasse'] : []), ...(enseignantId ? ['enseignantId'] : [])],
        }),
      } });
      return this.profilSecurise(apres);
    });
  }

  async supprimer(id: string, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.user.findUnique({ where: { id }, select: this.selectAudit() });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Utilisateur' }));
      await tx.user.delete({ where: { id } });
      await tx.auditLog.create({ data: {
        userId: acteur?.id ?? null,
        action: 'UTILISATEUR_SUPPRIME',
        entite: 'Utilisateur',
        entiteId: id,
        details: JSON.stringify({ avant: this.instantaneAudit(avant), apres: null }),
      } });
      return { id };
    });
  }

  private selectProfil() {
    return {
      id: true,
      email: true,
      nom: true,
      prenom: true,
      telephone: true,
      role: true,
      actif: true,
      departementId: true,
    };
  }
}

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('utilisateurs')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get() findAll(@Query() query: UserQueryDto) {
    return this.service.list(query);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
