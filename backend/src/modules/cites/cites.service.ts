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
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutAttributionLogement, StatutChambre } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { exigerAnneeOuverte } from '../../common/annee';
import { t } from '../../common/i18n';
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
import { journaliser } from '../../common/audit';
import { toMontant } from '../../common/finances/montant';

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

  /** Exclut adresse, nom de résidence et coordonnées du responsable. */
  private instantaneAudit(residence: any) {
    return {
      id: residence.id,
      code: residence.code,
      capacite: residence.capacite,
      actif: residence.actif,
      villeRenseignee: Boolean(residence.ville),
      adresseRenseignee: Boolean(residence.adresse),
      responsableRenseigne: Boolean(residence.responsable),
    };
  }

  async creer(dto: CreateResidenceDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.residence.create({ data: dto, include: this.options.include });
      await journaliser(tx, user ?? null, 'RESIDENCE_CREEE', 'Residence', creee.id, {
        avant: null,
        apres: this.instantaneAudit(creee),
        champsModifies: Object.keys(dto),
      });
      return creee;
    });
  }

  async modifier(id: string, dto: UpdateResidenceDto, user?: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.residence.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Résidence' }));
      const apres = await tx.residence.update({ where: { id }, data: dto, include: this.options.include });
      await journaliser(tx, user ?? null, 'RESIDENCE_MODIFIEE', 'Residence', id, {
        avant: this.instantaneAudit(avant),
        apres: this.instantaneAudit(apres),
        champsModifies: Object.keys(dto),
      });
      return apres;
    });
  }

  /** Le parc est un référentiel : on ne supprime que les résidences vides. */
  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const residence = await tx.residence.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            nom: true,
            ville: true,
            adresse: true,
            capacite: true,
            responsable: true,
            actif: true,
            _count: { select: { chambres: true } },
          },
        });
        if (!residence) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Résidence' }));
        const nb = residence._count.chambres;
        if (nb > 0) {
          throw new BadRequestException(
            t('cites.impossible_de_supprimer_la_residence_residence_nom_nb_chambr', {
              'residence.nom': residence.nom,
              nb,
            }),
          );
        }
        await tx.residence.delete({ where: { id } });
        await journaliser(tx, user ?? null, 'RESIDENCE_SUPPRIMEE', 'Residence', id, {
          avant: this.instantaneAudit(residence),
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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

  private instantaneAudit(chambre: any) {
    return {
      id: chambre.id,
      code: chambre.code,
      residenceId: chambre.residenceId,
      categorie: chambre.categorie,
      lits: chambre.lits,
      loyer: toMontant(chambre.loyer),
      devise: chambre.devise,
      statut: chambre.statut,
    };
  }

  /** Une chambre neuve ne démarre jamais occupée : il faut une demande accordée. */
  async creer(dto: CreateChambreDto, user?: AuthUser) {
    if (dto.statut === StatutChambre.OCCUPEE) {
      throw new BadRequestException(t('cites.une_chambre_ne_peut_pas_etre_creee_occupee_elle_doit_d_abord'));
    }
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.chambre.create({ data: dto, include: this.options.include });
      await journaliser(tx, user ?? null, 'CHAMBRE_CREEE', 'Chambre', creee.id, {
        avant: null,
        apres: this.instantaneAudit(creee),
        champsModifies: Object.keys(dto),
      });
      return creee;
    });
  }

  /**
   * Une chambre ne passe en OCCUPEE que si une attribution lui est
   * effectivement accordée ; un statut posé à la main casserait la
   * transparence de l'attribution.
   */
  async modifier(id: string, dto: UpdateChambreDto, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const avant = await tx.chambre.findUnique({ where: { id } });
        if (!avant) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Chambre' }));
        if (dto.statut !== undefined) {
          const accordee = await tx.attributionLogement.findFirst({
            where: { chambreId: id, statut: StatutAttributionLogement.ACCORDEE },
          });
          if (dto.statut === StatutChambre.OCCUPEE && !accordee) {
            throw new BadRequestException(t('cites.cette_chambre_ne_peut_pas_passer_en_occupee_aucune_attributi'));
          }
          if (accordee && dto.statut !== StatutChambre.OCCUPEE) {
            throw new BadRequestException(t('cites.activeAllocationRequiresOccupied'));
          }
        }
        const apres = await tx.chambre.update({ where: { id }, data: dto, include: this.options.include });
        await journaliser(tx, user ?? null, 'CHAMBRE_MODIFIEE', 'Chambre', id, {
          avant: this.instantaneAudit(avant),
          apres: this.instantaneAudit(apres),
          champsModifies: Object.keys(dto),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Une chambre avec un historique d'attributions se conserve. */
  async remove(id: string, user?: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const chambre = await tx.chambre.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            residenceId: true,
            categorie: true,
            lits: true,
            loyer: true,
            devise: true,
            statut: true,
            _count: { select: { attributions: true } },
          },
        });
        if (!chambre) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Chambre' }));
        const nb = chambre._count.attributions;
        if (nb > 0) {
          throw new BadRequestException(
            t('cites.impossible_de_supprimer_la_chambre_chambre_code_nb_attributi', {
              'chambre.code': chambre.code,
              nb,
            }),
          );
        }
        await tx.chambre.delete({ where: { id } });
        await journaliser(tx, user ?? null, 'CHAMBRE_SUPPRIMEE', 'Chambre', id, {
          avant: this.instantaneAudit(chambre),
          apres: null,
        });
        return { id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
  async creer(dto: CreateAttributionDto, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const anneeId =
          dto.anneeId ??
          (await tx.anneeAcademique.findFirst({ where: { active: true, cloturee: false } }))?.id ??
          undefined;
        await exigerAnneeOuverte(tx, anneeId);
        const chambre = await tx.chambre.findUnique({ where: { id: dto.chambreId } });
        if (!chambre) throw new BadRequestException(t('cites.chambre_introuvable'));
        if (chambre.statut === StatutChambre.OCCUPEE) {
          throw new BadRequestException(t('cites.la_chambre_est_deja_occupee'));
        }
        if (chambre.statut === StatutChambre.MAINTENANCE) {
          throw new BadRequestException(t('cites.la_chambre_est_en_maintenance_aucune_demande_possible'));
        }

        if (anneeId) {
          const accordee = await tx.attributionLogement.findFirst({
            where: {
              etudiantId: dto.etudiantId,
              anneeId,
              statut: StatutAttributionLogement.ACCORDEE,
            },
          });
          if (accordee) {
            throw new BadRequestException(t('cites.cet_etudiant_a_deja_une_chambre_accordee_pour_l_annee_en_cou'));
          }
        }

        // Chambre réservée : seuls sa demande et cet étudiant peuvent la compléter.
        if (chambre.statut === StatutChambre.RESERVEE) {
          const enAttente: any = await tx.attributionLogement.findFirst({
            where: { chambreId: dto.chambreId, statut: StatutAttributionLogement.EN_ATTENTE },
            include: ATTRIBUTION_INCLUDE,
          });
          if (!enAttente || enAttente.etudiantId !== dto.etudiantId) {
            throw new BadRequestException(t('cites.la_chambre_est_deja_reservee_pour_un_autre_etudiant'));
          }
          await exigerAnneeOuverte(tx, enAttente.anneeId);
          const miseAJour = await tx.attributionLogement.update({
            where: { id: enAttente.id },
            data: {
              ...(dto.anneeId ? { anneeId: dto.anneeId } : {}),
              critereScore: dto.critereScore,
              justificatif: dto.justificatif,
            },
            include: ATTRIBUTION_INCLUDE,
          });
          await journaliser(tx, user, 'ATTRIBUTION_MODIFIEE', 'AttributionLogement', miseAJour.id, {
            avant: this.instantaneAudit(enAttente),
            apres: this.instantaneAudit(miseAJour),
          });
          return miseAJour;
        }

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
        await journaliser(tx, user, 'ATTRIBUTION_CREEE', 'AttributionLogement', attribution.id, {
          avant: null,
          apres: this.instantaneAudit(attribution),
        });
        return attribution;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Décision du jury. ACCORDEE : la chambre passe OCCUPEE et les autres
   * demandes en attente sur cette chambre sont refusées (une seule
   * attribution par chambre). REFUSEE : la chambre redevient libre.
   */
  async decider(id: string, dto: DeciderAttributionDto, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const attribution: any = await tx.attributionLogement.findUnique({
          where: { id },
          include: ATTRIBUTION_INCLUDE,
        });
        if (!attribution) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, attribution.anneeId);
        if (attribution.statut !== StatutAttributionLogement.EN_ATTENTE) {
          throw new BadRequestException(t('cites.cette_demande_a_deja_ete_traitee'));
        }

        if (dto.statut === StatutAttributionLogement.ACCORDEE) {
          if (attribution.chambre.statut === StatutChambre.MAINTENANCE) {
            throw new BadRequestException(t('cites.la_chambre_est_en_maintenance_aucune_demande_possible'));
          }
          // Une autre demande peut avoir été accordée depuis le dépôt.
          // La lecture dans la transaction sérialisable protège aussi deux
          // décisions concurrentes portant sur des chambres différentes.
          const concurrente = await tx.attributionLogement.findFirst({
            where: {
              id: { not: id },
              statut: StatutAttributionLogement.ACCORDEE,
              OR: [
                { etudiantId: attribution.etudiantId, anneeId: attribution.anneeId },
                { chambreId: attribution.chambreId },
              ],
            },
          });
          if (concurrente) {
            throw new BadRequestException(t('cites.existingAllocationConflict'));
          }
        }

        const transition = await tx.attributionLogement.updateMany({
          where: { id, statut: StatutAttributionLogement.EN_ATTENTE },
          data:
            dto.statut === StatutAttributionLogement.ACCORDEE
              ? {
                  statut: StatutAttributionLogement.ACCORDEE,
                  accordeeLe: new Date(),
                  accorderParId: user.id,
                }
              : { statut: StatutAttributionLogement.REFUSEE, accorderParId: user.id },
        });
        if (transition.count !== 1) {
          throw new ConflictException(t('cites.cette_demande_a_deja_ete_traitee'));
        }

        const autresEnAttente =
          dto.statut === StatutAttributionLogement.ACCORDEE
            ? await tx.attributionLogement.findMany({
                where: {
                  chambreId: attribution.chambreId,
                  anneeId: attribution.anneeId,
                  statut: StatutAttributionLogement.EN_ATTENTE,
                  id: { not: id },
                },
                select: { id: true },
              })
            : [];
        if (dto.statut === StatutAttributionLogement.ACCORDEE) {
          await tx.attributionLogement.updateMany({
            where: {
              chambreId: attribution.chambreId,
              anneeId: attribution.anneeId,
              statut: StatutAttributionLogement.EN_ATTENTE,
              id: { not: id },
            },
            data: { statut: StatutAttributionLogement.REFUSEE },
          });
          await tx.chambre.update({
            where: { id: attribution.chambreId },
            data: { statut: StatutChambre.OCCUPEE },
          });
        } else {
          await tx.chambre.update({
            where: { id: attribution.chambreId },
            data: { statut: StatutChambre.LIBRE },
          });
        }

        const apres: any = await tx.attributionLogement.findUnique({
          where: { id },
          include: ATTRIBUTION_INCLUDE,
        });
        await journaliser(tx, user, `ATTRIBUTION_${dto.statut}`, 'AttributionLogement', id, {
          commentaire: dto.commentaire ?? null,
          autresRefusees:
            dto.statut === StatutAttributionLogement.ACCORDEE ? autresEnAttente.map((autre) => autre.id) : [],
          avant: this.instantaneAudit(attribution),
          apres: this.instantaneAudit(apres),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Retrait (force de l'administration) : la chambre redevient libre, sauf si
   * une autre demande en attente la maintient réservée.
   */
  async retirer(id: string, dto: RetirerAttributionDto, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const attribution: any = await tx.attributionLogement.findUnique({
          where: { id },
          include: ATTRIBUTION_INCLUDE,
        });
        if (!attribution) throw new NotFoundException(t('common.notFound'));
        await exigerAnneeOuverte(tx, attribution.anneeId);
        if (
          attribution.statut === StatutAttributionLogement.REFUSEE ||
          attribution.statut === StatutAttributionLogement.RETIREE
        ) {
          throw new BadRequestException(t('cites.cette_attribution_n_est_plus_reversible'));
        }

        const transition = await tx.attributionLogement.updateMany({
          where: { id, statut: attribution.statut },
          data: {
            statut: StatutAttributionLogement.RETIREE,
            retireeLe: new Date(),
            retireeMotif: dto.motif,
          },
        });
        if (transition.count !== 1) {
          throw new ConflictException(t('cites.cette_attribution_n_est_plus_reversible'));
        }
        const autreAttente = await tx.attributionLogement.findFirst({
          where: {
            chambreId: attribution.chambreId,
            anneeId: attribution.anneeId,
            statut: StatutAttributionLogement.EN_ATTENTE,
            id: { not: id },
          },
        });
        await tx.chambre.update({
          where: { id: attribution.chambreId },
          data: { statut: autreAttente ? StatutChambre.RESERVEE : StatutChambre.LIBRE },
        });
        const apres: any = await tx.attributionLogement.findUnique({
          where: { id },
          include: ATTRIBUTION_INCLUDE,
        });
        await journaliser(tx, user, 'ATTRIBUTION_RETIREE', 'AttributionLogement', id, {
          avant: this.instantaneAudit(attribution),
          apres: this.instantaneAudit(apres),
        });
        return apres;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private instantaneAudit(attribution: any) {
    return {
      id: attribution.id,
      statut: attribution.statut,
      anneeId: attribution.anneeId,
      chambreId: attribution.chambreId,
      etudiantId: attribution.etudiantId,
      critereScore: attribution.critereScore,
      accordeeLe: attribution.accordeeLe ?? null,
      accorderParId: attribution.accorderParId ?? null,
      retireeLe: attribution.retireeLe ?? null,
    };
  }
}
