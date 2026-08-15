import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { toDateOnly } from '../../common/utils';

export class CreateAnneeDto {
  @IsString() libelle: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() cloturee?: boolean;
}

export class UpdateAnneeDto extends PartialType(CreateAnneeDto) {}

@Injectable()
export class AnneesService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'anneeAcademique', {
      searchFields: ['libelle'],
      orderBy: { dateDebut: 'desc' },
      label: 'Année académique',
    });
  }

  /** Année académique courante (celle marquée active). */
  async active() {
    return this.prisma.anneeAcademique.findFirst({ where: { active: true } });
  }

  private prepare(dto: CreateAnneeDto | UpdateAnneeDto) {
    return {
      ...dto,
      ...(dto.dateDebut ? { dateDebut: toDateOnly(dto.dateDebut) } : {}),
      ...(dto.dateFin ? { dateFin: toDateOnly(dto.dateFin) } : {}),
    };
  }

  /** Une seule année peut être active à la fois. */
  private async desactiverAutres(id?: string) {
    await this.prisma.anneeAcademique.updateMany({
      where: { active: true, ...(id ? { NOT: { id } } : {}) },
      data: { active: false },
    });
  }

  async creer(dto: CreateAnneeDto) {
    const annee = await this.create(this.prepare(dto));
    if (dto.active) await this.desactiverAutres((annee as any).id);
    return annee;
  }

  async modifier(id: string, dto: UpdateAnneeDto) {
    if (dto.active) await this.desactiverAutres(id);
    return this.update(id, this.prepare(dto));
  }
}

@ApiTags('Années académiques')
@ApiBearerAuth()
@Controller('annees')
export class AnneesController {
  constructor(private readonly service: AnneesService) {}

  @Get() findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }

  @Get('active') active() {
    return this.service.active();
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Post() create(@Body() dto: CreateAnneeDto) {
    return this.service.creer(dto);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateAnneeDto) {
    return this.service.modifier(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
