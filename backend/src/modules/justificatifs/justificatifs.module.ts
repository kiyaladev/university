/** Justification des absences : l'administration dépose sur pièce, la direction
 *  arbitre. L'enseignant consulte ses justificatifs, il n'en dépose pas.
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
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import {
  MethodeVerification,
  Prisma,
  Role,
  StatutJustificatif,
  StatutPresence,
  TypeJustificatif,
} from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CrudService } from '../../common/crud.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { QueryDto } from '../../common/dto';
import { toDateOnly } from '../../common/utils';

export class CreateJustificatifDto {
  @IsUUID() seanceId: string;
  @IsEnum(TypeJustificatif) type: TypeJustificatif;
  @IsString() motif: string;
  /** Pièce jointe encodée (data-url) : certificat médical, ordre de mission… */
  @IsOptional() @IsString() piece?: string;
  /** Enseignant concerné ; à défaut, celui de la séance. */
  @IsOptional() @IsUUID() enseignantId?: string;
}

export class UpdateJustificatifDto extends PartialType(CreateJustificatifDto) {}

export class TraiterJustificatifDto {
  @IsEnum(StatutJustificatif) statut: StatutJustificatif;
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
  enseignant: { include: { departement: true } },
  traitePar: { select: { id: true, nom: true, prenom: true, role: true } },
  seance: {
    include: {
      salle: true,
      controle: true,
      affectation: { include: { matiere: true, promotion: true } },
    },
  },
};

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

    return this.findAll(query, {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(user.role === Role.ENSEIGNANT
        ? { enseignantId: user.enseignantId ?? '—' }
        : query.enseignantId
          ? { enseignantId: query.enseignantId }
          : {}),
      ...(query.departementId || user.role === Role.CHEF_DEPARTEMENT
        ? {
            enseignant: {
              departementId: query.departementId ?? user.departementId ?? undefined,
            },
          }
        : {}),
      ...(Object.keys(date).length ? { seance: { date } } : {}),
    });
  }

  async deposer(dto: CreateJustificatifDto, user: AuthUser) {
    const seance = await this.prisma.seance.findUnique({
      where: { id: dto.seanceId },
      include: { affectation: true },
    });
    if (!seance) throw new BadRequestException('Séance introuvable');

    const enseignantId =
      user.role === Role.ENSEIGNANT
        ? (user.enseignantId ?? '')
        : (dto.enseignantId ?? seance.affectation.enseignantId);

    if (user.role === Role.ENSEIGNANT && seance.affectation.enseignantId !== enseignantId) {
      throw new ForbiddenException("Cette séance ne vous est pas affectée");
    }

    const existant = await this.prisma.justificatif.findUnique({
      where: { seanceId: dto.seanceId },
    });
    if (existant) {
      throw new BadRequestException('Un justificatif existe déjà pour cette séance');
    }

    const { enseignantId: _ignore, ...rest } = dto;
    return this.create({ ...rest, enseignantId });
  }

  /** Validation : la séance passe en absence excusée. */
  async traiter(id: string, dto: TraiterJustificatifDto, user: AuthUser) {
    const justificatif: any = await this.findOne(id);

    await this.prisma.justificatif.update({
      where: { id },
      data: {
        statut: dto.statut,
        commentaire: dto.commentaire,
        traiteParId: user.id,
        traiteLe: new Date(),
      },
    });

    if (dto.statut === StatutJustificatif.VALIDE) {
      await this.prisma.controle.upsert({
        where: { seanceId: justificatif.seanceId },
        create: {
          seanceId: justificatif.seanceId,
          controleurId: user.id,
          statut: StatutPresence.EXCUSE,
          methode: MethodeVerification.MANUEL,
          dureeMinutes: 0,
          observation: `Absence justifiée (${justificatif.type}) : ${justificatif.motif}`,
        },
        update: {
          statut: StatutPresence.EXCUSE,
          observation: `Absence justifiée (${justificatif.type}) : ${justificatif.motif}`,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `JUSTIFICATIF_${dto.statut}`,
        entite: 'Justificatif',
        entiteId: id,
        details: justificatif.motif,
      },
    });

    // Relecture après mise à jour du contrôle : la réponse reflète l'état final.
    return this.findOne(id);
  }
}

@ApiTags('Justificatifs')
@ApiBearerAuth()
@Controller('justificatifs')
export class JustificatifsController {
  constructor(private readonly service: JustificatifsService) {}

  @Get() liste(@Query() query: JustificatifQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.liste(query, user);
  }

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
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
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@Module({
  controllers: [JustificatifsController],
  providers: [JustificatifsService],
  exports: [JustificatifsService],
})
export class JustificatifsModule {}
