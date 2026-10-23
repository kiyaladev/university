/** Justification des absences : l'administration dépose sur pièce ; la direction,
 *  l'administration ou le chef du cours arbitre. L'enseignant consulte ses justificatifs, il n'en dépose pas.
 *  Une absence justifiée bascule le contrôle correspondant en EXCUSE et n'est
 *  plus comptée comme absence sèche dans les statistiques. */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  MethodeVerification,
  Prisma,
  Role,
  StatutJustificatif,
  StatutPresence,
  TypeJustificatif,
} from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CrudService } from '../../common/crud.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { QueryDto } from '../../common/dto';
import { toDateOnly } from '../../common/utils';
import { exigerAnneeOuverte } from '../../common/annee';
import { t } from '../../common/i18n';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';
import { estChefDeDepartement, filtreDepartement } from '../../common/perimetre';

export class CreateJustificatifDto {
  @IsUUID() seanceId: string;
  @IsEnum(TypeJustificatif) type: TypeJustificatif;
  @IsString() motif: string;
  /** Pièce jointe encodée (data-url) : certificat médical, ordre de mission… */
  @IsOptional() @IsString() @MaxLength(500_000) piece?: string;
  /** Enseignant concerné ; à défaut, celui de la séance. */
  @IsOptional() @IsUUID() enseignantId?: string;
}

export class TraiterJustificatifDto {
  @IsIn([StatutJustificatif.VALIDE, StatutJustificatif.REJETE]) statut: StatutJustificatif;
  @IsOptional() @IsString() commentaire?: string;
}

export class JustificatifQueryDto extends QueryDto {
  @IsOptional() @IsEnum(StatutJustificatif) statut?: StatutJustificatif;
  @IsOptional() @IsEnum(TypeJustificatif) type?: TypeJustificatif;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
}

const JUSTIFICATIF_INCLUDE = {
  enseignant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      departement: { select: { id: true, code: true, nom: true } },
    },
  },
  traitePar: { select: { id: true, nom: true, prenom: true, role: true } },
  seance: {
    include: {
      salle: { select: { id: true, code: true, nom: true } },
      controle: { select: { id: true, statut: true } },
      affectation: { include: { matiere: true, promotion: true } },
    },
  },
};

const JUSTIFICATIF_ENSEIGNANT_SELECT = {
  id: true,
  seanceId: true,
  enseignantId: true,
  type: true,
  motif: true,
  statut: true,
  commentaire: true,
  traiteLe: true,
  createdAt: true,
  enseignant: { select: { id: true, nom: true, prenom: true } },
  traitePar: { select: { id: true, nom: true, prenom: true, role: true } },
  seance: {
    select: {
      id: true,
      date: true,
      heureDebut: true,
      heureFin: true,
      affectation: { select: { matiere: { select: { intitule: true } } } },
    },
  },
} as const;

