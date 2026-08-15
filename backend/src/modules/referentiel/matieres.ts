import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { Roles } from '../../common/decorators';

export class CreateMatiereDto {
  @IsString() code: string;
  @IsString() intitule: string;
  @IsOptional() @IsInt() @Min(0) volumeHoraireTotal?: number;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsUUID() departementId?: string;
}
export class UpdateMatiereDto extends PartialType(CreateMatiereDto) {}

export class MatiereQueryDto extends QueryDto {
  @IsOptional() @IsUUID() departementId?: string;
}

@Injectable()
export class MatieresService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'matiere', {
      searchFields: ['code', 'intitule'],
      orderBy: { intitule: 'asc' },
      include: { departement: true },
      label: 'Matière',
    });
  }
}

@ApiTags('Matières')
@ApiBearerAuth()
@Controller('matieres')
export class MatieresController {
  constructor(private readonly service: MatieresService) {}

  @Get() findAll(@Query() query: MatiereQueryDto) {
    return this.service.findAll(
      query,
      query.departementId ? { departementId: query.departementId } : {},
    );
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post() create(@Body() dto: CreateMatiereDto) {
    return this.service.create(dto);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateMatiereDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
