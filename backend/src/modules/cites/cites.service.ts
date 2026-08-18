/**
 * Module A — Cités universitaires & logements.
 *
 * Attribution transparente des chambres : critères sociaux/mérite (score),
 * pas de favoritisme. Le jury (direction) tranche les demandes posées par la
 * scolarité ; l'administration gère le parc (résidences → chambres → loyers).
 *
 * Cycle d'une chambre :
 *   LIBRE → RESERVEE (demande EN_ATTENTE) → OCCUPEE (demande ACCORDEE)
 *   ↳ REFUSEE : la chambre redevient LIBRE
 *   ↳ RETIREE : la chambre redevient LIBRE (ou RESERVEE si une autre demande
 *     est encore en attente)
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutAttributionLogement, StatutChambre } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AttributionQueryDto,
  CreateAttributionDto,
  CreateChambreDto,
  CreateResidenceDto,
  DeciderAttributionDto,
  RetirerAttributionDto,
  UpdateChambreDto,
  UpdateResidenceDto,
} from './cites.dto';

const RESIDENCE_INCLUDE = {
  _count: { select: { chambres: true } },
  chambres: { select: { id: true, code: true, statut: true } },
};

const CHAMBRE_INCLUDE = {
  residence: true,
  _count: { select: { attributions: true } },
};

const ATTRIBUTION_INCLUDE = {
  chambre: { include: { residence: true } },
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
  annee: true,
};

@Injectable()
export class ResidencesService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'residence', {
      searchFields: ['code', 'nom', 'ville', 'responsable'],
      orderBy: [{ code: 'asc' }],
      include: RESIDENCE_INCLUDE,
      label: 'Résidence',
    });
  }

  /** Le parc est un référentiel : on ne supprime que les résidences vides. */
  async remove(id: string) {
    const residence: any = await this.findOne(id);
    const nb = residence._count?.chambres ?? 0;
    if (nb > 0) {
      throw new BadRequestException(
        `Impossible de supprimer la résidence ${residence.nom} : ${nb} chambre(s) y sont rattachées. Réaffectez-les d'abord.`,
      );
    }
    return super.remove(id);
  }
}

@Injectable()
export class ChambresService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'chambre', {
      searchFields: ['code'],
      orderBy: [{ code: 'asc' }],
      include: CHAMBRE_INCLUDE,
      label: 'Chambre',
    });
  }

  /** Une chambre neuve ne démarre jamais occupée : il faut une demande accordée. */
  async creer(dto: CreateChambreDto) {
    if (dto.statut === StatutChambre.OCCUPEE) {
      throw new BadRequestException(
        "Une chambre ne peut pas être créée OCCUPEE : elle doit d'abord faire l'objet d'une attribution accordée par le jury.",
      );
    }
    return this.create(dto);
  }

  /**
   * Une chambre ne passe en OCCUPEE que si une attribution lui est
   * effectivement accordée ; un statut posé à la main casserait la
   * transparence de l'attribution.
   */
  async modifier(id: string, dto: UpdateChambreDto) {
    if (dto.statut === StatutChambre.OCCUPEE) {
      const accordee = await this.prisma.attributionLogement.findFirst({
        where: { chambreId: id, statut: StatutAttributionLogement.ACCORDEE },
      });
      if (!accordee) {
        throw new BadRequestException(
          "Cette chambre ne peut pas passer en OCCUPEE : aucune attribution n'est accordée pour elle.",
        );
      }
    }
    return this.update(id, dto);
  }

  /** Une chambre avec un historique d'attributions se conserve. */
  async remove(id: string) {
    const chambre: any = await this.findOne(id);
    const nb = chambre._count?.attributions ?? 0;
    if (nb > 0) {
      throw new BadRequestException(
        `Impossible de supprimer la chambre ${chambre.code} : ${nb} attribution(s) y sont rattachées.`,
      );
    }
    return super.remove(id);
  }
}

