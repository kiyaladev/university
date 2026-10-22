/**
 * Registre /paiements : encaissements de scolarité et paiements libres du
 * guichet, confirmation pilote et annulation.
 *
 * La table Paiement est partagée avec les formations, le resto, les recettes
 * externes et les demandes de documents. La liste les montre tous, avec leur
 * `source` ; confirmation et annulation ne s'appliquent qu'aux paiements de
 * source INSCRIPTION, les autres se gèrent dans leur module.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModePaiement, Prisma, StatutInscription, StatutPaiement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { t } from '../../common/i18n';
import { exigerAnneeOuverte } from '../../common/annee';
import { anneeNumero } from '../../common/numero';
import {
  PAIEMENT_SOURCE_INCLUDE,
  SourcePaiement,
  creerPaiementTx,
  sourcePaiement,
  transmettreMobileMoney,
} from '../../common/finances';
import { prochainNumeroPaiement } from './etudiants.service';
import { MobileMoneyService } from './mobile-money.service';
import {
  AnnulerPaiementDto,
  CreatePaiementDto,
  PaiementQueryDto,
  SimulerPaiementDto,
} from './inscription.dto';

export const PAIEMENT_INCLUDE = {
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
  inscription: { select: { id: true, numero: true, anneeId: true, statut: true, montantFrais: true } },
  inscriptionFormation: { select: { id: true, numero: true, formationId: true, statut: true } },
  annee: { select: { id: true, libelle: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  annulePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.PaiementInclude;

/**
 * PAIEMENT_INCLUDE complété des liens vers les autres portefeuilles, de quoi
 * calculer la source. La sélection de PAIEMENT_INCLUDE l'emporte.
 */
const PAIEMENT_AVEC_SOURCE_INCLUDE = {
  ...PAIEMENT_SOURCE_INCLUDE,
  ...PAIEMENT_INCLUDE,
} satisfies Prisma.PaiementInclude;

/**
 * Message du refus, par source, quand /paiements est sollicité pour un
 * paiement d'un autre portefeuille : le confirmer ou l'annuler ici sauterait
 * le crédit du solde resto, le passage de la demande de document en PAYEE,
 * le contrôle de capacité d'une formation ou le circuit des recettes.
 */
const REFUS_SIMULATION: Record<Exclude<SourcePaiement, 'INSCRIPTION'>, string> = {
  FORMATION: 'inscription.paiement_formation_confirme_par_action_de_formation',
  RESTO: 'inscription.paiement_resto_confirme_par_la_recharge',
  RECETTE: 'inscription.paiement_recette_geree_par_les_recettes',
  DOCUMENT: 'inscription.paiement_document_confirme_par_la_demande',
};
const REFUS_ANNULATION: Record<Exclude<SourcePaiement, 'INSCRIPTION'>, string> = {
  FORMATION: 'inscription.paiement_formation_annule_par_la_formation',
  RESTO: 'inscription.paiement_resto_annule_par_la_recharge',
  RECETTE: 'inscription.paiement_recette_geree_par_les_recettes',
  DOCUMENT: 'inscription.paiement_document_annule_par_la_demande',
};

function exigerSourceInscription(
  paiement: Parameters<typeof sourcePaiement>[0],
  messages: Record<Exclude<SourcePaiement, 'INSCRIPTION'>, string>,
) {
  const source = sourcePaiement(paiement);
  if (source !== 'INSCRIPTION') throw new ConflictException(t(messages[source]));
}

/**
 * Paiements qui règlent la scolarité d'un dossier : les frais de demandes de
 * documents sont rattachés au dossier pour la traçabilité, mais ne soldent pas
 * l'inscription.
 */
export const PAIEMENT_SCOLARITE: Prisma.PaiementWhereInput = { demandeDocument: { is: null } };

/** Devise des frais d'un dossier : celle du tarif officiel de sa promotion. */
export async function deviseDossier(
  tx: Pick<Prisma.TransactionClient, 'frais'>,
  dossier: { anneeId: string; promotionId: string },
) {
  const frais = await tx.frais.findUnique({
    where: { anneeId_promotionId: { anneeId: dossier.anneeId, promotionId: dossier.promotionId } },
    select: { devise: true },
  });
  return frais?.devise ?? 'GNF';
}

function instantanePaiement(paiement: any) {
  if (!paiement) return null;
  return {
    id: paiement.id,
    reference: paiement.reference,
    anneeId: paiement.anneeId ?? paiement.inscription?.anneeId ?? null,
    inscriptionId: paiement.inscriptionId,
    etudiantId: paiement.etudiantId,
    montant: paiement.montant,
    devise: paiement.devise,
    mode: paiement.mode,
    operateur: paiement.operateur,
    statut: paiement.statut,
    completeLe: paiement.completeLe,
    annuleLe: paiement.annuleLe,
  };
}

@Injectable()
export class PaiementsService {
  private readonly logger = new Logger(PaiementsService.name);

  constructor(
    private prisma: PrismaService,
    private mobileMoney: MobileMoneyService,
  ) {}

