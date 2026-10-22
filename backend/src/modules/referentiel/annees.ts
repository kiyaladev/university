import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import { CrudService, supprimerOuConflit } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { toDateOnly } from '../../common/utils';
import { t } from '../../common/i18n';
import { journaliser } from '../../common/audit';

export class CreateAnneeDto {
  @IsString() libelle: string;
  @IsDateString() dateDebut: string;
  @IsDateString() dateFin: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAnneeDto extends PartialType(CreateAnneeDto) {
  @IsOptional() @IsBoolean() cloturee?: boolean;
}

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

  private verifierPeriode(dateDebut: Date, dateFin: Date) {
    if (dateDebut.getTime() >= dateFin.getTime()) {
      throw new BadRequestException(t('referentiel.annee_dates_incoherentes'));
    }
  }

  /** Une seule année peut être active à la fois. */
  private instantane(annee: any) {
    return {
      id: annee.id,
      libelle: annee.libelle,
      dateDebut: annee.dateDebut,
      dateFin: annee.dateFin,
      active: annee.active,
      cloturee: annee.cloturee,
    };
  }

  private async desactiverAutres(tx: Prisma.TransactionClient, id: string | undefined, userId: string) {
    const autres = await tx.anneeAcademique.findMany({
      where: { active: true, cloturee: false, ...(id ? { NOT: { id } } : {}) },
    });
    if (!autres.length) return;
    await tx.anneeAcademique.updateMany({
      where: { id: { in: autres.map((annee) => annee.id) }, active: true, cloturee: false },
      data: { active: false },
    });
    for (const annee of autres) {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ANNEE_ACADEMIQUE_MODIFIEE',
          entite: 'AnneeAcademique',
          entiteId: annee.id,
          details: JSON.stringify({ avant: this.instantane(annee), apres: { ...this.instantane(annee), active: false } }),
        },
      });
    }
  }

  async creer(dto: CreateAnneeDto, user: AuthUser) {
    const dateDebut = toDateOnly(dto.dateDebut);
    const dateFin = toDateOnly(dto.dateFin);
    this.verifierPeriode(dateDebut, dateFin);
    const creation = {
      libelle: dto.libelle,
      dateDebut,
      dateFin,
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      if (dto.active) await this.desactiverAutres(tx, undefined, user.id);
      const annee = await tx.anneeAcademique.create({ data: creation });
      await journaliser(tx, user, 'ANNEE_ACADEMIQUE_CREEE', 'AnneeAcademique', annee.id, { avant: null, apres: this.instantane(annee) });
      return annee;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async modifier(id: string, dto: UpdateAnneeDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const actuelle = await tx.anneeAcademique.findUnique({ where: { id } });
      if (!actuelle) throw new NotFoundException(t('common.notFound'));
      if (actuelle.cloturee) {
        if (dto.cloturee === false) {
          throw new BadRequestException(t('common.academicYearReopenRequiresAudit'));
        }
        const champsModifies = Object.keys(dto).filter(champ => champ !== 'cloturee');
        if (champsModifies.length) throw new BadRequestException(t('common.academicYearClosed'));
        return actuelle;
      }

      this.verifierPeriode(
        dto.dateDebut ? toDateOnly(dto.dateDebut) : actuelle.dateDebut,
        dto.dateFin ? toDateOnly(dto.dateFin) : actuelle.dateFin,
      );

      if (dto.cloturee === true) {
        const annee = await tx.anneeAcademique.update({
          where: { id },
          data: { ...this.prepare(dto), active: false, cloturee: true },
        });
        await journaliser(
          tx,
          user,
          'ANNEE_ACADEMIQUE_CLOTUREE',
          'AnneeAcademique',
          id,
          { avant: this.instantane(actuelle), apres: this.instantane(annee) },
        );
        return annee;
      }

      if (dto.active) await this.desactiverAutres(tx, id, user.id);
      const annee = await tx.anneeAcademique.update({ where: { id }, data: this.prepare(dto) });
      await journaliser(
        tx,
        user,
        'ANNEE_ACADEMIQUE_MODIFIEE',
        'AnneeAcademique',
        id,
        { avant: this.instantane(actuelle), apres: this.instantane(annee) },
      );
      return annee;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Une année académique porte tout le reste (promotions, inscriptions,
   * séances, délibérations…) : dès qu'elle a servi, on la clôture, on ne
   * l'efface pas.
   */
  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const annee = await tx.anneeAcademique.findUnique({
        where: { id },
        select: {
          id: true, libelle: true, dateDebut: true, dateFin: true, active: true, cloturee: true,
          _count: {
            select: {
              promotions: true,
              affectations: true,
              seances: true,
              inscriptions: true,
              paiements: true,
              evaluations: true,
              deliberations: true,
              attestations: true,
              feuillesPaie: true,
              frais: true,
              attributionsLogement: true,
              statistiquesMesrs: true,
              examens: true,
            },
          },
        },
      });
      if (!annee) throw new NotFoundException(t('common.notFound'));
      if (annee.cloturee) throw new BadRequestException(t('common.academicYearClosed'));
      if (Object.values(annee._count).some((count) => count > 0)) {
        throw new ConflictException(t('referentiel.annee_referenced_delete'));
      }
      return supprimerOuConflit(async () => {
        await tx.anneeAcademique.delete({ where: { id } });
        await journaliser(
          tx,
          user ?? null,
          'ANNEE_ACADEMIQUE_SUPPRIMEE',
          'AnneeAcademique',
          id,
          { avant: this.instantane(annee), apres: null },
        );
        return { id };
      }, 'referentiel.annee_referenced_delete');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
  @Post() create(@Body() dto: CreateAnneeDto, @CurrentUser() user: AuthUser) {
    return this.service.creer(dto, user);
  }

  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateAnneeDto, @CurrentUser() user: AuthUser) {
    return this.service.modifier(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
