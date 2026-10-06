/**
 * Module 1 — Inscriptions en ligne & paiement Mobile Money.
 *
 * Le candidat dépose son dossier sans compte (page publique), l'inscription
 * naît en EN_ATTENTE_PAIEMENT avec le montant de la table Frais pour sa
 * promotion, un paiement Mobile Money lui est demandé, la confirmation (mode
 * pilote : l'agent comptable la simule) passe le dossier en PAYEE dès que le
 * cumul des paiements réussis couvre les frais, puis la scolarité la VALIDE.
 * Le numéro "INS-2026-00042" est l'identifiant de tous les autres modules.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModePaiement, Prisma, Role, StatutInscription, StatutPaiement } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { CrudService } from '../../common/crud.service';
import { isoDate, toDateOnly } from '../../common/utils';
import { ParametresService } from '../parametres/parametres.module';
import {
  EtudiantsService,
  anneeNumero,
  prochainMatricule,
  prochainNumeroInscription,
  prochainNumeroPaiement,
} from './etudiants.service';
import { MobileMoneyService } from './mobile-money.service';
import { echapper } from '../../common/utils';
import { t } from '../../common/i18n';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from '../../common/annee';
import {
  AnnulerPaiementDto,
  CreateFraisDto,
  CreateInscriptionDto,
  CreatePaiementDto,
  FraisQueryDto,
  InscriptionPubliqueDto,
  InscriptionQueryDto,
  PaiementQueryDto,
  SimulerPaiementDto,
  UpdateFraisDto,
} from './inscription.dto';

export const INSCRIPTION_INCLUDE = {
  etudiant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      sexe: true,
      telephone: true,
      email: true,
    },
  },
  annee: { select: { id: true, libelle: true } },
  promotion: { include: { filiere: true } },
  valideePar: { select: { id: true, nom: true, prenom: true } },
  paiements: {
    orderBy: { horodatage: 'desc' },
    select: {
      id: true,
      reference: true,
      montant: true,
      devise: true,
      mode: true,
      operateur: true,
      statut: true,
      horodatage: true,
      completeLe: true,
      annuleLe: true,
    },
  },
} satisfies Prisma.InscriptionInclude;

export const PAIEMENT_INCLUDE = {
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
  inscription: { select: { id: true, numero: true, anneeId: true, statut: true, montantFrais: true } },
  inscriptionFormation: { select: { id: true, numero: true, formationId: true, statut: true } },
  annee: { select: { id: true, libelle: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  annulePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.PaiementInclude;

export const FRAIS_INCLUDE = {
  annee: { select: { id: true, libelle: true } },
  promotion: { include: { filiere: true } },
} satisfies Prisma.FraisInclude;

const LIBELLE_STATUT_INSCRIPTION: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  PAYEE: 'Frais payés',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

/** Instantanés limités aux données de gestion, sans coordonnées ou motif libre. */
function instantaneInscription(inscription: any) {
  if (!inscription) return null;
  return {
    id: inscription.id,
    numero: inscription.numero,
    etudiantId: inscription.etudiantId,
    anneeId: inscription.anneeId,
    promotionId: inscription.promotionId,
    statut: inscription.statut,
    montantFrais: inscription.montantFrais,
  };
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
export class InscriptionService {
  private readonly logger = new Logger(InscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private etudiants: EtudiantsService,
    private mobileMoney: MobileMoneyService,
    private parametres: ParametresService,
  ) {}

  // ----------------------------------------------------------- consultation

  private async anneeRetenue(anneeId?: string) {
    if (anneeId) {
      const annee = await this.prisma.anneeAcademique.findUnique({ where: { id: anneeId } });
      if (!annee) throw new BadRequestException(I18nContext.current()!.t('inscription.annee_academique_introuvable'));
      if (annee.cloturee) {
        throw new BadRequestException(I18nContext.current()!.t('inscription.aucune_annee_academique_n_est_ouverte_aux_inscriptions'));
      }
      return annee;
    }
    return (
      (await this.prisma.anneeAcademique.findFirst({
        where: { active: true, cloturee: false },
      })) ?? null
    );
  }

  /** Années ouvertes à la préinscription (page publique). */
  async anneesOuvertes() {
    const annees = await this.prisma.anneeAcademique.findMany({
      where: { cloturee: false },
      orderBy: { dateDebut: 'desc' },
      select: { id: true, libelle: true, dateDebut: true, dateFin: true, active: true },
    });
    return annees;
  }

  /** Promotions d'une année, avec le tarif officiel quand il existe. */
  async promotionsOuvertes(anneeId: string) {
    const annee = await this.prisma.anneeAcademique.findUnique({
      where: { id: anneeId },
      select: { id: true, cloturee: true },
    });
    if (!annee || annee.cloturee) {
      throw new NotFoundException(t('inscription.annee_academique_introuvable'));
    }
    const [promotions, frais] = await Promise.all([
      this.prisma.promotion.findMany({
        where: { anneeId },
        orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
        include: { filiere: { select: { code: true, nom: true } } },
      }),
      this.prisma.frais.findMany({
        where: { anneeId },
        select: { promotionId: true, montant: true, devise: true },
      }),
    ]);
    const fraisParPromotion = new Map(frais.map((f) => [f.promotionId, f]));
    return promotions.map((p) => ({
      id: p.id,
      nom: p.nom,
      niveau: p.niveau,
      filiere: p.filiere,
      frais: fraisParPromotion.get(p.id)
        ? { montant: fraisParPromotion.get(p.id)!.montant, devise: fraisParPromotion.get(p.id)!.devise }
        : null,
    }));
  }

  async listeInscriptions(query: InscriptionQueryDto, user?: AuthUser): Promise<Paginated<any>> {
    if (user?.role === Role.ETUDIANT) query = { ...query, etudiantId: user.etudiantId ?? '__aucun__' };
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));

    const where: Prisma.InscriptionWhereInput = {
      ...(user?.role === Role.CHEF_DEPARTEMENT ? { promotion: { filiere: { departementId: user.departementId ?? '__aucun__' } } } : {}),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
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

    const [data, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        include: INSCRIPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.inscription.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouverInscription(id: string, user?: AuthUser) {
    const where: Prisma.InscriptionWhereInput = {
      id,
      ...(user?.role === Role.ETUDIANT
        ? { etudiantId: user.etudiantId ?? '__aucun__' }
        : {}),
      ...(user?.role === Role.CHEF_DEPARTEMENT
        ? { promotion: { filiere: { departementId: user.departementId ?? '__aucun__' } } }
        : {}),
    };
    const inscription = user
      ? await this.prisma.inscription.findFirst({ where, include: INSCRIPTION_INCLUDE })
      : await this.prisma.inscription.findUnique({ where: { id }, include: INSCRIPTION_INCLUDE });
    if (!inscription) throw new NotFoundException(t('inscription.inscription_introuvable'));
    return inscription;
  }

  // ------------------------------------------------------ dépôt en ligne

  /**
   * Dossier public : crée l'étudiant (matricule + QR resto) s'il n'existe pas
   * encore — même e-mail, même fiche — puis le dossier EN_ATTENTE_PAIEMENT au
   * tarif officiel, ou 0 avec un avertissement si aucun tarif n'est paramétré.
   */
  async depotPublic(dto: InscriptionPubliqueDto, ip?: string) {
    const annee = await this.anneeRetenue(dto.anneeId);
    if (!annee) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.aucune_annee_academique_n_est_ouverte_aux_inscriptions'));
    }

    const promotion = await this.prisma.promotion.findUnique({
      where: { id: dto.promotionId },
    });
    if (!promotion) throw new BadRequestException(I18nContext.current()!.t('inscription.promotion_introuvable'));
    if (promotion.anneeId !== annee.id) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.la_promotion_choisie_n_appartient_pas_a_l_annee_retenue'));
    }

    const frais = await this.prisma.frais.findUnique({
      where: { anneeId_promotionId: { anneeId: annee.id, promotionId: promotion.id } },
      select: { montant: true, devise: true },
    });
    const avertissement = frais
      ? undefined
      : `Aucun tarif n'est paramétré pour ${promotion.nom} sur ${annee.libelle} : le montant est laissé à 0 en attendant.`;

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const resultat = await this.prisma.$transaction(async (tx) => {
          await exigerAnneeOuverte(tx, annee.id);
          let etudiant = dto.email
            ? await tx.etudiant.findUnique({
                where: { email: dto.email },
                select: { id: true },
              })
            : null;

          if (!etudiant) {
            etudiant = await tx.etudiant.create({
              data: {
                nom: dto.nom,
                prenom: dto.prenom,
                sexe: dto.sexe ?? null,
                dateNaissance: dto.dateNaissance ? toDateOnly(dto.dateNaissance) : null,
                lieuNaissance: dto.lieuNaissance ?? null,
                telephone: dto.telephone,
                email: dto.email ?? null,
                adresse: dto.adresse ?? null,
                matricule: await prochainMatricule(tx, anneeNumero(annee.libelle)),
                qrRestoToken: this.etudiants.nouveauQrResto(),
              },
              select: { id: true },
            });
            await tx.auditLog.create({
              data: {
                action: 'ETUDIANT_CREE',
                entite: 'Etudiant',
                entiteId: etudiant.id,
                details: 'Fiche étudiante créée par préinscription en ligne',
                ip: ip ?? null,
              },
            });
          }

          const deja = await tx.inscription.findUnique({
            where: { etudiantId_anneeId: { etudiantId: etudiant.id, anneeId: annee.id } },
            select: { numero: true },
          });
          if (deja) {
            throw new ConflictException(I18nContext.current()!.t('inscription.un_dossier_deja_numero_existe_deja_pour_dto_prenom_dto_nom_s', { args: { 'deja.numero': deja.numero, 'dto.prenom': dto.prenom, 'dto.nom': dto.nom, 'annee.libelle': annee.libelle } }));
          }

          const inscription = await tx.inscription.create({
            data: {
              numero: await prochainNumeroInscription(tx, anneeNumero(annee.libelle)),
              etudiantId: etudiant.id,
              anneeId: annee.id,
              promotionId: promotion.id,
              statut: StatutInscription.EN_ATTENTE_PAIEMENT,
              montantFrais: frais?.montant ?? 0,
            },
            select: { id: true, numero: true, montantFrais: true },
          });
          await tx.auditLog.create({
            data: {
              action: 'INSCRIPTION_CREE',
              entite: 'Inscription',
              entiteId: inscription.id,
              details: `${inscription.numero} — préinscription enregistrée · ${promotion.nom} (${annee.libelle})`,
              ip: ip ?? null,
            },
          });

          return {
            etudiantId: etudiant.id,
            inscriptionId: inscription.id,
            numero: inscription.numero,
            montantFrais: inscription.montantFrais,
            devise: frais?.devise ?? 'GNF',
          };
        });

        return {
          ...resultat,
          avertissement: avertissement ?? null,
          message:
            `Dossier ${resultat.numero} déposé. Réglez ${resultat.montantFrais.toLocaleString('fr-FR')} ` +
            `${resultat.devise} via Mobile Money pour finaliser votre inscription.`,
        };
      } catch (e: any) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(I18nContext.current()!.t('inscription.numero_de_dossier_temporairement_indisponible_reessayez'));
  }

  /** Inscription au guichet (agent comptable / scolarité). */
  async creerInscription(dto: CreateInscriptionDto, user: AuthUser) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: dto.etudiantId },
      select: { id: true, nom: true, prenom: true },
    });
    if (!etudiant) throw new NotFoundException(I18nContext.current()!.t('inscription.etudiant_introuvable'));

    const annee = await this.anneeRetenue(dto.anneeId);
    if (!annee) throw new BadRequestException(I18nContext.current()!.t('inscription.aucune_annee_academique_n_est_active'));

    const promotion = await this.prisma.promotion.findUnique({ where: { id: dto.promotionId } });
    if (!promotion) throw new BadRequestException(I18nContext.current()!.t('inscription.promotion_introuvable'));
    if (promotion.anneeId !== annee.id) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.la_promotion_choisie_n_appartient_pas_a_l_annee_retenue'));
    }

    const existante = await this.prisma.inscription.findUnique({
      where: { etudiantId_anneeId: { etudiantId: dto.etudiantId, anneeId: annee.id } },
      select: { numero: true, statut: true },
    });
    if (existante && existante.statut !== StatutInscription.ANNULEE) {
      throw new ConflictException(I18nContext.current()!.t('inscription.un_dossier_existante_numero_existe_deja_pour_etudiant_prenom', { args: { 'existante.numero': existante.numero, 'etudiant.prenom': etudiant.prenom, 'etudiant.nom': etudiant.nom, 'annee.libelle': annee.libelle } }));
    }

    const frais = await this.prisma.frais.findUnique({
      where: { anneeId_promotionId: { anneeId: annee.id, promotionId: promotion.id } },
      select: { montant: true, devise: true },
    });

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await exigerAnneeOuverte(tx, annee.id);
          const cree = await tx.inscription.create({
            data: {
              numero: await prochainNumeroInscription(tx, anneeNumero(annee.libelle)),
              etudiantId: dto.etudiantId,
              anneeId: annee.id,
              promotionId: promotion.id,
              statut: StatutInscription.EN_ATTENTE_PAIEMENT,
              montantFrais: dto.montantFrais ?? frais?.montant ?? 0,
            },
            include: INSCRIPTION_INCLUDE,
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: 'INSCRIPTION_CREE',
              entite: 'Inscription',
              entiteId: cree.id,
              details: JSON.stringify({ avant: null, apres: instantaneInscription(cree) }),
            },
          });
          return cree;
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(I18nContext.current()!.t('inscription.numero_de_dossier_temporairement_indisponible_reessayez'));
  }

  // ---------------------------------------------------------- cycle de vie

  /** PAYEE → VALIDEE : la scolarité clôt le dossier, frais réglés et justifiés. */
  async validerInscription(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    if (inscription.statut === StatutInscription.ANNULEE) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.ce_dossier_est_annule_impossible_de_le_valider'));
    }
    if (
      inscription.statut !== StatutInscription.PAYEE &&
      inscription.statut !== StatutInscription.VALIDEE
    ) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.inscription_numero_frais_non_regles_statut_libelle_statut_in', { args: { 'inscription.numero': inscription.numero, 'LIBELLE_STATUT_INSCRIPTION[inscription.statut] ?? inscription.statut': LIBELLE_STATUT_INSCRIPTION[inscription.statut] ?? inscription.statut } }));
    }
    if (inscription.statut === StatutInscription.VALIDEE) return inscription;

    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, inscription.anneeId);
      const maj = await tx.inscription.update({
        where: { id },
        data: {
          statut: StatutInscription.VALIDEE,
          dateInscription: new Date(),
          valideeParId: user.id,
          valideeLe: new Date(),
        },
        include: INSCRIPTION_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'INSCRIPTION_VALIDEE',
          entite: 'Inscription',
          entiteId: id,
          details: JSON.stringify({ avant: instantaneInscription(inscription), apres: instantaneInscription(maj) }),
        },
      });
      return maj;
    });
  }

  /** Annulation par la direction ; une inscription validée se garde. */
  async annulerInscription(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    if (inscription.statut === StatutInscription.ANNULEE) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.ce_dossier_est_deja_annule'));
    }
    if (inscription.statut === StatutInscription.VALIDEE) {
      throw new BadRequestException(I18nContext.current()!.t('inscription.inscription_numero_est_valide_son_annulation_doit_passer_par', { args: { 'inscription.numero': inscription.numero } }));
    }
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, inscription.anneeId);
      const maj = await tx.inscription.update({
        where: { id },
        data: { statut: StatutInscription.ANNULEE },
        include: INSCRIPTION_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'INSCRIPTION_ANNULEE',
          entite: 'Inscription',
          entiteId: id,
          details: JSON.stringify({ avant: instantaneInscription(inscription), apres: instantaneInscription(maj) }),
        },
      });
      return maj;
    });
  }

  // ------------------------------------------------------------- paiements

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

    const [data, total] = await Promise.all([
      this.prisma.paiement.findMany({
        where,
        include: PAIEMENT_INCLUDE,
        orderBy: { horodatage: 'desc' },
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.paiement.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouverPaiement(id: string) {
    const paiement = await this.prisma.paiement.findUnique({
      where: { id },
      include: PAIEMENT_INCLUDE,
    });
    if (!paiement) throw new NotFoundException(I18nContext.current()!.t('inscription.paiement_introuvable'));
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
                select: { id: true, etudiantId: true, anneeId: true },
              })
            : null;
          if (dto.inscriptionId && !inscription) {
            throw new NotFoundException(I18nContext.current()!.t('inscription.inscription_introuvable'));
          }
          if (inscription && dto.anneeId && dto.anneeId !== inscription.anneeId) {
            throw new BadRequestException(I18nContext.current()!.t('common.academicYearMismatch'));
          }
          const anneeId = dto.anneeId ?? inscription?.anneeId
            ?? (await tx.anneeAcademique.findFirst({ where: { active: true, cloturee: false } }))?.id;
          if (!anneeId) {
            throw new BadRequestException(I18nContext.current()!.t('common.academicYearRequired'));
          }
          const annee = await tx.anneeAcademique.findUnique({
            where: { id: anneeId },
            select: { id: true, libelle: true },
          });
          if (!annee) throw new BadRequestException(I18nContext.current()!.t('common.academicYearNotFound'));
          await exigerAnneeOuverte(tx, annee.id);

          const cree = await tx.paiement.create({
            data: {
              reference: await prochainNumeroPaiement(tx, anneeNumero(annee.libelle)),
              montant: dto.montant,
              devise: dto.devise ?? 'GNF',
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
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: 'PAIEMENT_CREE',
              entite: 'Paiement',
              entiteId: cree.id,
              details: JSON.stringify({ avant: null, apres: instantanePaiement(cree) }),
            },
          });
          return cree;
        });

        if (paiement.mode === ModePaiement.MOBILE_MONEY && paiement.telephone) {
          const passerelleActive = !!process.env.MOBILE_MONEY_URL;
          if (passerelleActive) {
            await this.journalMobileMoney(user.id, paiement.id, 'PAIEMENT_MOBILE_MONEY_TENTATIVE');
          }
          let demande: Awaited<ReturnType<MobileMoneyService['demanderPaiement']>> | null = null;
          try {
            demande = await this.mobileMoney.demanderPaiement({
              reference: paiement.reference,
              montant: paiement.montant,
              devise: paiement.devise,
              operateur: paiement.operateur ?? 'AUTRE',
              telephone: paiement.telephone,
              motif: paiement.motif ?? undefined,
            });
          } catch {
            if (passerelleActive) {
              await this.journalMobileMoney(user.id, paiement.id, 'PAIEMENT_MOBILE_MONEY_ECHEC');
            }
            this.logger.warn(`Demande Mobile Money ${paiement.reference} non transmise; le paiement reste en attente.`);
          }

          if (demande?.transactionId) {
            try {
              const rattache = await this.prisma.$transaction(async (tx) => {
                const avant = await tx.paiement.findUnique({ where: { id: paiement.id }, include: PAIEMENT_INCLUDE });
                const maj = await tx.paiement.update({
                  where: { id: paiement.id },
                  data: { transactionId: demande.transactionId },
                  include: PAIEMENT_INCLUDE,
                });
                await tx.auditLog.create({
                  data: {
                    userId: user.id,
                    action: 'PAIEMENT_TRANSACTION_LIEE',
                    entite: 'Paiement',
                    entiteId: paiement.id,
                    details: JSON.stringify({
                      avant: instantanePaiement(avant),
                      apres: instantanePaiement(maj),
                      champsModifies: ['transactionId'],
                    }),
                  },
                });
                return maj;
              });
              return rattache;
            } catch {
              if (passerelleActive) {
                await this.journalMobileMoney(user.id, paiement.id, 'PAIEMENT_TRANSACTION_LIAISON_ECHEC');
              }
              this.logger.error(`Mobile Money accepté pour ${paiement.reference}, mais sa référence n'a pas pu être liée localement.`);
            }
          } else if (passerelleActive && demande?.mode === 'operateur') {
            await this.journalMobileMoney(user.id, paiement.id, 'PAIEMENT_MOBILE_MONEY_REPONSE_INVALIDE');
          }
        }

        return paiement;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(I18nContext.current()!.t('inscription.reference_de_paiement_temporairement_indisponible_reessayez'));
  }

  private async journalMobileMoney(userId: string, paiementId: string, action: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entite: 'Paiement',
          entiteId: paiementId,
          details: JSON.stringify({ statut: 'EN_ATTENTE' }),
        },
      });
    } catch {
      this.logger.warn(`Journal Mobile Money indisponible pour le paiement ${paiementId}.`);
    }
  }

  /**
   * Confirmation pilote : l'agent comptable / le DAF répercute la réponse de
   * l'opérateur (guichet). À un paiement réussi, si le cumul des paiements
   * réussis du dossier atteint les frais, l'inscription passe en PAYEE.
   */
  async simulerPaiement(id: string, dto: SimulerPaiementDto, user: AuthUser) {
    const reussi = dto.statut === 'REUSSI';
    return this.prisma.$transaction(async (tx) => {
      const paiement = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_INCLUDE });
      if (!paiement) throw new NotFoundException(I18nContext.current()!.t('inscription.paiement_introuvable'));
      if (paiement.inscriptionFormation) {
        throw new ConflictException(I18nContext.current()!.t('inscription.paiement_formation_confirme_par_action_de_formation'));
      }
      await exigerAnneeOuverte(tx, paiement.anneeId ?? paiement.inscription?.anneeId);
      if (paiement.statut === StatutPaiement.ANNULE || paiement.statut === StatutPaiement.REMBOURSE) {
        throw new BadRequestException(I18nContext.current()!.t('inscription.ce_paiement_est_clos_il_ne_peut_plus_etre_confirme'));
      }
      if (paiement.statut === StatutPaiement.REUSSI && dto.statut !== 'REUSSI') {
        throw new BadRequestException(I18nContext.current()!.t('inscription.ce_paiement_est_deja_reussi_impossible_de_le_faire_echouer'));
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
        throw new ConflictException(I18nContext.current()!.t('inscription.ce_paiement_est_clos_il_ne_peut_plus_etre_confirme'));
      }
      const p = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_INCLUDE });
      if (!p) throw new NotFoundException(I18nContext.current()!.t('inscription.paiement_introuvable'));

      let inscriptionAudit: { avant: unknown; apres: unknown } | null = null;
      if (reussi && p?.inscriptionId) {
        const cumul = await tx.paiement.aggregate({
          where: { inscriptionId: p.inscriptionId, statut: StatutPaiement.REUSSI },
          _sum: { montant: true },
        });
        const dossier = await tx.inscription.findUnique({
          where: { id: p.inscriptionId },
          select: { statut: true, montantFrais: true },
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

  /** Annulation d'un paiement en attente ou échoué — un encaissement se garde. */
  async annulerPaiement(id: string, dto: AnnulerPaiementDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const paiement = await tx.paiement.findUnique({ where: { id }, include: PAIEMENT_INCLUDE });
      if (!paiement) throw new NotFoundException(I18nContext.current()!.t('inscription.paiement_introuvable'));
      await exigerAnneeOuverte(tx, paiement.anneeId ?? paiement.inscription?.anneeId);
      if (paiement.statut === StatutPaiement.REUSSI) {
        throw new BadRequestException(I18nContext.current()!.t('inscription.paiement_deja_encaisse_il_ne_peut_plus_etre_annule'));
      }
      if (paiement.statut === StatutPaiement.ANNULE) {
        throw new BadRequestException(I18nContext.current()!.t('inscription.ce_paiement_est_deja_annule'));
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
        throw new ConflictException(I18nContext.current()!.t('inscription.ce_paiement_est_deja_annule'));
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

  // ---------------------------------------------------------- impression

  /**
   * Certificat provisoire d'inscription, A4, imprimé en nouvel onglet (jeton
   * vérifié côté contrôleur, comme /feuilles-paie/:id/imprimer).
   */
  async attestationInscription(id: string): Promise<string> {
    const inscription = await this.trouverInscription(id);
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    const edite = new Date().toLocaleString('fr-FR');

    const paye = (inscription.paiements ?? [])
      .filter((p) => p.statut === StatutPaiement.REUSSI)
      .reduce((t, p) => t + p.montant, 0);
    const restant = Math.max(0, inscription.montantFrais - paye);
    const statut = inscription.statut;

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Certificat d'inscription — ${echapper(inscription.numero)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12px; }
  header { border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .titre { font-size: 19px; font-weight: 700; margin-top: 6px; color: #0d47a1; }
  .sous-titre { color: #555; margin-top: 2px; }
  .meta { display: flex; gap: 18px; margin: 12px 0 4px; font-size: 11px; color: #444; flex-wrap: wrap; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .BROUILLON { background: #eceeef; color: #5b6570; }
  .EN_ATTENTE_PAIEMENT { background: #fff4e0; color: #8a5300; }
  .PAYEE { background: #e3f5e9; color: #17683a; }
  .VALIDEE { background: #e3ecf7; color: #15518f; }
  .ANNULEE { background: #fdeaea; color: #a52020; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #b9c4cf; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; width: 32%; }
  .num { text-align: right; }
  .mention { margin-top: 14px; padding: 8px 10px; border: 1px solid #b9c4cf; background: #fafbfd; font-size: 11px; color: #444; }
  .signatures { display: flex; justify-content: space-between; margin-top: 46px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 10mm; }
</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">Certificat d'inscription (provisoire)</div>
    <div class="sous-titre">Document délivré en attendant la validation définitive de la scolarité</div>
  </header>
  <div class="meta">
    <span>N° dossier : <strong>${echapper(inscription.numero)}</strong></span>
    <span>Statut : <span class="badge ${statut}">${LIBELLE_STATUT_INSCRIPTION[statut] ?? echapper(statut)}</span></span>
    <span>Année académique : ${echapper(inscription.annee.libelle)}</span>
    <span>Édité le ${edite}</span>
  </div>
  <table>
    <tbody>
      <tr><th>Nom &amp; prénom</th><td>${echapper(inscription.etudiant.nom)} ${echapper(inscription.etudiant.prenom)}</td></tr>
      <tr><th>Matricule (INE)</th><td>${echapper(inscription.etudiant.matricule)}</td></tr>
      <tr><th>Filière</th><td>${echapper(inscription.promotion.filiere?.nom ?? '—')}</td></tr>
      <tr><th>Promotion</th><td>${echapper(inscription.promotion.nom)}</td></tr>
      <tr><th>Frais d'inscription</th><td>${inscription.montantFrais.toLocaleString('fr-FR')} GNF</td></tr>
      <tr><th>Montant réglé</th><td>${paye.toLocaleString('fr-FR')} GNF (${paye >= inscription.montantFrais ? 'frais soldés' : `reste ${restant.toLocaleString('fr-FR')} GNF`})</td></tr>
      <tr><th>Date de validation</th><td>${inscription.valideeLe ? echapper(isoDate(inscription.valideeLe)) : '—'}</td></tr>
    </tbody>
  </table>
  <div class="mention">
    Ce certificat atteste le dépôt du dossier de l'étudiant ci-dessus et le règlement
    de ses frais d'inscription pour l'année universitaire indiquée. Il ne vaut
    inscription définitive qu'après validation par le service de la scolarité.
  </div>
  <div class="signatures">
    <div class="signature">L'agent comptable</div>
    <div class="signature">La scolarité</div>
    <div class="signature">Le Directeur des études</div>
  </div>
  <footer><span>UniPrésence — registre des inscriptions</span><span>Édité le ${edite}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

/** Tarifs : changer un tarif recopie le nouveau montant sur les dossiers en attente. */
@Injectable()
export class FraisService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'frais', {
      include: FRAIS_INCLUDE,
      label: "Tarif d'inscription",
    });
  }

  /** Tarif public : renvoie uniquement ce qu’exigent les formulaires d’inscription. */
  async tarifsPublics(query: FraisQueryDto, filtres: Prisma.FraisWhereInput = {}) {
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));
    const where: Prisma.FraisWhereInput = {
      AND: [{ annee: { cloturee: false } }, filtres],
    };
    const [data, total] = await Promise.all([
      this.prisma.frais.findMany({
        where,
        select: { id: true, montant: true, devise: true },
        orderBy: [{ anneeId: 'desc' }, { promotionId: 'asc' }],
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.frais.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  private instantane(frais: { id: string; anneeId: string; promotionId: string; montant: number; devise: string }) {
    return { id: frais.id, anneeId: frais.anneeId, promotionId: frais.promotionId, montant: frais.montant, devise: frais.devise };
  }

  /** Les dossiers EN_ATTENTE_PAIEMENT suivent le tarif officiel (instantané). */
  private async propager(
    tx: Prisma.TransactionClient,
    promotionId: string,
    anneeId: string,
    montant: number,
  ) {
    await tx.inscription.updateMany({
      where: { promotionId, anneeId, statut: StatutInscription.EN_ATTENTE_PAIEMENT },
      data: { montantFrais: montant },
    });
  }

  async creerFrais(dto: CreateFraisDto, user: AuthUser) {
    await exigerAnneeOuverte(this.prisma, dto.anneeId);
    const existant = await this.prisma.frais.findUnique({
      where: { anneeId_promotionId: { anneeId: dto.anneeId, promotionId: dto.promotionId } },
      select: { id: true },
    });
    if (existant) {
      throw new ConflictException(I18nContext.current()!.t('inscription.un_tarif_existe_deja_pour_cette_promotion_et_cette_annee_mod'));
    }
    const frais = await this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId, dto.anneeId);
      const f = await tx.frais.create({
        data: { anneeId: dto.anneeId, promotionId: dto.promotionId, montant: dto.montant, devise: dto.devise ?? 'GNF' },
        include: FRAIS_INCLUDE,
      });
      await this.propager(tx, f.promotionId, f.anneeId, f.montant);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FRAIS_CREE',
          entite: 'Frais',
          entiteId: f.id,
          details: JSON.stringify({ avant: null, apres: this.instantane(f) }),
        },
      });
      return f;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return frais;
  }

  async modifierFrais(id: string, dto: UpdateFraisDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.frais.findUnique({ where: { id }, include: FRAIS_INCLUDE });
      if (!avant) throw new NotFoundException(I18nContext.current()!.t('common.notFound'));
      await exigerAnneeOuverte(tx, avant.anneeId);
      if (dto.anneeId !== undefined) await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId ?? avant.promotionId, dto.anneeId ?? avant.anneeId);
      const f = await tx.frais.update({
        where: { id },
        data: { ...dto },
        include: FRAIS_INCLUDE,
      });
      if (dto.montant !== undefined) {
        await this.propager(tx, f.promotionId, f.anneeId, f.montant);
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FRAIS_MODIFIE',
          entite: 'Frais',
          entiteId: id,
          details: JSON.stringify({ avant: this.instantane(avant), apres: this.instantane(f) }),
        },
      });
      return f;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async supprimerFrais(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const actuel: any = await tx.frais.findUnique({ where: { id }, include: FRAIS_INCLUDE });
      if (!actuel) throw new NotFoundException(I18nContext.current()!.t('common.notFound'));
      await exigerAnneeOuverte(tx, actuel.anneeId);
      await tx.frais.delete({ where: { id } });
      await this.propager(tx, actuel.promotionId, actuel.anneeId, 0);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'FRAIS_SUPPRIME',
          entite: 'Frais',
          entiteId: id,
          details: JSON.stringify({ avant: this.instantane(actuel), apres: null }),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { id };
  }
}
