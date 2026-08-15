import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role, StatutEnseignant } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { Roles } from '../../common/decorators';

export class CreateEnseignantDto {
  @IsString() matricule: string;
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statut?: StatutEnseignant;
  @IsOptional() @IsNumber() @Min(0) tauxHoraire?: number;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
}
export class UpdateEnseignantDto extends PartialType(CreateEnseignantDto) {}

export class EnseignantQueryDto extends QueryDto {
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsEnum(StatutEnseignant) statut?: StatutEnseignant;
}

@Injectable()
export class EnseignantsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'enseignant', {
      searchFields: ['nom', 'prenom', 'matricule', 'email'],
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      include: {
        departement: true,
        user: { select: { id: true, email: true, actif: true } },
      },
      label: 'Enseignant',
    });
  }
}

@ApiTags('Enseignants')
@ApiBearerAuth()
@Controller('enseignants')
export class EnseignantsController {
  constructor(private readonly service: EnseignantsService) {}

  @Get() findAll(@Query() query: EnseignantQueryDto) {
    return this.service.findAll(query, {
      ...(query.departementId ? { departementId: query.departementId } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
    });
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post() create(@Body() dto: CreateEnseignantDto) {
    return this.service.create(dto);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateEnseignantDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
