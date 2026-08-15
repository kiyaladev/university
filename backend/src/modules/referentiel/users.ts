import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
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
import { Roles } from '../../common/decorators';

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
      label: 'Utilisateur',
    });
  }

  private strip<T extends { password?: string }>(u: T) {
    const { password, ...rest } = u as any;
    return rest;
  }

  async list(query: UserQueryDto) {
    const res = await this.findAll(query, {
      ...(query.role ? { role: query.role } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
    });
    return { ...res, data: res.data.map((u: any) => this.strip(u)) };
  }

  async creer(dto: CreateUserDto) {
    const { password, enseignantId, ...rest } = dto;
    const user = await this.prisma.user.create({
      data: {
        ...rest,
        email: dto.email.toLowerCase().trim(),
        password: await bcrypt.hash(password, 10),
      },
    });
    if (enseignantId) {
      await this.prisma.enseignant.update({
        where: { id: enseignantId },
        data: { userId: user.id },
      });
    }
    return this.strip(user);
  }

  async modifier(id: string, dto: UpdateUserDto) {
    const { password, enseignantId, ...rest } = dto;
    const user = await this.update(id, {
      ...rest,
      ...(dto.email ? { email: dto.email.toLowerCase().trim() } : {}),
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
    });
    if (enseignantId) {
      await this.prisma.enseignant.update({
        where: { id: enseignantId },
        data: { userId: id },
      });
    }
    return this.strip(user as any);
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

  @Post() create(@Body() dto: CreateUserDto) {
    return this.service.creer(dto);
  }

  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.modifier(id, dto);
  }

  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