@Injectable()
export class JustificatifsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'justificatif', {
      orderBy: { createdAt: 'desc' },
      include: JUSTIFICATIF_INCLUDE,
      label: 'Justificatif',
    });
  }

  liste(query: JustificatifQueryDto, user: AuthUser) {
    const date: Prisma.DateTimeFilter = {};
    if (query.dateDebut) date.gte = toDateOnly(query.dateDebut);
    if (query.dateFin) date.lte = toDateOnly(query.dateFin);

    const seance: Prisma.SeanceWhereInput = {
      ...(Object.keys(date).length ? { date } : {}),
      ...filtreDepartement(user, 'affectation.promotion.filiere'),
    };

    const where = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(user.role === Role.ENSEIGNANT
        ? { enseignantId: user.enseignantId ?? '__aucun__' }
        : query.enseignantId
          ? { enseignantId: query.enseignantId }
          : {}),
      ...(query.departementId && !estChefDeDepartement(user)
        ? { enseignant: { departementId: query.departementId } }
        : {}),
      ...(Object.keys(seance).length ? { seance } : {}),
    };

    if (user.role !== Role.ENSEIGNANT && !estChefDeDepartement(user)) {
      const pagination = paginer(query);
      return Promise.all([
        this.delegate.findMany({
          where,
          include: JUSTIFICATIF_INCLUDE,
          omit: { piece: true },
          orderBy: this.orderByDe(query),
          skip: pagination.skip,
          take: pagination.take,
        }),
        this.delegate.count({ where }),
      ]).then(([data, total]) => pagine(data, total, pagination));
    }

    const pagination = paginer(query);
    return Promise.all([
      this.delegate.findMany({
        where,
        // Le chef arbitre le dossier dans son département, mais les pièces
        // médicales restent réservées au détail ADMIN/DIRECTION/SCOLARITE.
        select: JUSTIFICATIF_ENSEIGNANT_SELECT,
        orderBy: this.orderByDe(query),
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.delegate.count({ where }),
    ]).then(([data, total]) => pagine(data, total, pagination));
  }

  async findOnePour(id: string, user: AuthUser) {
    const where = user.role === Role.ENSEIGNANT
      ? { id, enseignantId: user.enseignantId ?? '__aucun__' }
      : estChefDeDepartement(user)
        ? { id, ...filtreDepartement(user, 'seance.affectation.promotion.filiere') }
        : { id };
    const justificatif = user.role === Role.ENSEIGNANT || estChefDeDepartement(user)
      ? await this.delegate.findFirst({ where, select: JUSTIFICATIF_ENSEIGNANT_SELECT })
      : await this.delegate.findFirst({ where, include: JUSTIFICATIF_INCLUDE });
    if (!justificatif) throw new NotFoundException(t('common.notFound'));
    return justificatif;
  }

  async deposer(dto: CreateJustificatifDto, user: AuthUser) {
    const seance = await this.prisma.seance.findFirst({
      where: {
        id: dto.seanceId,
        ...filtreDepartement(user, 'affectation.promotion.filiere'),
      },
      include: { affectation: true },
    });
    if (!seance) throw new BadRequestException(t('justificatifs.seance_introuvable'));

    const enseignantId = seance.affectation.enseignantId;

    if (dto.enseignantId && dto.enseignantId !== enseignantId) {
      throw new BadRequestException(t('justificatifs.enseignant_ne_correspond_pas_a_la_seance'));
    }

    if (user.role === Role.ENSEIGNANT && seance.affectation.enseignantId !== user.enseignantId) {
      throw new ForbiddenException(t('justificatifs.cette_seance_ne_vous_est_pas_affectee'));
    }

    const existant = await this.prisma.justificatif.findUnique({
      where: { seanceId: dto.seanceId },
    });
    if (existant) {
      throw new BadRequestException(t('justificatifs.un_justificatif_existe_deja_pour_cette_seance'));
    }

    const { enseignantId: _ignore, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      const seanceTx: any = await tx.seance.findFirst({
        where: {
          id: dto.seanceId,
          ...filtreDepartement(user, 'affectation.promotion.filiere'),
        },
        include: { affectation: true },
      });
      if (!seanceTx) throw new BadRequestException(t('justificatifs.seance_introuvable'));
      await exigerAnneeOuverte(tx, seanceTx.anneeId);
      const dejaPresent = await tx.justificatif.findUnique({ where: { seanceId: dto.seanceId }, select: { id: true } });
      if (dejaPresent) throw new BadRequestException(t('justificatifs.un_justificatif_existe_deja_pour_cette_seance'));
      const data = { ...rest, enseignantId: seanceTx.affectation.enseignantId };
      const justificatif = estChefDeDepartement(user) || user.role === Role.ENSEIGNANT
        ? await tx.justificatif.create({ data, select: JUSTIFICATIF_ENSEIGNANT_SELECT })
        : await tx.justificatif.create({ data, include: JUSTIFICATIF_INCLUDE });
      await journaliser(
        tx,
        user,
        'JUSTIFICATIF_DEPOSE',
        'Justificatif',
        justificatif.id,
        { avant: null, apres: this.instantaneAudit(justificatif) },
      );
      return justificatif;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Validation : la séance passe en absence excusée. */
  async traiter(id: string, dto: TraiterJustificatifDto, user: AuthUser) {
    await this.findOnePour(id, user);
    if (dto.statut !== StatutJustificatif.VALIDE && dto.statut !== StatutJustificatif.REJETE) {
      throw new BadRequestException(t('justificatifs.decision_finale_requise'));
    }

    await this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.justificatif.findUnique({
        where: { id }, include: { seance: { select: { id: true, anneeId: true, affectation: { select: { promotion: { select: { filiere: { select: { departementId: true } } } } } } } } },
      });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      if (estChefDeDepartement(user) && (!user.departementId || avant.seance.affectation.promotion.filiere.departementId !== user.departementId)) {
        throw new NotFoundException(t('common.notFound'));
      }
      await exigerAnneeOuverte(tx, avant.seance.anneeId);
      if (avant.statut !== StatutJustificatif.EN_ATTENTE) {
        throw new BadRequestException(t('justificatifs.deja_traite'));
      }
      const decision = await tx.justificatif.updateMany({
        where: { id, statut: StatutJustificatif.EN_ATTENTE },
        data: {
          statut: dto.statut,
          commentaire: dto.commentaire,
          traiteParId: user.id,
          traiteLe: new Date(),
        },
      });
      if (decision.count !== 1) throw new BadRequestException(t('justificatifs.deja_traite'));
      const apres = await tx.justificatif.findUniqueOrThrow({ where: { id }, include: JUSTIFICATIF_INCLUDE });

      if (dto.statut === StatutJustificatif.VALIDE) {
        await tx.controle.upsert({
          where: { seanceId: avant.seanceId },
          create: {
            seanceId: avant.seanceId,
            controleurId: user.id,
            statut: StatutPresence.EXCUSE,
            methode: MethodeVerification.MANUEL,
            dureeMinutes: 0,
            observation: 'Absence justifiée',
          },
          update: {
            statut: StatutPresence.EXCUSE,
            observation: 'Absence justifiée',
          },
        });
      }

      await journaliser(
        tx,
        user,
        `JUSTIFICATIF_${dto.statut}`,
        'Justificatif',
        id,
        { avant: this.instantaneAudit(avant), apres: this.instantaneAudit(apres) },
      );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Relecture après mise à jour du contrôle : la réponse reflète l'état final.
    return this.findOnePour(id, user);
  }

  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.justificatif.findUnique({
        where: { id }, include: { seance: { select: { id: true, anneeId: true } } },
      });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      await exigerAnneeOuverte(tx, avant.seance.anneeId);
      if (avant.statut !== StatutJustificatif.EN_ATTENTE) {
        throw new BadRequestException(t('justificatifs.deja_traite'));
      }
      await tx.justificatif.delete({ where: { id } });
      await journaliser(
        tx,
        user ?? null,
        'JUSTIFICATIF_SUPPRIME',
        'Justificatif',
        id,
        { avant: this.instantaneAudit(avant), apres: null },
      );
      return { id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private instantaneAudit(justificatif: any) {
    return {
      id: justificatif.id, seanceId: justificatif.seanceId, enseignantId: justificatif.enseignantId,
      type: justificatif.type, statut: justificatif.statut,
      traiteParId: justificatif.traiteParId ?? null, traiteLe: justificatif.traiteLe ?? null,
    };
  }
}

@ApiTags('Justificatifs')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT, Role.ENSEIGNANT)
@Controller('justificatifs')
export class JustificatifsController {
  constructor(private readonly service: JustificatifsService) {}

  @Get() liste(@Query() query: JustificatifQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOnePour(id, user);
  }

  /** Déposé par l'administration pour le compte de l'enseignant, sur pièce. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Post() deposer(@Body() dto: CreateJustificatifDto, @CurrentUser() user: AuthUser) {
    return this.service.deposer(dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION, Role.CHEF_DEPARTEMENT)
  @Put(':id/traiter') traiter(
    @Param('id') id: string,
    @Body() dto: TraiterJustificatifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.traiter(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.DIRECTION)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}

@Module({
  controllers: [JustificatifsController],
  providers: [JustificatifsService],
  exports: [JustificatifsService],
})
export class JustificatifsModule {}
