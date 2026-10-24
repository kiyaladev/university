/**
 * Plateforme de demande de documents : l'étudiant formule une demande en
 * ligne, paie les frais au tarif paramétré, la scolarité traite, marque le
 * document comme prêt et le remet. Le document final est livré au guichet.
 *
 * Cycle de vie :
 *  - EN_ATTENTE_PAIEMENT : déclaration, paiement à venir
 *  - PAYE : paiement réussi, en attente de prise en charge
 *  - EN_TRAITEMENT : la scolarité a pris le dossier
 *  - PRET : document prêt au retrait (notification SMS à l'étudiant)
 *  - REMISE : document remis au guichet
 *  - REJETE : demande rejetée (motif obligatoire)
 *
 * Les tarifs par type (TarifDemande) sont paramétrables par l'administrateur.
 * En mode pilote, le paiement Mobile Money est simulé — l'agent comptable
 * confirme via POST /:id/confirmer-paiement.
 */
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  StatutDemande,
  StatutNotification,
  StatutPaiement,
  TypeDemandeDocument,
  TypeAttestation,
  ModePaiement,
  Role,
} from '@prisma/client';
import { AttestationsService } from '../attestations/attestations.service';
import { randomUUID } from 'node:crypto';
import { CrudService } from '../../../common/crud.service';
import { journaliser } from '../../../common/audit';
import { t } from '../../../common/i18n';
import { AuthUser } from '../../../common/decorators';
import { pagine, paginer } from '../../../common/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { chargerEtablissement } from '../../../common/impression/index';
import { demandeDocumentHtml } from './documents-demande.impression';
import { MobileMoneyService } from '../../scolarite/inscription/mobile-money.service';
import { SERIES_NUMERO, avecNumeroUnique, millesimeSerie, prochainNumeroSerie } from '../../../common/numero';
import { PaiementATransmettre, creerPaiementTx, transmettreMobileMoney } from '../../../common/finances/index';
import { toMontant } from '../../../common/finances/montant';

const STATUTS_PAIEMENT_REQUIS: StatutDemande[] = [
  StatutDemande.PAYE,
  StatutDemande.EN_TRAITEMENT,
  StatutDemande.PRET,
  StatutDemande.REMISE,
];

export const DEMANDE_INCLUDE = {
  etudiant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      telephone: true,
      email: true,
    },
  },
  inscription: { select: { id: true, numero: true } },
  paiement: { select: { id: true, reference: true, statut: true, montant: true, devise: true, mode: true } },
  traitePar: { select: { id: true, nom: true, prenom: true, role: true } },
  // Numéro de l'attestation vérifiable émise au passage « prête » : le front
  // en tire le lien vers la page publique de vérification.
  attestation: { select: { id: true, numero: true, statut: true } },
} satisfies Prisma.DemandeDocumentInclude;

/**
 * Rôles qui lisent le registre des attestations (GET /attestations, :id) et y
 * reçoivent `qrToken`, dont l'écran tire le lien ?ref=&k= de vérification.
 * La demande de document expose le jeton à ces mêmes rôles, ni plus ni moins :
 * l'étudiant voit le numéro, pas le jeton.
 */
const ROLES_LECTURE_ATTESTATION: Role[] = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

const DEMANDE_INCLUDE_LECTEUR_ATTESTATION = {
  ...DEMANDE_INCLUDE,
  attestation: { select: { id: true, numero: true, statut: true, qrToken: true } },
} satisfies Prisma.DemandeDocumentInclude;

export function includeDemandePour(user?: Pick<AuthUser, 'role'> | null): typeof DEMANDE_INCLUDE {
  return user && ROLES_LECTURE_ATTESTATION.includes(user.role as Role)
    ? DEMANDE_INCLUDE_LECTEUR_ATTESTATION
    : DEMANDE_INCLUDE;
}

/**
 * Types de demande qui donnent lieu à une attestation vérifiable par QR.
 * CERTIFICAT_SCOLARITE et ATTESTATION_SCOLARITE désignent le même document
 * (TypeAttestation.SCOLARITE : « certificat de scolarité »). Les autres types
 * (relevé, duplicata de carte, fréquentation, autre) restent hors registre.
 */