@Injectable()
export class AttributionsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'attributionLogement', {
      orderBy: { createdAt: 'desc' },
      include: ATTRIBUTION_INCLUDE,
      label: 'Attribution de logement',
    });
  }

  liste(query: AttributionQueryDto) {
    const { search, ...rest } = query;
    return this.findAll(rest, {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.chambreId ? { chambreId: query.chambreId } : {}),
      ...(query.residenceId ? { chambre: { residenceId: query.residenceId } } : {}),
      ...(search
        ? {
            etudiant: {
              OR: [
                { nom: { contains: search, mode: 'insensitive' } },
                { prenom: { contains: search, mode: 'insensitive' } },
                { matricule: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    });
  }

  /**
   * Nouvelle demande : la chambre doit être LIBRE, ou RESERVEE par le même
   *   étudiant (sa demande en attente est alors enrichie). Un étudiant ne peut
   *   pas avoir deux chambres accordées sur la même année.
   */
  async creer(dto: CreateAttributionDto) {
    const chambre = await this.prisma.chambre.findUnique({
      where: { id: dto.chambreId },
    });
    if (!chambre) throw new BadRequestException('Chambre introuvable');
    if (chambre.statut === StatutChambre.OCCUPEE) {
      throw new BadRequestException('La chambre est déjà occupée.');
    }
    if (chambre.statut === StatutChambre.MAINTENANCE) {
      throw new BadRequestException('La chambre est en maintenance, aucune demande possible.');
    }

    const anneeId = dto.anneeId
      ?? (await this.prisma.anneeAcademique.findFirst({ where: { active: true } }))?.id
      ?? undefined;

    if (anneeId) {
      const accordee = await this.prisma.attributionLogement.findFirst({
        where: {
          etudiantId: dto.etudiantId,
          anneeId,
          statut: StatutAttributionLogement.ACCORDEE,
        },
      });
      if (accordee) {
        throw new BadRequestException(
          "Cet étudiant a déjà une chambre accordée pour l'année en cours.",
        );
      }
    }

    // Chambre réservée : seuls sa demande et cet étudiant peuvent la compléter.
    if (chambre.statut === StatutChambre.RESERVEE) {
      const enAttente = await this.prisma.attributionLogement.findFirst({
        where: { chambreId: dto.chambreId, statut: StatutAttributionLogement.EN_ATTENTE },
      });
      if (!enAttente || enAttente.etudiantId !== dto.etudiantId) {
        throw new BadRequestException('La chambre est déjà réservée pour un autre étudiant.');
      }
      return this.update(enAttente.id, {
        ...(dto.anneeId ? { anneeId: dto.anneeId } : {}),
        critereScore: dto.critereScore,
        justificatif: dto.justificatif,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const attribution = await tx.attributionLogement.create({
        data: {
          chambreId: dto.chambreId,
          etudiantId: dto.etudiantId,
          anneeId: anneeId ?? null,
          critereScore: dto.critereScore,
          justificatif: dto.justificatif,
        },
        include: ATTRIBUTION_INCLUDE,
      });
      await tx.chambre.update({
        where: { id: dto.chambreId },
        data: { statut: StatutChambre.RESERVEE },
      });
      return attribution;
    });
  }

  /**
   * Décision du jury. ACCORDEE : la chambre passe OCCUPEE et les autres
   * demandes en attente sur cette chambre sont refusées (une seule
   * attribution par chambre). REFUSEE : la chambre redevient libre.
   */
  async decider(id: string, dto: DeciderAttributionDto, user: AuthUser) {
    const attribution: any = await this.findOne(id);
    if (attribution.statut !== StatutAttributionLogement.EN_ATTENTE) {
      throw new BadRequestException('Cette demande a déjà été traitée.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.statut === StatutAttributionLogement.ACCORDEE) {
        await tx.attributionLogement.updateMany({
          where: {
            chambreId: attribution.chambreId,
            statut: StatutAttributionLogement.EN_ATTENTE,
            id: { not: id },
          },
          data: { statut: StatutAttributionLogement.REFUSEE },
        });
        await tx.chambre.update({
          where: { id: attribution.chambreId },
          data: { statut: StatutChambre.OCCUPEE },
        });
        await tx.attributionLogement.update({
          where: { id },
          data: {
            statut: StatutAttributionLogement.ACCORDEE,
            accordeeLe: new Date(),
            accorderParId: user.id,
          },
        });
      } else {
        await tx.attributionLogement.update({
          where: { id },
          data: { statut: StatutAttributionLogement.REFUSEE, accorderParId: user.id },
        });
        await tx.chambre.update({
          where: { id: attribution.chambreId },
          data: { statut: StatutChambre.LIBRE },
        });
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `ATTRIBUTION_${dto.statut}`,
        entite: 'AttributionLogement',
        entiteId: id,
        details: dto.commentaire || attribution.justificatif || attribution.chambre?.code,
      },
    });
    return this.findOne(id);
  }

  /**
   * Retrait (force de l'administration) : la chambre redevient libre, sauf si
   * une autre demande en attente la maintient réservée.
   */
  async retirer(id: string, dto: RetirerAttributionDto, user: AuthUser) {
    const attribution: any = await this.findOne(id);
    if (
      attribution.statut === StatutAttributionLogement.REFUSEE
      || attribution.statut === StatutAttributionLogement.RETIREE
    ) {
      throw new BadRequestException('Cette attribution n’est plus réversible.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.attributionLogement.update({
        where: { id },
        data: {
          statut: StatutAttributionLogement.RETIREE,
          retireeLe: new Date(),
          retireeMotif: dto.motif,
        },
      });
      const autreAttente = await tx.attributionLogement.findFirst({
        where: {
          chambreId: attribution.chambreId,
          statut: StatutAttributionLogement.EN_ATTENTE,
          id: { not: id },
        },
      });
      await tx.chambre.update({
        where: { id: attribution.chambreId },
        data: { statut: autreAttente ? StatutChambre.RESERVEE : StatutChambre.LIBRE },
      });
      return attribution;
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ATTRIBUTION_RETIREE',
        entite: 'AttributionLogement',
        entiteId: id,
        details: dto.motif || attribution.chambre?.code,
      },
    });
    return this.findOne(id);
  }
}