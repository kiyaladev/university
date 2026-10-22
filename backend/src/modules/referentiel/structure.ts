/** Départements, filières et promotions — l'ossature académique. */
import { Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Niveau, Prisma, Role } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CrudService, supprimerOuConflit } from '../../common/crud.service';
import { exigerAnneeOuverte } from '../../common/annee';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { t } from '../../common/i18n';
import { journaliser } from '../../common/audit';

const GESTION = [Role.ADMIN, Role.SCOLARITE] as const;
const LECTURE_STRUCTURE = [
  Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT,
  Role.CONTROLEUR, Role.ENSEIGNANT,
] as const;

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

  listePublique() {
    return this.prisma.departement.findMany({
      select: { id: true, code: true, nom: true, faculte: true },
      orderBy: { nom: 'asc' },
    });
  }

  private instantaneAudit(departement: any) {
    return { id: departement.id, code: departement.code, nom: departement.nom, faculte: departement.faculte };
  }

  async creer(dto: CreateDepartementDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const departement = await tx.departement.create({ data: dto, include: this.options.include });
      await journaliser(
        tx,
        user ?? null,
        'DEPARTEMENT_CREE',
        'Departement',
        departement.id,
        { avant: null, apres: this.instantaneAudit(departement), champsModifies: Object.keys(dto) },
      );
      return departement;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async modifier(id: string, dto: UpdateDepartementDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.departement.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Département' }));
      const apres = await tx.departement.update({ where: { id }, data: dto, include: this.options.include });
      await journaliser(
        tx,
        user ?? null,
        'DEPARTEMENT_MODIFIE',
        'Departement',
        id,
        { avant: this.instantaneAudit(avant), apres: this.instantaneAudit(apres), champsModifies: Object.keys(dto) },
      );
      return apres;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Un département qui porte encore des données métier ne peut pas s'effacer. */
  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const departement = await tx.departement.findUnique({
        where: { id },
        select: {
          id: true, code: true, nom: true,
          _count: { select: {
            membres: true, enseignants: true, filieres: true, matieres: true,
            documents: true, equipementsPatrimoine: true, reclamations: true, elections: true,
          } },
        },
      });
      if (!departement) throw new NotFoundException(t('common.notFound'));
      if (Object.values(departement._count).some((count) => count > 0)) {
        throw new ConflictException(t('referentiel.departement_referenced_delete'));
      }
      await supprimerOuConflit(() => tx.departement.delete({ where: { id } }), 'referentiel.departement_referenced_delete');
      await journaliser(
        tx,
        user ?? null,
        'DEPARTEMENT_SUPPRIME',
        'Departement',
        id,
        { avant: { id, code: departement.code, nom: departement.nom }, apres: null },
      );
      return { id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

@ApiTags('Départements')
@ApiBearerAuth()
@Controller('departements')
export class DepartementsController {
  constructor(private readonly service: DepartementsService) {}

  @Roles(...LECTURE_STRUCTURE)
  @Get() findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }
  @Public()
  @Get('public') listePublique() {
    return this.service.listePublique();
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post() create(@Body() dto: CreateDepartementDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateDepartementDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
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

  private instantaneAudit(filiere: any) {
    return { id: filiere.id, code: filiere.code, nom: filiere.nom, departementId: filiere.departementId };
  }

  async creer(dto: CreateFiliereDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const filiere = await tx.filiere.create({ data: dto, include: this.options.include });
      await journaliser(
        tx,
        user ?? null,
        'FILIERE_CREEE',
        'Filiere',
        filiere.id,
        { avant: null, apres: this.instantaneAudit(filiere), champsModifies: Object.keys(dto) },
      );
      return filiere;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async modifier(id: string, dto: UpdateFiliereDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.filiere.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Filière' }));
      const apres = await tx.filiere.update({ where: { id }, data: dto, include: this.options.include });
      await journaliser(
        tx,
        user ?? null,
        'FILIERE_MODIFIEE',
        'Filiere',
        id,
        { avant: this.instantaneAudit(avant), apres: this.instantaneAudit(apres), champsModifies: Object.keys(dto) },
      );
      return apres;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Une filière qui porte encore des promotions ne peut pas s'effacer. */
  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const filiere = await tx.filiere.findUnique({
        where: { id },
        select: { id: true, code: true, nom: true, departementId: true, _count: { select: { promotions: true } } },
      });
      if (!filiere) throw new NotFoundException(t('common.notFound'));
      if (filiere._count.promotions > 0) {
        throw new ConflictException(t('referentiel.filiere_referenced_delete'));
      }
      await supprimerOuConflit(() => tx.filiere.delete({ where: { id } }), 'referentiel.filiere_referenced_delete');
      await journaliser(
        tx,
        user ?? null,
        'FILIERE_SUPPRIMEE',
        'Filiere',
        id,
        { avant: { id, code: filiere.code, nom: filiere.nom, departementId: filiere.departementId }, apres: null },
      );
      return { id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

@ApiTags('Filières')
@ApiBearerAuth()
@Controller('filieres')
export class FilieresController {
  constructor(private readonly service: FilieresService) {}

  @Roles(...LECTURE_STRUCTURE)
  @Get() findAll(@Query() query: FiliereQueryDto) {
    return this.service.findAll(
      query,
      query.departementId ? { departementId: query.departementId } : {},
    );
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post() create(@Body() dto: CreateFiliereDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateFiliereDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
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

  async creer(dto: CreatePromotionDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, dto.anneeId);
      const promotion = await tx.promotion.create({
        data: dto,
        include: { filiere: { include: { departement: true } }, annee: true },
      });
      await journaliser(
        tx,
        user ?? null,
        'PROMOTION_CREEE',
        'Promotion',
        promotion.id,
        { avant: null, apres: this.instantaneAudit(promotion) },
      );
      return promotion;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async modifier(id: string, dto: UpdatePromotionDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const actuelle: any = await tx.promotion.findUnique({
        where: { id }, include: { filiere: { include: { departement: true } }, annee: true },
      });
      if (!actuelle) throw new NotFoundException(t('common.notFound'));
      await exigerAnneeOuverte(tx, actuelle.anneeId);
      if (dto.anneeId !== undefined) await exigerAnneeOuverte(tx, dto.anneeId);
      if (dto.anneeId !== undefined || dto.filiereId !== undefined) {
        const dependances = await tx.promotion.findUnique({
          where: { id },
          select: { _count: { select: {
            affectations: true, inscriptions: true, frais: true, evaluations: true,
            deliberations: true, attestations: true, examens: true, elections: true,
          } } },
        });
        if (Object.values(dependances?._count ?? {}).some((count) => count > 0)) {
          throw new ConflictException(t('referentiel.promotion_referenced_delete'));
        }
      }
      const apres = await tx.promotion.update({
        where: { id }, data: dto,
        include: { filiere: { include: { departement: true } }, annee: true },
      });
      await journaliser(
        tx,
        user ?? null,
        'PROMOTION_MODIFIEE',
        'Promotion',
        id,
        { avant: this.instantaneAudit(actuelle), apres: this.instantaneAudit(apres) },
      );
      return apres;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Une promotion qui porte encore inscriptions, affectations ou frais se garde. */
  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const actuelle: any = await tx.promotion.findUnique({
        where: { id }, include: { filiere: { include: { departement: true } }, annee: true },
      });
      if (!actuelle) throw new NotFoundException(t('common.notFound'));
      await exigerAnneeOuverte(tx, actuelle.anneeId);
      const dependances = await tx.promotion.findUnique({
        where: { id },
        select: { _count: { select: {
          affectations: true, inscriptions: true, frais: true, evaluations: true,
          deliberations: true, attestations: true, examens: true, elections: true,
        } } },
      });
      if (Object.values(dependances?._count ?? {}).some((count) => count > 0)) {
        throw new ConflictException(t('referentiel.promotion_referenced_delete'));
      }
      await tx.promotion.delete({ where: { id } });
      await journaliser(tx, user ?? null, 'PROMOTION_SUPPRIMEE', 'Promotion', id, { avant: this.instantaneAudit(actuelle), apres: null });
      return { id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private instantaneAudit(promotion: any) {
    return {
      id: promotion.id, nom: promotion.nom, niveau: promotion.niveau,
      effectif: promotion.effectif, filiereId: promotion.filiereId, anneeId: promotion.anneeId,
    };
  }
}

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Roles(...LECTURE_STRUCTURE)
  @Get() findAll(@Query() query: PromotionQueryDto) {
    return this.service.findAll(query, {
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.filiereId ? { filiereId: query.filiereId } : {}),
      ...(query.niveau ? { niveau: query.niveau } : {}),
    });
  }
  @Roles(...LECTURE_STRUCTURE)
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Roles(...GESTION)
  @Post() create(@Body() dto: CreatePromotionDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }
  @Roles(...GESTION)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdatePromotionDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }
  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