export const TYPE_ATTESTATION_PAR_DEMANDE: Partial<Record<TypeDemandeDocument, TypeAttestation>> = {
  [TypeDemandeDocument.ATTESTATION_SCOLARITE]: TypeAttestation.SCOLARITE,
  [TypeDemandeDocument.CERTIFICAT_SCOLARITE]: TypeAttestation.SCOLARITE,
  [TypeDemandeDocument.ATTESTATION_REUSSITE]: TypeAttestation.REUSSITE,
};

@Injectable()
export class DocumentsDemandeService extends CrudService<
  Prisma.DemandeDocumentGetPayload<{ include: typeof DEMANDE_INCLUDE }>
> {
  private readonly logger = new Logger(DocumentsDemandeService.name);

  constructor(
    prisma: PrismaService,
    private readonly mobileMoney: MobileMoneyService = new MobileMoneyService(),
    private readonly attestations?: AttestationsService,
  ) {
    super(prisma, 'demandeDocument', {
      orderBy: { createdAt: 'desc' },
      include: DEMANDE_INCLUDE,
      label: 'Demande de document',
    });
  }

  // ---------------------------------------------------------- lecture

  async lister(
    query: {
      page?: number;
      pageSize?: number;
      all?: string;
      search?: string;
      statut?: StatutDemande;
      type?: TypeDemandeDocument;
      etudiantId?: string;
    },
    user: AuthUser,
  ) {
    const pagination = paginer(query);

    const where: Prisma.DemandeDocumentWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
              { motif: { contains: query.search, mode: 'insensitive' } },
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
      this.prisma.demandeDocument.findMany({
        where,
        include: includeDemandePour(user),
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.demandeDocument.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  /** Vue propre à l'étudiant connecté : strictement ses demandes. */
  async mesDemandes(
    query: {
      page?: number;
      pageSize?: number;
      all?: string;
      statut?: StatutDemande;
      type?: TypeDemandeDocument;
    },
    user: AuthUser,
  ) {
    if (!user.etudiantId) {
      throw new NotFoundException(t('documents-demande.aucun_dossier_etudiant_rattache_a_ce_compte'));
    }
    return this.lister({ ...query, etudiantId: user.etudiantId }, user);
  }

  /**
   * Détail d'une demande : propriétaire (étudiant) ou staff. Un étudiant qui
   * demande une autre fiche reçoit 404 — pas 403, pour ne pas confirmer
   * l'existence d'un identifiant qui n'est pas le sien.
   */
  async findOnePour(id: string, user: AuthUser) {
    const estStaff = user.role === 'ADMIN' || user.role === 'SCOLARITE' || user.role === 'DIRECTION';
    const demande = await this.prisma.demandeDocument.findFirst({
      where: {
        id,
        ...(!estStaff ? { etudiantId: user.etudiantId ?? '__aucun__' } : {}),
      },
      include: includeDemandePour(user),
    });
    if (!demande) {
      throw new NotFoundException(t('documents-demande.demande_introuvable'));
    }
    return demande;
  }

  /**
   * Petite agrégation pour le tableau de bord :
   *  - total
   *  - compteurs par statut
   *  - montant cumulé des paiements réussis
   *  - demandes PRET depuis plus de 7 jours (non remises)
   */
  async dashboard() {
    const ilYA7j = new Date(Date.now() - 7 * 86400 * 1000);

    const [total, parStatut, paiements, pretesNonRemises] = await Promise.all([
      this.prisma.demandeDocument.count(),
      this.prisma.demandeDocument.groupBy({
        by: ['statut'],
        _count: { _all: true },
      }),
      this.prisma.demandeDocument.aggregate({
        where: { paiement: { statut: StatutPaiement.REUSSI } },
        _sum: { frais: true },
      }),
      this.prisma.demandeDocument.count({
        where: {
          statut: StatutDemande.PRET,
          createdAt: { lt: ilYA7j },
        },
      }),
    ]);

    const comptes: Record<StatutDemande, number> = {
      EN_ATTENTE_PAIEMENT: 0,
      PAYE: 0,
      EN_TRAITEMENT: 0,
      PRET: 0,
      REMISE: 0,
      REJETE: 0,
    };
    for (const ligne of parStatut) comptes[ligne.statut] = ligne._count._all;

    return {
      total,
      ...comptes,
      recettes: toMontant(paiements._sum.frais),
      pretesNonRemises,
    };
  }

  // ---------------------------------------------------------- tarifs

  /** Liste des tarifs par type — toute personne connectée peut la consulter. */
  async listeTarifs() {
    return this.prisma.tarifDemande.findMany({ orderBy: { type: 'asc' } });
  }

  /** Lecture d'un tarif par identifiant. */
  async findTarif(id: string) {
    const tarif = await this.prisma.tarifDemande.findUnique({ where: { id } });
    if (!tarif) throw new NotFoundException(t('documents-demande.tarif_introuvable'));
    return tarif;
  }

  /** Lecture d'un tarif par type — utilisé à la création d'une demande. */
  async tarifPour(type: TypeDemandeDocument) {
    return this.prisma.tarifDemande.findUnique({ where: { type } });
  }

  /**
   * Création d'un tarif (ADMIN). Le tarif commande le prix d'un document :
   * sa création et son entrée de journal partagent la transaction.
   */
  async creerTarif(dto: { type: TypeDemandeDocument; montant: number; delaiHeures: number }, user: AuthUser) {
    for (let tentative = 0; tentative < 5; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const tarif = await tx.tarifDemande.create({
            data: { type: dto.type, montant: dto.montant, delaiHeures: dto.delaiHeures },
          });
          await journaliser(tx, user, 'TARIF_DEMANDE_CREE', 'TarifDemande', tarif.id, {
            avant: null,
            apres: this.instantaneTarif(tarif),
            champsModifies: ['type', 'montant', 'delaiHeures'],
          });
          return tarif;
        });
      } catch (e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(t('documents-demande.tarifDejaExistant', { type: dto.type }));
        }
        throw e;
      }
    }
    throw new ConflictException(t('documents-demande.creation_temporairement_indisponible_reessayez'));
  }

  /**
   * Mise à jour d'un tarif (ADMIN). Un tarif déjà encaissé ne rejoue pas les
   * demandes passées : seule la trace avant/après permet de dire ce qu'un
   * guichetier a réellement facturé, d'où le relevé des deux montants.
   */
  async modifierTarif(id: string, dto: { montant?: number; delaiHeures?: number }, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.tarifDemande.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('documents-demande.tarif_introuvable'));

      const data = {
        ...(dto.montant != null ? { montant: dto.montant } : {}),
        ...(dto.delaiHeures != null ? { delaiHeures: dto.delaiHeures } : {}),
      };
      const apres = await tx.tarifDemande.update({ where: { id }, data });
      await journaliser(tx, user, 'TARIF_DEMANDE_MODIFIE', 'TarifDemande', id, {
        avant: this.instantaneTarif(avant),
        apres: this.instantaneTarif(apres),
        champsModifies: Object.keys(data),
      });
      return apres;
    });
  }

  // ---------------------------------------------------------- création

  /**
   * Création d'une demande par l'étudiant. Le tarif est lu sur TarifDemande
   * (paramétrable). Si aucun tarif n'est défini pour ce type, le montant est
   * 0 — la demande est alors créée sans paiement attendu (workflow dégradé).
   */
  async creer(dto: { type: TypeDemandeDocument; motif?: string; inscriptionId?: string }, user: AuthUser) {
    if (!user.etudiantId) {
      throw new NotFoundException(t('documents-demande.aucun_dossier_etudiant_rattache_a_ce_compte'));
    }
    if (
      dto.inscriptionId &&
      !(await this.prisma.inscription.findFirst({
        where: { id: dto.inscriptionId, etudiantId: user.etudiantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException(t('common.notFound'));
    const tarif = await this.tarifPour(dto.type);
    const frais = toMontant(tarif?.montant);
    const devise = tarif?.devise ?? 'GNF';
    const annee = millesimeSerie(SERIES_NUMERO.DOCUMENT_DEMANDE);

    return avecNumeroUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          // Numéro séquentiel par année : "DOC-2026-00001".
          const numero = await prochainNumeroSerie(tx, SERIES_NUMERO.DOCUMENT_DEMANDE, annee);
          const demande = await tx.demandeDocument.create({
            data: {
              numero,
              type: dto.type,
              motif: dto.motif?.trim() || null,
              etudiantId: user.etudiantId!,
              inscriptionId: dto.inscriptionId ?? null,
              frais,
              devise,
              statut: frais > 0 ? StatutDemande.EN_ATTENTE_PAIEMENT : StatutDemande.EN_TRAITEMENT,
              traiteParId: frais > 0 ? null : user.id,
            },
            include: DEMANDE_INCLUDE,
          });
          await journaliser(tx, user, 'DEMANDE_DOC_OUVERTE', 'DemandeDocument', demande.id, {
            avant: null,
            apres: this.instantaneDemande(demande),
            champsModifies: ['type', 'statut', 'frais', 'devise'],
          });
          return demande;
        }),
      {
        tentatives: 10,
        colonnes: ['numero'],
        erreur: () =>
          new ConflictException(t('documents-demande.numero_de_demande_temporairement_indisponible_reessayez')),
      },
    );
  }

  // ---------------------------------------------------------- paiement

  /**
   * Création du paiement associé à la demande. En Mobile Money, la demande
   * est transmise à l'opérateur (ou simulée en pilote sans URL). En ESPECES
   * ou VIREMENT, le paiement reste EN_ATTENTE et la scolarité confirme.
   */
  async payer(
    id: string,
    dto: { mode: ModePaiement; simuler?: boolean; operateur?: string; telephone?: string },
    user: AuthUser,
  ) {
    if (dto.simuler && process.env.NODE_ENV === 'production') {
      throw new BadRequestException(t('documents-demande.simulationPaiementDesactiveeProduction'));
    }
    if (
      dto.mode === ModePaiement.MOBILE_MONEY &&
      !dto.simuler &&
      (!dto.operateur?.trim() || !/^\+?[\d\s().-]{6,20}$/.test(dto.telephone?.trim() ?? ''))
    ) {
      throw new BadRequestException(t('common.mobileMoneyDetailsRequired'));
    }
    const demande = await this.findOnePour(id, user);
    if (demande.etudiantId !== user.etudiantId) {
      throw new BadRequestException(t('documents-demande.seul_le_demandeur_peut_payer_sa_propre_demande'));
    }
    if (toMontant(demande.frais) <= 0) {
      throw new BadRequestException(
        t('documents-demande.cette_demande_est_sans_frais_inutile_de_payer_elle_est_deja_'),
      );
    }
    if (demande.statut !== StatutDemande.EN_ATTENTE_PAIEMENT) {
      throw new BadRequestException(t('documents-demande.demandeNonEnAttentePaiement'));
    }
    if (demande.paiementId) {
      throw new BadRequestException(
        t('documents-demande.un_paiement_a_deja_ete_initie_pour_cette_demande_attendez_la'),
      );
    }

    const annee = millesimeSerie(SERIES_NUMERO.PAIEMENT_DOCUMENT_DEMANDE);
    const paiement = await avecNumeroUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const avant = await tx.demandeDocument.findUnique({ where: { id: demande.id } });
          if (!avant) throw new NotFoundException(t('documents-demande.demande_introuvable'));
          if (avant.etudiantId !== user.etudiantId) {
            throw new BadRequestException(t('documents-demande.seul_le_demandeur_peut_payer_sa_propre_demande'));
          }
          if (avant.statut !== StatutDemande.EN_ATTENTE_PAIEMENT || avant.paiementId) {
            throw new ConflictException(
              t('documents-demande.un_paiement_a_deja_ete_initie_pour_cette_demande_attendez_la'),
            );
          }
          // Numéro séquentiel "PAY-D-AAAA-NNNNN" pour le paiement lié. Le préfixe est
          // propre aux demandes de documents : les paiements de scolarité gardent
          // "PAY-AAAA-NNNNN", les deux séries ne se confondent plus (même millésime
          // ou non) et l'origine d'une référence se lit dans le préfixe. Les
          // paiements de documents émis avant cette décision gardent leur ancienne
          // référence "PAY-…", toujours valide.
          const reference = await prochainNumeroSerie(tx, SERIES_NUMERO.PAIEMENT_DOCUMENT_DEMANDE, annee);
          const paiementId = randomUUID();
          const inscription = demande.inscriptionId
            ? await tx.inscription.findUnique({
                where: { id: demande.inscriptionId },
                select: { id: true, anneeId: true },
              })
            : null;
          if (demande.inscriptionId && !inscription) {
            throw new NotFoundException(t('documents-demande.demande_introuvable'));
          }
          const cree = await creerPaiementTx(tx, {
            data: {
              id: paiementId,
              reference,
              montant: demande.frais,
              devise: demande.devise,
              mode: dto.mode,
              operateur: dto.operateur ?? null,
              telephone: dto.telephone ?? null,
              motif: `Demande ${demande.numero} (${demande.type})`,
              statut: StatutPaiement.EN_ATTENTE,
              ...(inscription ? { inscriptionId: inscription.id, anneeId: inscription.anneeId } : {}),
              etudiantId: demande.etudiantId,
              creeParId: user.id,
            },
          });
          // Le rattachement du paiement à la demande part avec lui : plus de
          // paiement orphelin si la seconde écriture échoue.
          const rattachement = await tx.demandeDocument.updateMany({
            where: { id: demande.id, statut: StatutDemande.EN_ATTENTE_PAIEMENT, paiementId: null },
            data: { paiementId },
          });
          if (rattachement.count !== 1) {
            throw new ConflictException(
              t('documents-demande.un_paiement_a_deja_ete_initie_pour_cette_demande_attendez_la'),
            );
          }
          const apres = await tx.demandeDocument.findUnique({ where: { id: demande.id } });
          if (!apres) throw new NotFoundException(t('documents-demande.demande_introuvable'));
          await journaliser(tx, user, 'DEMANDE_DOC_PAIEMENT_INITIE', 'Paiement', cree.id, {
            avant: this.instantaneDemande(avant),
            apres: this.instantaneDemande(apres),
            paiement: this.instantanePaiement(cree),
            champsModifies: ['paiementId'],
          });
          return cree;
        }),
      {
        tentatives: 10,
        colonnes: ['reference'],
        erreur: () =>
          new ConflictException(t('documents-demande.reference_de_paiement_temporairement_indisponible_reessayez')),
      },
    );

    // Mode pilote : la simulation force la confirmation automatique.
    if (dto.simuler) {
      await this.confirmerPaiement(demande.id, { paiementId: paiement.id }, user);
      return this.lire(demande.id);
    }

    // Mobile Money : tentative de transmission à l'opérateur. L'appel réseau
    // sort de la transaction et de la relance : il ne doit jamais la retenir,
    // ni être rejoué si une étape ultérieure échoue.
    if (dto.mode === ModePaiement.MOBILE_MONEY && paiement.telephone) {
      await this.tenterTransmissionMobileMoney(paiement, user.id);
    }

    return this.lire(demande.id);
  }

  /**
   * Confirmation manuelle d'un paiement (ADMIN, SCOLARITE) — agent au guichet.
   * L'encaissement et le basculement de la demande sont un seul fait : les deux
   * écritures et leur journal sont validés ensemble, sinon un encaissement
   * sans basculement (ou l'inverse) resterait sans trace exploitable.
   */
  async confirmerPaiement(id: string, dto: { paiementId?: string }, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const demandeAvant = await tx.demandeDocument.findUnique({ where: { id } });
      if (!demandeAvant) throw new NotFoundException(t('documents-demande.demande_introuvable'));
      if (demandeAvant.statut !== StatutDemande.EN_ATTENTE_PAIEMENT) {
        throw new BadRequestException(t('documents-demande.demandeDejaTraitee'));
      }
      if (!demandeAvant.paiementId) {
        throw new BadRequestException(t('documents-demande.aucunPaiementAssocie'));
      }
      if (dto.paiementId && dto.paiementId !== demandeAvant.paiementId) {
        throw new BadRequestException(t('documents-demande.identifiant_de_paiement_incoherent'));
      }

      const paiementAvant = await tx.paiement.findUnique({ where: { id: demandeAvant.paiementId } });
      const paiement = await tx.paiement.update({
        where: { id: demandeAvant.paiementId },
        data: { statut: StatutPaiement.REUSSI, completeLe: new Date() },
      });
      const demandeApres = await tx.demandeDocument.update({
        where: { id },
        data: { statut: StatutDemande.EN_TRAITEMENT, traiteParId: user.id },
        include: includeDemandePour(user),
      });
      await journaliser(tx, user, 'DEMANDE_DOC_PAIEMENT_CONFIRME', 'Paiement', paiement.id, {
        avant: this.instantaneDemande(demandeAvant),
        apres: this.instantaneDemande(demandeApres),
        paiementAvant: paiementAvant ? this.instantanePaiement(paiementAvant) : null,
        paiementApres: this.instantanePaiement(paiement),
        champsModifies: ['statut', 'traiteParId'],
      });
      return demandeApres;
    });
  }

  // ---------------------------------------------------------- traitement

  /** Lancement explicite du traitement (ADMIN, SCOLARITE). */
  async lancerTraitement(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.demandeDocument.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('documents-demande.demande_introuvable'));
      if (avant.statut !== StatutDemande.PAYE && avant.statut !== StatutDemande.EN_TRAITEMENT) {
        throw new BadRequestException(t('documents-demande.cette_demande_n_est_pas_encore_prete_a_etre_traitee'));
      }

      const apres = await tx.demandeDocument.update({
        where: { id },
        data: { statut: StatutDemande.EN_TRAITEMENT, traiteParId: user.id },
        include: includeDemandePour(user),
      });
      await journaliser(tx, user, 'DEMANDE_DOC_TRAITEMENT', 'DemandeDocument', id, {
        avant: this.instantaneDemande(avant),
        apres: this.instantaneDemande(apres),
        champsModifies: ['statut', 'traiteParId'],
      });
      return apres;
    });
  }

  /**
   * Marquage PRET : la scolarité a produit le document. Une notification SMS
   * est émise à l'étudiant (via Notification) avec le message transmis par
   * le guichet. La notification ne part que si l'étudiant a un téléphone.
   */
  async marquerPrete(id: string, dto: { message?: string }, user: AuthUser) {
    const demande = await this.lire(id);
    if (!STATUTS_PAIEMENT_REQUIS.includes(demande.statut)) {
      throw new BadRequestException(t('documents-demande.demandeNonTraitee'));
    }
    if (demande.statut === StatutDemande.PRET || demande.statut === StatutDemande.REMISE) {
      throw new BadRequestException(t('documents-demande.cette_demande_est_deja_prete_ou_remise'));
    }

    const message =
      dto.message?.trim() ||
      `Votre document ${demande.numero} (${this.libelleType(demande.type)}) est prêt : retirez-le au guichet de la scolarité.`;

    const miseAJour = await this.marquerPreteTx(id, message, user);

    // Notification SMS — best effort, sans bloquer le flux en cas d'échec.
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: demande.etudiantId },
      select: { telephone: true, matricule: true, nom: true, prenom: true },
    });
    if (etudiant?.telephone) {
      const numero = String(etudiant.telephone).replace(/\D/g, '');
      if (numero.length >= 8) {
        try {
          await this.prisma.notification.create({
            data: {
              telephone: numero,
              message: message.slice(0, 160),
              motif: 'DOCUMENT_PRET',
              destinataireNom: `${etudiant.prenom} ${etudiant.nom}`.trim(),
              etudiantId: etudiant.matricule ? undefined : undefined,
              statut: StatutNotification.ENVOYE,
              envoyeParId: user.id,
              envoyeLe: new Date(),
            },
          });
        } catch (e: unknown) {
          this.logger.warn(
            `Notification PRET non consignée pour ${demande.numero} : ${(e as Error | null)?.message ?? e}`,
          );
        }
      }
    }

    return miseAJour;
  }

  /**
   * Passage PRET et, pour les types attestables, émission de l'attestation
   * vérifiable dans la même transaction : la demande n'est jamais « prête »
   * sans son attestation, ni l'attestation émise sans la demande.
   *
   * Idempotent : la ligne est verrouillée, une demande déjà liée à une
   * attestation n'en reçoit pas une seconde, et une attestation identique
   * déjà émise à la main (libre) est réutilisée. Une collision de numéro
   * (P2002) rejoue la transaction entière.
   */
  private async marquerPreteTx(id: string, message: string, user: AuthUser) {
    return avecNumeroUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "DemandeDocument" WHERE id = ${id} FOR UPDATE`;
          const avant = await tx.demandeDocument.findUnique({ where: { id } });
          if (!avant) throw new NotFoundException(t('documents-demande.demande_introuvable'));
          if (avant.statut === StatutDemande.PRET || avant.statut === StatutDemande.REMISE) {
            throw new BadRequestException(t('documents-demande.cette_demande_est_deja_prete_ou_remise'));
          }

          const attestationId = await this.attestationPourDemandeTx(tx, avant, user);
          const apres = await tx.demandeDocument.update({
            where: { id },
            data: {
              statut: StatutDemande.PRET,
              notification: message,
              traiteParId: user.id,
              ...(attestationId && attestationId !== avant.attestationId ? { attestationId } : {}),
            },
            include: includeDemandePour(user),
          });
          await journaliser(tx, user, 'DEMANDE_DOC_PRETE', 'DemandeDocument', id, {
            avant: this.instantaneDemande(avant),
            apres: this.instantaneDemande(apres),
            champsModifies: [
              'statut',
              'traiteParId',
              'notification',
              ...(attestationId && attestationId !== avant.attestationId ? ['attestationId'] : []),
            ],
            sms: 'meilleur-effort hors transaction',
          });
          return apres;
        }),
      {
        tentatives: 5,
        // La transaction peut émettre une attestation : c'est son numéro qui
        // peut être pris par une émission concurrente.
        colonnes: ['numero'],
        erreur: () =>
          new ConflictException(t('attestations.numero_d_attestation_temporairement_indisponible_reessayez')),
      },
    );
  }

  /** Attestation liée à la demande (existante ou émise ici), ou null si le type n'en relève pas. */
  private async attestationPourDemandeTx(
    tx: Prisma.TransactionClient,
    demande: {
      id: string;
      type: TypeDemandeDocument;
      etudiantId: string;
      inscriptionId: string | null;
      motif: string | null;
      attestationId?: string | null;
    },
    user: AuthUser,
  ): Promise<string | null> {
    const type = TYPE_ATTESTATION_PAR_DEMANDE[demande.type];
    if (!type) return null;
    if (demande.attestationId) return demande.attestationId;
    if (!this.attestations) {
      throw new ConflictException(t('documents-demande.attestation_service_indisponible'));
    }
    const attestation = await this.attestations.emettrePourDemandeTx(
      tx,
      {
        type,
        etudiantId: demande.etudiantId,
        inscriptionId: demande.inscriptionId ?? undefined,
        motif: demande.motif ?? undefined,
      },
      user,
    );
    return attestation.id;
  }

  /** Remise effective au guichet : passe en REMISE et date remiseLe. */
  async remettre(id: string, dto: { noteRemise?: string }, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.demandeDocument.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('documents-demande.demande_introuvable'));
      if (avant.statut !== StatutDemande.PRET) {
        throw new BadRequestException(t('documents-demande.cette_demande_n_est_pas_marquee_comme_prete'));
      }

      const data: Prisma.DemandeDocumentUpdateInput = {
        statut: StatutDemande.REMISE,
        remiseLe: new Date(),
        traitePar: { connect: { id: user.id } },
      };
      if (dto.noteRemise?.trim()) {
        const note = dto.noteRemise.trim();
        data.notes = avant.notes
          ? `${avant.notes}\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] REMISE — ${note}`
          : `REMISE — ${note}`;
      }

      const apres = await tx.demandeDocument.update({
        where: { id },
        data,
        include: includeDemandePour(user),
      });
      await journaliser(tx, user, 'DEMANDE_DOC_REMISE', 'DemandeDocument', id, {
        avant: this.instantaneDemande(avant),
        apres: this.instantaneDemande(apres),
        champsModifies: dto.noteRemise?.trim()
          ? ['statut', 'remiseLe', 'traiteParId', 'notes']
          : ['statut', 'remiseLe', 'traiteParId'],
        noteRemiseFournie: Boolean(dto.noteRemise?.trim()),
      });
      return apres;
    });
  }

  /** Rejet avec motif obligatoire. */
  async rejeter(id: string, dto: { motif: string }, user: AuthUser) {
    if (!dto.motif?.trim()) {
      throw new BadRequestException(t('documents-demande.le_motif_de_rejet_est_obligatoire'));
    }
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.demandeDocument.findUnique({ where: { id } });
      if (!avant) throw new NotFoundException(t('documents-demande.demande_introuvable'));
      if (avant.statut === StatutDemande.REMISE) {
        throw new BadRequestException(t('documents-demande.cette_demande_a_deja_ete_remise'));
      }

      const data: Prisma.DemandeDocumentUpdateInput = {
        statut: StatutDemande.REJETE,
        notes: avant.notes
          ? `${avant.notes}\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] REJET — ${dto.motif.trim()}`
          : `REJET — ${dto.motif.trim()}`,
      };

      const apres = await tx.demandeDocument.update({
        where: { id },
        data,
        include: includeDemandePour(user),
      });
      await journaliser(tx, user, 'DEMANDE_DOC_REJETEE', 'DemandeDocument', id, {
        avant: this.instantaneDemande(avant),
        apres: this.instantaneDemande(apres),
        champsModifies: ['statut', 'notes'],
        motifFourni: true,
      });
      return apres;
    });
  }

  // ---------------------------------------------------------- impression

  // ---------------------------------------------------------- helpers

  /**
   * État d'une demande utile à l'audit. Volontairement minimal : ni `motif`,
   * ni `notification`, ni `notes` — ces textes libres sont écrits par
   * l'étudiant ou par le guichet et peuvent citer le contenu du dossier —
   * ni les coordonnées du demandeur, ni les identifiants techniques du
   * paiement, qui ne changent pas l'état métier.
   */
  private instantaneDemande(demande: any) {
    return {
      numero: demande.numero,
      type: demande.type,
      statut: demande.statut,
      frais: toMontant(demande.frais),
      devise: demande.devise,
      traiteParId: demande.traiteParId ?? null,
      remiseLe: demande.remiseLe ?? null,
      ...(demande.attestationId ? { attestationId: demande.attestationId } : {}),
    };
  }

  /** Écriture comptable : ni téléphone du payeur, ni jeton de l'opérateur. */
  private instantanePaiement(paiement: any) {
    return {
      reference: paiement.reference,
      montant: toMontant(paiement.montant),
      devise: paiement.devise,
      mode: paiement.mode,
      statut: paiement.statut,
    };
  }

  /** Grille tarifaire : montants et délai, seuls champs paramétrables. */
  private instantaneTarif(tarif: any) {
    return {
      id: tarif.id,
      type: tarif.type,
      montant: toMontant(tarif.montant),
      devise: tarif.devise,
      delaiHeures: tarif.delaiHeures,
    };
  }

  /**
   * Tentative de transmission Mobile Money. La passerelle est facultative —
   * en son absence, le paiement reste EN_ATTENTE et sera confirmé au guichet.
   */
  private async tenterTransmissionMobileMoney(paiement: PaiementATransmettre, userId: string) {
    await transmettreMobileMoney(paiement, {
      prisma: this.prisma,
      mobileMoney: this.mobileMoney,
      userId,
      logger: this.logger,
      instantane: (p) => this.instantanePaiement(p),
    });
  }

  /** Libellé humain d'un type de document, pour les messages SMS. */
  private libelleType(t: TypeDemandeDocument): string {
    const libelles: Record<TypeDemandeDocument, string> = {
      ATTESTATION_SCOLARITE: 'attestation de scolarité',
      ATTESTATION_FREQUENTATION: 'attestation de fréquentation',
      RELEVE_NOTES: 'relevé de notes',
      DUPLICATA_CARTE: 'duplicata de carte',
      ATTESTATION_REUSSITE: 'attestation de réussite',
      CERTIFICAT_SCOLARITE: 'certificat de scolarité',
      AUTRE: 'document',
    };
    return libelles[t] ?? 'document';
  }

  /** Fiche A4 de la demande (le contrôleur a vérifié le jeton d'impression). */
  async documentImprimable(id: string): Promise<string> {
    const [demande, etablissement] = await Promise.all([this.lire(id), chargerEtablissement(this.prisma)]);
    return demandeDocumentHtml(demande, etablissement);
  }
}
