import { Body, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { estChefDeDepartement, exigerPerimetre } from '../../common/perimetre';
import { t } from '../../common/i18n';
import { journaliser } from '../../common/audit';

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

  private instantaneAudit(matiere: any) {
    return {
      id: matiere.id,
      code: matiere.code,
      intitule: matiere.intitule,
      volumeHoraireTotal: matiere.volumeHoraireTotal,
      credits: matiere.credits,
      departementId: matiere.departementId,
    };
  }

  async creer(dto: CreateMatiereDto, acteur?: AuthUser) {
    if (acteur) exigerPerimetre(acteur, dto.departementId);
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.matiere.create({ data: dto, include: { departement: true } });
      await journaliser(
        tx,
        acteur ?? null,
        'MATIERE_CREEE',
        'Matiere',
        creee.id,
        { avant: null, apres: this.instantaneAudit(creee), champsModifies: Object.keys(dto) },
      );
      return creee;
    });
  }

  async modifier(id: string, dto: UpdateMatiereDto, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.matiere.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      if (acteur) {
        exigerPerimetre(acteur, avant.departementId);
        exigerPerimetre(acteur, dto.departementId ?? avant.departementId);
      }
      const maj = await tx.matiere.update({ where: { id }, data: dto, include: { departement: true } });
      await journaliser(
        tx,
        acteur ?? null,
        'MATIERE_MODIFIEE',
        'Matiere',
        id,
        { avant: this.instantaneAudit(avant), apres: this.instantaneAudit(maj), champsModifies: Object.keys(dto) },
      );
      return maj;
    });
  }

  async supprimer(id: string, acteur?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.matiere.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      await tx.matiere.delete({ where: { id } });
      await journaliser(tx, acteur ?? null, 'MATIERE_SUPPRIMEE', 'Matiere', id, { avant: this.instantaneAudit(avant), apres: null });
      return { id };
    });
  }

  /** Vérifie qu'une UE existe et reste dans le périmètre du demandeur. */
  async trouverPerimetre(id: string, user: AuthUser) {
    if (estChefDeDepartement(user)) {
      const matiere = await this.prisma.matiere.findFirst({
        where: { id, departementId: user.departementId ?? '__aucun__' },
        include: { departement: true },
      });
      if (!matiere) throw new NotFoundException(t('common.notFound'));
      return matiere;
    }
    const matiere = await this.findOne(id);
    return matiere;
  }

  async modifierPerimetre(id: string, dto: UpdateMatiereDto, user: AuthUser) {
    const actuelle = await this.trouverPerimetre(id, user);
    exigerPerimetre(user, dto.departementId ?? actuelle.departementId);
    return this.modifier(id, dto, user);
  }
}

/** Filtre de liste : un chef de département ne voit que son département. */
function perimetreMatiere(user: AuthUser, departementId?: string) {
  if (estChefDeDepartement(user)) return { departementId: user.departementId ?? '__aucun__' };
  return departementId ? { departementId } : {};
}

@ApiTags('Matières')
@ApiBearerAuth()
@Controller('matieres')
export class MatieresController {
  constructor(private readonly service: MatieresService) {}

  // La lecture était ouverte à tout le monde, y compris aux chefs de département
  // d'autres filières ; l'écriture, elle, laissait un chef de département
  // réécrire n'importe quelle UE et en déplacer le rattachement.
  @Get() findAll(@Query() query: MatiereQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, perimetreMatiere(user, query.departementId));
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouverPerimetre(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post() create(@Body() dto: CreateMatiereDto, @CurrentUser() user: AuthUser) {
    exigerPerimetre(user, dto.departementId);
    return this.service.creer(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateMatiereDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifierPerimetre(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimer(id, user);
  }
}
