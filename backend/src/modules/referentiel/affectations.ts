/** Charges d'enseignement : qui enseigne quoi, à quelle promotion, et pour
 *  quel volume horaire contractuel. C'est la clé de voûte du contrôle : une
 *  séance ne peut exister que sur une affectation. */
import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { Roles } from '../../common/decorators';

export class CreateAffectationDto {
  @IsUUID() enseignantId: string;
  @IsUUID() matiereId: string;
  @IsUUID() promotionId: string;
  @IsUUID() anneeId: string;
  @IsOptional() @IsInt() @Min(0) volumeHorairePrevu?: number;
}
export class UpdateAffectationDto extends PartialType(CreateAffectationDto) {}

export class AffectationQueryDto extends QueryDto {
  @IsOptional() @IsUUID() anneeId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsUUID() matiereId?: string;
}

export const AFFECTATION_INCLUDE = {
  enseignant: { include: { departement: true } },
  matiere: true,
  promotion: { include: { filiere: true } },
  annee: true,
};

@Injectable()
export class AffectationsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'affectation', {
      orderBy: { createdAt: 'desc' },
      include: AFFECTATION_INCLUDE,
      label: 'Affectation',
    });
  }

  where(query: AffectationQueryDto) {
    return {
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.enseignantId ? { enseignantId: query.enseignantId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.matiereId ? { matiereId: query.matiereId } : {}),
      ...(query.search
        ? {
            OR: [
              { matiere: { intitule: { contains: query.search, mode: 'insensitive' } } },
              { enseignant: { nom: { contains: query.search, mode: 'insensitive' } } },
              { promotion: { nom: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }
}

@ApiTags('Affectations')
@ApiBearerAuth()
@Controller('affectations')
export class AffectationsController {
  constructor(private readonly service: AffectationsService) {}

  @Get() findAll(@Query() query: AffectationQueryDto) {
    return this.service.findAll({ ...query, search: undefined }, this.service.where(query));
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post() create(@Body() dto: CreateAffectationDto) {
    return this.service.create(dto);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateAffectationDto) {
    return this.service.update(id, dto);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