  /** Tous les paiements, quel que soit leur portefeuille, avec leur `source`. */
  async listePaiements(query: PaiementQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));

    const where: Prisma.PaiementWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.inscriptionId ? { inscriptionId: query.inscriptionId } : {}),
      ...(query.anneeId ? { inscription: { anneeId: query.anneeId } } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              {
                etudiant: {
                  OR: [
                    { nom: { contains: query.search, mode: 'insensitive' } },
                    { prenom: { contains: query.search, mode: 'insensitive' } },
                    { matricule: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [lignes, total] = await Promise.all([
      this.prisma.paiement.findMany({
        where,
        include: PAIEMENT_AVEC_SOURCE_INCLUDE,
        orderBy: { horodatage: 'desc' },
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.paiement.count({ where }),
    ]);
    // Les liens chargés pour le calcul ne sortent pas : la réponse garde la
    // forme de PAIEMENT_INCLUDE, plus `source`.
    const data = lignes.map(({ recharges, rechargesRecette, demandeDocument, ...paiement }) => ({
      ...paiement,
      source: sourcePaiement({
        inscriptionFormation: paiement.inscriptionFormation,
        recharges,
        rechargesRecette,
        demandeDocument,
      }),
    }));
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouverPaiement(id: string) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { id },
      include: PAIEMENT_INCLUDE,
    });
    if (!paiement) throw new NotFoundException(t('inscription.paiement_introuvable'));
    return paiement;
  }

  /**
   * Encaissement. La référence "PAY-AAAA-NNNNN" est générée à la création.
   * En Mobile Money, la demande est transmise à l'opérateur (ou simulée en
   * pilote, sans URL) et reste EN_ATTENTE jusqu'à la confirmation.
   */
  async creerPaiement(dto: CreatePaiementDto, user: AuthUser) {
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const paiement = await this.prisma.$transaction(async (tx) => {
          const inscription = dto.inscriptionId
            ? await tx.inscription.findUnique({
                where: { id: dto.inscriptionId },
                select: { id: true, etudiantId: true, anneeId: true, promotionId: true },
              })
            : null;
          if (dto.inscriptionId && !inscription) {
            throw new NotFoundException(t('inscription.inscription_introuvable'));
          }
          // Aucune conversion n'existe : un paiement de scolarité doit être
          // dans la devise du tarif du dossier, sinon le cumul n'a pas de sens.
          const devisePaiement = inscription
            ? await deviseDossier(tx, inscription)
            : 'GNF';
          if (inscription && dto.devise && dto.devise !== devisePaiement) {
            throw new BadRequestException(t('inscription.devise_incompatible', {
              devise: dto.devise,
              deviseDossier: devisePaiement,
            }));
          }
          if (inscription && dto.anneeId && dto.anneeId !== inscription.anneeId) {
            throw new BadRequestException(t('common.academicYearMismatch'));
          }
          const anneeId = dto.anneeId ?? inscription?.anneeId
            ?? (await tx.anneeAcademique.findFirst({ where: { active: true, cloturee: false } }))?.id;
          if (!anneeId) {
            throw new BadRequestException(t('common.academicYearRequired'));
          }
          const annee = await tx.anneeAcademique.findUnique({
            where: { id: anneeId },
            select: { id: true, libelle: true },
          });
          if (!annee) throw new BadRequestException(t('common.academicYearNotFound'));
          await exigerAnneeOuverte(tx, annee.id);

          return creerPaiementTx(tx, {
            data: {
              reference: await prochainNumeroPaiement(tx, anneeNumero(annee.libelle)),
              montant: dto.montant,
              devise: dto.devise ?? devisePaiement,
              mode: dto.mode,
              operateur: dto.operateur ?? null,
              telephone: dto.telephone ?? null,
              nomComplet: dto.nomComplet ?? null,
              motif: dto.motif ?? null,
              inscriptionId: dto.inscriptionId ?? null,
              anneeId: annee.id,
              etudiantId: dto.etudiantId ?? inscription?.etudiantId ?? null,
              creeParId: user.id,
            },
            include: PAIEMENT_INCLUDE,
          }, { userId: user.id, instantane: instantanePaiement });
        });

        if (paiement.mode === ModePaiement.MOBILE_MONEY && paiement.telephone) {
          const rattache = await transmettreMobileMoney<typeof paiement>(paiement, {
            prisma: this.prisma,
            mobileMoney: this.mobileMoney,
            userId: user.id,
            logger: this.logger,
            instantane: instantanePaiement,
            include: PAIEMENT_INCLUDE,
            // Sans passerelle, MobileMoneyService trace la simulation pilote.
            appelerSansPasserelle: true,
          });
          if (rattache) return rattache;
        }

        return paiement;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('inscription.reference_de_paiement_temporairement_indisponible_reessayez'));
  }

  /**
   * Confirmation pilote : l'agent comptable / le DAF répercute la réponse de
   * l'opérateur (guichet). À un paiement réussi, si le cumul des paiements
   * réussis du dossier atteint les frais, l'inscription passe en PAYEE.
   */
  async simulerPaiement(id: string, dto: SimulerPaiementDto, user: AuthUser) {
    const reussi = dto.statut === 'REUSSI';
    return this.prisma.$transaction(async (tx) => {
      const paiement = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_AVEC_SOURCE_INCLUDE });
      if (!paiement) throw new NotFoundException(t('inscription.paiement_introuvable'));
      // Les paiements des autres portefeuilles ont leur propre confirmation.
      exigerSourceInscription(paiement, REFUS_SIMULATION);
      await exigerAnneeOuverte(tx, paiement.anneeId ?? paiement.inscription?.anneeId);
      if (paiement.statut === StatutPaiement.ANNULE || paiement.statut === StatutPaiement.REMBOURSE) {
        throw new BadRequestException(t('inscription.ce_paiement_est_clos_il_ne_peut_plus_etre_confirme'));
      }
      if (paiement.statut === StatutPaiement.REUSSI && dto.statut !== 'REUSSI') {
        throw new BadRequestException(t('inscription.ce_paiement_est_deja_reussi_impossible_de_le_faire_echouer'));
      }
      if (paiement.statut === StatutPaiement.REUSSI && dto.statut === 'REUSSI') return paiement;

      const transition = await tx.paiement.updateMany({
        where: { id, statut: paiement.statut },
        data: {
          statut: reussi ? StatutPaiement.REUSSI : StatutPaiement.ECHOUE,
          completeLe: reussi ? new Date() : null,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException(t('inscription.ce_paiement_est_clos_il_ne_peut_plus_etre_confirme'));
      }
      const p = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_INCLUDE });
      if (!p) throw new NotFoundException(t('inscription.paiement_introuvable'));

      let inscriptionAudit: { avant: unknown; apres: unknown } | null = null;
      if (reussi && p?.inscriptionId) {
        const dossier = await tx.inscription.findUnique({
          where: { id: p.inscriptionId },
          select: { statut: true, montantFrais: true, anneeId: true, promotionId: true },
        });
        // Seuls les paiements de scolarité, dans la devise du tarif, soldent
        // le dossier : ni frais documentaires, ni montants d'une autre devise.
        const cumul = await tx.paiement.aggregate({
          where: {
            inscriptionId: p.inscriptionId,
            statut: StatutPaiement.REUSSI,
            devise: dossier ? await deviseDossier(tx, dossier) : 'GNF',
            ...PAIEMENT_SCOLARITE,
          },
          _sum: { montant: true },
        });
        if (
          dossier &&
          dossier.statut !== StatutInscription.VALIDEE &&
          dossier.statut !== StatutInscription.ANNULEE &&
          dossier.statut !== StatutInscription.PAYEE &&
          (cumul._sum.montant ?? 0) >= dossier.montantFrais
        ) {
          const changement = await tx.inscription.updateMany({
            where: { id: p.inscriptionId, statut: dossier.statut },
            data: { statut: StatutInscription.PAYEE },
          });
          if (changement.count === 1) {
            inscriptionAudit = {
              avant: { id: p.inscriptionId, statut: dossier.statut, montantFrais: dossier.montantFrais },
              apres: { id: p.inscriptionId, statut: StatutInscription.PAYEE, montantFrais: dossier.montantFrais },
            };
          }
        }
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PAIEMENT_SIMULE',
          entite: 'Paiement',
          entiteId: id,
          details: JSON.stringify({
            avant: instantanePaiement(paiement),
            apres: instantanePaiement(p),
            inscription: inscriptionAudit,
          }),
        },
      });
      return p;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Annulation d'un paiement d'inscription en attente ou échoué — un
   * encaissement se garde. Les paiements des autres portefeuilles se gèrent
   * dans leur module : les annuler ici désynchroniserait la recharge, la
   * demande de document ou l'inscription à la formation qui les porte.
   */
  async annulerPaiement(id: string, dto: AnnulerPaiementDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const paiement = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_AVEC_SOURCE_INCLUDE });
      if (!paiement) throw new NotFoundException(t('inscription.paiement_introuvable'));
      exigerSourceInscription(paiement, REFUS_ANNULATION);
      await exigerAnneeOuverte(tx, paiement.anneeId ?? paiement.inscription?.anneeId);
      if (paiement.statut === StatutPaiement.REUSSI) {
        throw new BadRequestException(t('inscription.paiement_deja_encaisse_il_ne_peut_plus_etre_annule'));
      }
      if (paiement.statut === StatutPaiement.ANNULE) {
        throw new BadRequestException(t('inscription.ce_paiement_est_deja_annule'));
      }
      const transition = await tx.paiement.updateMany({
        where: { id, statut: paiement.statut },
        data: {
          statut: StatutPaiement.ANNULE,
          annuleLe: new Date(),
          annuleParId: user.id,
          motifAnnulation: dto.motif,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException(t('inscription.ce_paiement_est_deja_annule'));
      }
      const maj = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_INCLUDE });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PAIEMENT_ANNULE',
          entite: 'Paiement',
          entiteId: id,
          details: JSON.stringify({ avant: instantanePaiement(paiement), apres: instantanePaiement(maj) }),
        },
      });
      return maj;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
