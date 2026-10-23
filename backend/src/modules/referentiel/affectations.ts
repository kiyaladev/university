/** Charges d'enseignement : qui enseigne quoi, à quelle promotion, et pour
 *  quel volume horaire contractuel. C'est la clé de voûte du contrôle : une
 *  séance ne peut exister que sur une affectation. */
import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { CrudService, supprimerOuConflit } from '../../common/crud.service';
import { t } from '../../common/i18n';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from '../../common/annee';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryDto } from '../../common/dto';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { estChefDeDepartement, exigerPerimetre } from '../../common/perimetre';
import { journaliser } from '../../common/audit';

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
  enseignant: { select: {
    id: true, matricule: true, nom: true, prenom: true, grade: true,
    statut: true, actif: true, departementId: true,
    departement: { select: { id: true, nom: true } },
  } },
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

  /**
   * Une affectation porte le service d'un enseignant sur une UE : c'est elle
   * qui alimente le volume horaire et la paie. Un chef de département pouvait
   * la réécrire pour n'importe quel enseignant × matière × promotion, y compris
   * hors de son département, alors que la lecture était bornée.
   *
   * Le département n'est pas dans le DTO : il se déduit de l'enseignant visé.
   */
  private async exigerPerimetreAffectation(user: AuthUser, enseignantId?: string, db: any = this.prisma) {
    if (!estChefDeDepartement(user) && user.role !== Role.CONTROLEUR) return;
    if (!enseignantId) {
      throw new ForbiddenException(t('common.forbidden'));
    }
    const enseignant = await db.enseignant.findUnique({
      where: { id: enseignantId },
      select: { departementId: true },
    });
    exigerPerimetre(user, enseignant?.departementId);
  }

  async creerPour(dto: CreateAffectationDto, user: AuthUser) {
    await exigerAnneeOuverte(this.prisma, dto.anneeId);
    await exigerPromotionMemeAnnee(this.prisma, dto.promotionId, dto.anneeId);
    await this.exigerPerimetreAffectation(user, dto.enseignantId);
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId, dto.anneeId);
      await this.exigerPerimetreAffectation(user, dto.enseignantId, tx as any);
      const affectation = await tx.affectation.create({ data: dto, include: AFFECTATION_INCLUDE });
      await journaliser(
        tx,
        user,
        'AFFECTATION_CREEE',
        'Affectation',
        affectation.id,
        { avant: null, apres: this.instantaneAudit(affectation) },
      );
      return affectation;
    });
  }

  async modifierPour(id: string, dto: UpdateAffectationDto, user: AuthUser) {
    const actuelle: any = await this.findOne(id);
    await exigerAnneeOuverte(this.prisma, actuelle.anneeId);
    if (dto.anneeId !== undefined) await exigerAnneeOuverte(this.prisma, dto.anneeId);
    const anneeCible = dto.anneeId ?? actuelle.anneeId;
    const promotionCible = dto.promotionId ?? actuelle.promotionId;
    if (promotionCible) await exigerPromotionMemeAnnee(this.prisma, promotionCible, anneeCible);
    if (estChefDeDepartement(user)) exigerPerimetre(user, actuelle.enseignant?.departementId);
    // Un déplacement vers un enseignant d'un autre département sort du périmètre.
    await this.exigerPerimetreAffectation(user, dto.enseignantId ?? actuelle.enseignantId);
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.affectation.findUnique({ where: { id }, include: AFFECTATION_INCLUDE });
      if (!avant) throw new ForbiddenException(t('common.forbidden'));
      await exigerAnneeOuverte(tx, avant.anneeId);
      if (dto.anneeId !== undefined) await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId ?? avant.promotionId, dto.anneeId ?? avant.anneeId);
      if (estChefDeDepartement(user)) exigerPerimetre(user, avant.enseignant?.departementId);
      await this.exigerPerimetreAffectation(user, dto.enseignantId ?? avant.enseignantId, tx as any);
      const maj = await tx.affectation.update({ where: { id }, data: dto, include: AFFECTATION_INCLUDE });
      await journaliser(
        tx,
        user,
        'AFFECTATION_MODIFIEE',
        'Affectation',
        id,
        { avant: this.instantaneAudit(avant), apres: this.instantaneAudit(maj) },
      );
      return maj;
    });
  }

  async remove(id: string, user?: AuthUser) {
    const actuelle: any = await this.findOne(id);
    await exigerAnneeOuverte(this.prisma, actuelle.anneeId);
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.affectation.findUnique({ where: { id }, include: AFFECTATION_INCLUDE });
      if (!avant) throw new ForbiddenException(t('common.forbidden'));
      await exigerAnneeOuverte(tx, avant.anneeId);
      // Contrôles et justificatifs sont des preuves (base de la paie) : une
      // affectation qui en porte ne se supprime pas. Les séances seulement
      // planifiées s'effacent explicitement ; Seance.affectationId est en
      // RESTRICT, une preuve posée entre-temps fait échouer le DELETE (409).
      const pointees = await tx.seance.count({
        where: { affectationId: id, OR: [{ controle: { isNot: null } }, { justificatif: { isNot: null } }] },
      });
      if (pointees > 0) {
        throw new ConflictException(t('referentiel.affectation_seances_pointees', { nombre: pointees }));
      }
      const { count: seancesSupprimees } = await tx.seance.deleteMany({
        where: { affectationId: id, controle: { is: null }, justificatif: { is: null } },
      });
      await supprimerOuConflit(() => tx.affectation.delete({ where: { id } }), 'referentiel.affectation_referenced_delete');
      await journaliser(tx, user ?? null, 'AFFECTATION_SUPPRIMEE', 'Affectation', id, { avant: this.instantaneAudit(avant), apres: null, seancesSupprimees });
      return { id };
    });
  }

  private instantaneAudit(affectation: any) {
    return {
      id: affectation.id,
      enseignantId: affectation.enseignantId,
      matiereId: affectation.matiereId,
      promotionId: affectation.promotionId,
      anneeId: affectation.anneeId,
      volumeHorairePrevu: affectation.volumeHorairePrevu,
    };
  }

  /** Vérifie qu'une affectation existe et reste dans le périmètre du demandeur. */
  async trouverPerimetre(id: string, user: AuthUser) {
    const affectation: any = await this.findOne(id);
    if (estChefDeDepartement(user) || user.role === Role.CONTROLEUR) {
      if (!user.departementId || affectation.enseignant?.departementId !== user.departementId) {
        throw new NotFoundException(t('common.notFound'));
      }
    } else if (user.role === Role.ENSEIGNANT && affectation.enseignantId !== user.enseignantId) {
      throw new NotFoundException(t('common.notFound'));
    }
    return affectation;
  }

  where(query: AffectationQueryDto, user?: AuthUser) {
    const filtres = {
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
    // Un chef de département ne voit que les affectations de ses enseignants,
    // y compris quand il ne précise aucun filtre.
    if (user?.role === Role.ENSEIGNANT) {
      return { ...filtres, enseignantId: user.enseignantId ?? '__aucun_enseignant__' };
    }
    if (user && (estChefDeDepartement(user) || user.role === Role.CONTROLEUR)) {
      return {
        ...filtres,
        enseignant: { departementId: user.departementId ?? '__aucun__' },
      };
    }
    return filtres;
  }
}

@ApiTags('Affectations')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.CONTROLEUR, Role.ENSEIGNANT)
@Controller('affectations')
export class AffectationsController {
  constructor(private readonly service: AffectationsService) {}

  @Get() findAll(@Query() query: AffectationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(
      { ...query, search: undefined },
      this.service.where(query, user),
    );
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.trouverPerimetre(id, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post() create(@Body() dto: CreateAffectationDto, @CurrentUser() user: AuthUser) {
    return this.service.creerPour(dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateAffectationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.modifierPour(id, dto, user);
  }
  @Roles(Role.ADMIN, Role.SCOLARITE)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
