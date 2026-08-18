/** Départements, filières et promotions — l'ossature académique. */
import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Niveau, Role } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CrudService, supprimerOuConflit } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { Public, Roles } from '../../common/decorators';

const GESTION = [Role.ADMIN, Role.SCOLARITE] as const;

// --------------------------------------------------------------- Départements
export class CreateDepartementDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() faculte?: string;
}
export class UpdateDepartementDto extends PartialType(CreateDepartementDto) {}

@Injectable()
export class DepartementsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'departement', {
      searchFields: ['code', 'nom', 'faculte'],
      orderBy: { nom: 'asc' },
      include: { _count: { select: { enseignants: true, filieres: true } } },
      label: 'Département',
    });
  }

  /** Un département qui porte encore des enseignants ou des filières se garde. */
  async remove(id: string) {
    return supprimerOuConflit(
      () => super.remove(id),
      'Ce département ne peut pas être supprimé : des enseignants ou des filières y sont encore rattachés. Réaffectez-les d’abord.',
    );
  }
}

@ApiTags('Départements')
@ApiBearerAuth()
@Controller('departements')
export class DepartementsController {
  constructor(private readonly service: DepartementsService) {}

  @Public()
  @Get() findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post() create(@Body() dto: CreateDepartementDto) {
    return this.service.create(dto);
  }
  @Roles(...GESTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateDepartementDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

// ------------------------------------------------------------------- Filières
export class CreateFiliereDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsUUID() departementId: string;
}
export class UpdateFiliereDto extends PartialType(CreateFiliereDto) {}

export class FiliereQueryDto extends QueryDto {
  @IsOptional() @IsUUID() departementId?: string;
}

@Injectable()
export class FilieresService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'filiere', {
      searchFields: ['code', 'nom'],
      orderBy: { nom: 'asc' },
      include: { departement: true },
      label: 'Filière',
    });
  }

  /** Une filière qui porte encore des promotions se garde. */
  async remove(id: string) {
    return supprimerOuConflit(
      () => super.remove(id),
      'Cette filière ne peut pas être supprimée : des promotions y sont encore rattachées. Supprimez ou réaffectez-les d’abord.',
    );
  }
}

@ApiTags('Filières')
@ApiBearerAuth()
@Controller('filieres')
export class FilieresController {
  constructor(private readonly service: FilieresService) {}

  @Get() findAll(@Query() query: FiliereQueryDto) {
    return this.service.findAll(
      query,
      query.departementId ? { departementId: query.departementId } : {},
    );
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post() create(@Body() dto: CreateFiliereDto) {
    return this.service.create(dto);
  }
  @Roles(...GESTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateFiliereDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

// ----------------------------------------------------------------- Promotions
export class CreatePromotionDto {
  @IsString() nom: string;
  @IsEnum(Niveau) niveau: Niveau;
  @IsOptional() @IsInt() @Min(0) effectif?: number;
  @IsUUID() filiereId: string;
  @IsUUID() anneeId: string;
}
export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

export class PromotionQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() filiereId?: string;
  @IsOptional() @IsEnum(Niveau) niveau?: Niveau;
}

@Injectable()
export class PromotionsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'promotion', {
      searchFields: ['nom'],
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
      include: { filiere: { include: { departement: true } }, annee: true },
      label: 'Promotion',
    });
  }

  /** Une promotion qui porte encore inscriptions, affectations ou frais se garde. */
  async remove(id: string) {
    return supprimerOuConflit(
      () => super.remove(id),
      'Cette promotion ne peut pas être supprimée : des données y sont rattachées (inscriptions, affectations, frais…). Traitez-les d’abord.',
    );
  }
}

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get() findAll(@Query() query: PromotionQueryDto) {
    return this.service.findAll(query, {
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.filiereId ? { filiereId: query.filiereId } : {}),
      ...(query.niveau ? { niveau: query.niveau } : {}),
    });
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post() create(@Body() dto: CreatePromotionDto) {
    return this.service.create(dto);
  }
  @Roles(...GESTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
