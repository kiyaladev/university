/**
 * Titres resto numériques & canteen wallet — le module de la cantine.
 *
 * Fini les tickets papier : l'étudiant recharge son portefeuille resto
 * (Mobile Money depuis le portail, espèces au guichet), le cantinier scanne le
 * QR de sa carte — ou tape son matricule ou son téléphone — et valide le repas
 * en deux secondes. Zéro cash, zéro fraude de ticket.
 *
 * Décisions produit (documentées pour la recette) :
 *
 * 1. Validation EN LIGNE PAR DÉFAUT : le solde est contrôlé et débité au
 *    serveur au moment du service. Il n'existe pas de mode hors-ligne : un
 *    solde local serait à la fois falsifiable et incohérent d'un poste à
 *    l'autre. Le terminal cantine reste connecté.
 * 2. Le poste de guichet est @Public (l'appareil du cantinier se connecte via
 *    l'interface) : le jeton est résolu par la garde globale
 *    (`@AuthentificationOptionnelle`), le rôle est contrôlé ici. Seuls
 *    CONTROLEUR | ADMIN | SCOLARITE y sont admis.
 * 3. Espèces (guichet) = crédit immédiat. Mobile Money = Recharge EN_ATTENTE,
 *    créditée à la confirmation : `simuler: true` à la création (pilote) ou
 *    POST /recharges/:id/simuler (caisse). L'argent du Mobile Money ne rentre
 *    jamais « tout seul » dans le portefeuille.
 * 4. Annulation d'un repas : remboursement intégral immédiat, sans fenêtre de
 *    24 h. Les annulations sont réservées à l'administration, journalisées
 *    (audit REPAS_ANNULE) et le guichet constate le fait (repas non servi,
 *    erreur de saisie) ; une règle du 24 h pénaliserait la cantine du soir
 *    sans réel gain : le contrôleur du solde reste l'administration.
 * 5. Le QR de la carte (« UP-RESTO-<base64url> ») a pu ne jamais être généré
 *    pour les anciens dossiers : TOUTE lecture le génère à la volée.
 *    Les portefeuilles sont créés sur demande (idempotent) — jamais en tâche
 *    de fond, jamais de comptes pour tous.
 * 6. Références de paiement propres au resto : "PAY-R-AAAA-NNNNN", distinctes
 *    de celles du module inscriptions ("PAY-AAAA-NNNNN") et des recettes
 *    externes ("PAY-X-AAAA-NNNNN") pour ne jamais prendre une transaction pour
 *    une autre à la trésorerie. Les recettes encaissées avant l'introduction
 *    de "PAY-X-" portent encore "PAY-R-" : ces références restent valides et
 *    le compteur resto les enjambe (il prend le plus grand suffixe du préfixe).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { ModePaiement, OperateurPaiement, Prisma, Role, StatutConsommation, StatutPaiement, type Etudiant } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { pagine, paginer } from '../../../common/pagination';
import { ParametresService } from '../../socle/parametres/parametres.service';
import { SERIES_NUMERO, avecNumeroUnique, millesimeSerie, prochainNumeroSerie } from '../../../common/numero';
import { creerPaiementTx } from '../../../common/finances/index';
import { type EffetConfirmationPaiement, confirmerPaiement } from '../../../common/finances/confirmation';
import {
  AnnulerConsommationDto,
  ConsommationsQueryDto,
  PortefeuillesQueryDto,
  RechargerPortailDto,
  RechargerPortefeuilleDto,
  RechargesQueryDto,
  SimulerRechargeDto,
  ValiderRepasDto,
} from './resto.dto';

/** Postes de guichet admis à valider un repas (rôle contrôlé ici). */
const GUICHET: Role[] = [Role.CONTROLEUR, Role.ADMIN, Role.SCOLARITE];

export const PORTEFEUILLE_INCLUDE = {
  etudiant: {
    select: { id: true, matricule: true, nom: true, prenom: true, telephone: true },
  },
} satisfies Prisma.PortefeuilleRestoInclude;

/** Recharge lue avant la confirmation, avec son paiement et son portefeuille. */
type RechargeAvant = Prisma.RechargeGetPayload<{
  include: { paiement: true; portefeuille: { select: { id: true } } };
}>;

/** Ce que l'effet de confirmation rend à l'appelant. */
type EffetRecharge = {
  /** Solde du portefeuille avant le crédit. */
  soldeAvant: number | null;
  /** Solde du portefeuille après le crédit. */
  soldeApres: number | null;
};

const LIBELLES_OPERATEUR: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  TELECEL: 'Telecel',
  AUTRE: 'Mobile Money',
};

@Injectable()
export class RestoService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
  ) {}

  // ------------------------------------------------------------ consultation

  async listePortefeuilles(query: PortefeuillesQueryDto) {
    const pagination = paginer(query);

    const where: Prisma.PortefeuilleRestoWhereInput = {
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.search
        ? {
            etudiant: {
              OR: [
                { matricule: { contains: query.search, mode: 'insensitive' } },
                { nom: { contains: query.search, mode: 'insensitive' } },
                { prenom: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.portefeuilleResto.findMany({
        where,
        include: PORTEFEUILLE_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.portefeuilleResto.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  /** Portefeuille de l'étudiant connecté (portail) : créé si absent, jamais null. */
  async monPortefeuille(user: AuthUser) {
    if (!user.etudiantId) {
      throw new ForbiddenException(t('resto.compte_non_rattache_a_une_fiche_etudiante'));
    }
    const portefeuille = await this.portefeuilleOuCree(null, user.etudiantId);
    return this.prisma.portefeuilleResto.findUnique({
      where: { id: portefeuille.id },
      include: {
        ...PORTEFEUILLE_INCLUDE,
        recharges: { take: 25, orderBy: { rechargeLe: 'desc' } },
        consommations: { take: 25, orderBy: { consommeLe: 'desc' } },
      },
    });
  }

  /** Détail complet d'un dossier étudiant (solution, recharges, consommations). */
  async detailPortefeuille(etudiantId: string) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: etudiantId },
      select: { id: true, matricule: true, nom: true, prenom: true, telephone: true },
    });
    if (!etudiant) throw new NotFoundException(t('resto.etudiant_introuvable'));

    const portefeuille = await this.prisma.portefeuilleResto.findUnique({
      where: { etudiantId },
      include: {
        ...PORTEFEUILLE_INCLUDE,
        recharges: {
          take: 50,
          orderBy: { rechargeLe: 'desc' },
          include: { paiement: { select: { reference: true, mode: true } } },
        },
        consommations: { take: 50, orderBy: { consommeLe: 'desc' } },
      },
    });
    return { etudiant, portefeuille };
  }

  // -------------------------------------------------------------- rechargement

  /**
   * Rechargement au guichet. Espèces : crédit immédiat. Mobile Money :
   * EN_ATTENTE — sauf `simuler: true` (confirmation pilote), qui crédite
   * aussitôt, comme une encaisse espèces.
   */
  async recharger(id: string, dto: RechargerPortefeuilleDto, user: AuthUser) {
    // L'identifiant d'URL peut être soit un portefeuilleId, soit un etudiantId
    // (cas fréquent : la scolarité travaille depuis la fiche étudiant et le
    // portefeuille n'a pas encore été créé). On accepte les deux.
    let etudiantId: string;
    const direct = await this.prisma.portefeuilleResto.findUnique({
      where: { id },
      include: PORTEFEUILLE_INCLUDE,
    });
    if (direct) {
      etudiantId = direct.etudiantId;
    } else {
      const etu = await this.prisma.etudiant.findUnique({ where: { id } });
      if (!etu) throw new NotFoundException(t('resto.portefeuille_introuvable'));
      etudiantId = etu.id;
    }
    const portefeuille = await this.portefeuilleOuCree(null, etudiantId);

    const mode = dto.mode ?? ModePaiement.ESPECES;
    const immediat = mode === ModePaiement.ESPECES || dto.simuler === true;

    const resultat = await this.creerPaiementEtRecharge({
      etudiantId: portefeuille.etudiantId,
      portefeuilleId: portefeuille.id,
      montant: dto.montant,
      mode,
      operateur: dto.operateur,
      telephone: dto.telephone,
      user,
      statutImmediat: immediat,
    });

    return {
      recharge: resultat.recharge,
      paiement: resultat.paiement,
      solde: resultat.solde,
      immediat,
    };
  }

  /**
   * Confirmation pilote : la caisse répercute la réponse de l'opérateur
   * Mobile Money (miroir du module paiement). Une recharge réussie crédite le
   * portefeuille ; la recharge EN_ATTENTE reste sans effet sur le solde.
   *
   * La recharge porte le statut de l'encaissement : c'est elle qui est
   * verrouillée par le moteur commun. Le module garde son effet : créditer
   * le solde du portefeuille.
   */
  async simulerRecharge(id: string, dto: SimulerRechargeDto, user: AuthUser) {
    const recharge = await this.prisma.recharge.findUnique({
      where: { id },
      include: { paiement: true, portefeuille: { select: { id: true } } },
    });
    if (!recharge) throw new NotFoundException(t('resto.recharge_introuvable'));

    if (recharge.statut === StatutPaiement.REUSSI) {
      // Déjà encaissée : on renvoie l'état, l'effet n'est pas rejoué.
      if (dto.statut === StatutPaiement.REUSSI) return this.chargerRecharge(id);
      throw new BadRequestException(t('resto.cette_recharge_est_deja_encaissee_impossible_de_la_faire_ech'));
    }
    if (recharge.statut === StatutPaiement.ANNULE || recharge.statut === StatutPaiement.REMBOURSE) {
      throw new BadRequestException(t('resto.cette_recharge_est_close_elle_ne_peut_plus_etre_confirmee'));
    }

    const reussi = dto.statut === StatutPaiement.REUSSI;
    await confirmerPaiement({
      prisma: this.prisma,
      user,
      statut: dto.statut,
      effet: this.effetRecharge(id, recharge),
      journal: {
        action: (statut) => (statut === StatutPaiement.REUSSI ? 'RECHARGE_CONFIRMEE' : 'RECHARGE_ECHOUEE'),
        entite: 'Recharge',
        entiteId: id,
        details: ({ preparation, resultat }) => ({
          avant: { statut: preparation.objet.statut, solde: resultat.valeur.soldeAvant },
          apres: { statut: dto.statut, solde: resultat.valeur.soldeApres },
          montant: preparation.objet.montant,
          champsModifies: reussi ? ['statut', 'solde'] : ['statut'],
        }),
      },
    });

    return this.chargerRecharge(id);
  }

  /**
   * Effet de confirmation d'une recharge : le solde du portefeuille est
   * crédité du montant de la recharge, et le paiement jumeau prend le statut
   * de la recharge.
   *
   * Le verrou optimiste porte sur la recharge : deux confirmations
   * concurrentes ne peuvent créditer qu'une fois le portefeuille. Le paiement
   * jumeau n'existe pas toujours (recharge antérieure à la table Paiement) :
   * il est alors simplement mis à jour s'il existe.
   */
  private effetRecharge(id: string, recharge: RechargeAvant): EffetConfirmationPaiement<EffetRecharge, RechargeAvant> {
    return {
      preparer: async () => ({
        transition: {
          modele: 'recharge',
          id,
          statutAttendu: recharge.statut,
          erreur: () => new BadRequestException(t('resto.cette_recharge_est_close_elle_ne_peut_plus_etre_confirmee')),
        },
        objet: recharge,
        confirme: false,
      }),

      dejaConfirme: async () => ({ soldeAvant: null, soldeApres: null }),

      appliquer: async ({ tx, statut }) => {
        let soldeAvant: number | null = null;
        let soldeApres: number | null = null;
        if (statut === StatutPaiement.REUSSI) {
          const portefeuilleAvant = await tx.portefeuilleResto.findUnique({
            where: { id: recharge.portefeuilleId },
            select: { solde: true },
          });
          soldeAvant = portefeuilleAvant?.solde ?? null;
          const portefeuilleApres = await tx.portefeuilleResto.update({
            where: { id: recharge.portefeuilleId },
            data: { solde: { increment: recharge.montant } },
            select: { solde: true },
          });
          soldeApres = portefeuilleApres.solde;
        }
        if (recharge.paiementId) {
          await tx.paiement.update({
            where: { id: recharge.paiementId },
            data: { statut, completeLe: statut === StatutPaiement.REUSSI ? new Date() : null },
          });
        }
        return { valeur: { soldeAvant, soldeApres } };
      },
    };
  }

  /** Recharge avec son paiement et son portefeuille (solde à jour). */
  private chargerRecharge(id: string) {
    return this.prisma.recharge.findUnique({
      where: { id },
      include: { paiement: true, portefeuille: { include: PORTEFEUILLE_INCLUDE } },
    });
  }

  /** Recharger depuis le portail : Mobile Money, jamais crédité directement. */
  async rechargerDepuisPortail(dto: RechargerPortailDto, user: AuthUser) {
    if (!user.etudiantId) {
      throw new ForbiddenException(t('resto.compte_non_rattache_a_une_fiche_etudiante'));
    }
    const portefeuille = await this.portefeuilleOuCree(null, user.etudiantId);
    const mode = dto.mode ?? ModePaiement.MOBILE_MONEY;

    const { recharge, paiement } = await this.creerPaiementEtRecharge({
      etudiantId: user.etudiantId,
      portefeuilleId: portefeuille.id,
      montant: dto.montant,
      mode,
      operateur: dto.operateur,
      telephone: null,
      user,
      statutImmediat: false,
    });

    const compte = await this.parametres.valeur('COMPTE_MOBILE_MONEY_RESTAURANT', '+224 000 00 00 00');
    const operateur = dto.operateur ? (LIBELLES_OPERATEUR[dto.operateur] ?? dto.operateur) : 'Orange Money';

    return {
      recharge,
      paiement,
      instructions: `Payez ${dto.montant.toLocaleString('fr-FR')} GNF via ${operateur} au numéro ${compte} (caisse du restaurant universitaire), en mentionnant la référence ${paiement.reference}. Votre solde sera crédité après confirmation du guichet.`,
    };
  }

  // ------------------------------------------------------------------ guichet

  /** Consultation carte (QR scanné) : l'identité et le solde, sans rien débiter. */
  async carteInfo(reference: string, utilisateur?: AuthUser) {
    this.verifierGuichet(utilisateur);
    const etudiant = await this.etudiantParReference(reference);
    const portefeuille = await this.portefeuilleOuCree(null, etudiant.id);
    return {
      etudiant: { matricule: etudiant.matricule, nom: etudiant.nom, prenom: etudiant.prenom },
      carte: { qrToken: !!etudiant.qrRestoToken },
      solde: portefeuille.solde,
    };
  }

  /**
   * Le geste du cantinier : scanner (ou taper) la référence, choisir le repas,
   * valider. Le solde est vérifié en transaction — solde insuffisant,
   * 409 et le portefeuille n'est pas touché.
   */
  async validerRepas(dto: ValiderRepasDto, utilisateur?: AuthUser) {
    const user = this.verifierGuichet(utilisateur);
    const etudiant = await this.etudiantParReference(dto.reference);

    const { consommation, solde } = await this.prisma.$transaction(async (tx) => {
      // Les anciens dossiers n'ont pas de QR : etudiantParReference le génère
      // à la volée avant d'entrer ici.
      const portefeuille = await this.portefeuilleOuCree(tx, etudiant.id);
      const debit = await tx.portefeuilleResto.updateMany({
        where: { id: portefeuille.id, solde: { gte: dto.montant } },
        data: { solde: { decrement: dto.montant } },
      });
      if (debit.count !== 1) {
        throw new ConflictException(
          t('resto.solde_insuffisant_rechargez_via_le_portail_solde_portefeuille_', {
            solde: portefeuille.solde,
            montant: dto.montant,
          }),
        );
      }

      const consommation = await tx.consommationResto.create({
        data: {
          portefeuilleId: portefeuille.id,
          etudiant: `${etudiant.matricule} — ${etudiant.nom} ${etudiant.prenom}`,
          repas: dto.repas,
          montant: dto.montant,
          cantine: dto.cantine ?? null,
          statut: StatutConsommation.VALIDE,
          valideurId: user.id,
          valideLe: new Date(),
          consommeLe: new Date(),
        },
      });

      const maj = await tx.portefeuilleResto.findUnique({ where: { id: portefeuille.id }, select: { solde: true } });
      await journaliser(tx, user, 'REPAS_VALIDE', 'ConsommationResto', consommation.id, {
        repas: dto.repas,
        montant: dto.montant,
        avant: { solde: portefeuille.solde },
        apres: { solde: maj!.solde },
        champsModifies: ['solde'],
      });
      return { consommation, solde: maj!.solde };
    });

    return {
      consommation,
      solde,
      etudiant: { matricule: etudiant.matricule, nom: etudiant.nom, prenom: etudiant.prenom },
    };
  }

  // ------------------------------------------------------------ consommations

  /** Recharges (toutes, annulées comprises) : le miroir comptable des repas. */
  async listeRecharges(query: RechargesQueryDto) {
    const pagination = paginer(query);

    const where: Prisma.RechargeWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      // Un seul objet par champ : deux spreads successifs écrasaient `gte`.
      ...(query.dateDebut || query.dateFin
        ? {
            rechargeLe: {
              ...(query.dateDebut ? { gte: new Date(`${query.dateDebut}T00:00:00`) } : {}),
              ...(query.dateFin ? { lte: new Date(`${query.dateFin}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.recharge.findMany({
        where,
        include: {
          paiement: { select: { reference: true, mode: true } },
          portefeuille: { include: PORTEFEUILLE_INCLUDE },
        },
        orderBy: [{ rechargeLe: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.recharge.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  async listeConsommations(query: ConsommationsQueryDto) {
    const pagination = paginer(query);

    const where: Prisma.ConsommationRestoWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.cantine ? { cantine: { contains: query.cantine, mode: 'insensitive' } } : {}),
      // Un seul objet par champ : deux spreads successifs écrasaient `gte`.
      ...(query.dateDebut || query.dateFin
        ? {
            consommeLe: {
              ...(query.dateDebut ? { gte: new Date(`${query.dateDebut}T00:00:00`) } : {}),
              ...(query.dateFin ? { lte: new Date(`${query.dateFin}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.consommationResto.findMany({
        where,
        include: { portefeuille: { include: PORTEFEUILLE_INCLUDE } },
        orderBy: [{ consommeLe: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.consommationResto.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  /**
   * Annulation : rembourse intégralement le solde (décision documentée : pas
   * de fenêtre de 24 h — voir l'en-tête du service). Un repas déjà annulé ou
   * encore en attente ne se rembourse pas deux fois.
   */
  async annulerConsommation(id: string, dto: AnnulerConsommationDto, user: AuthUser) {
    const consommation = await this.prisma.consommationResto.findUnique({
      where: { id },
      include: { portefeuille: true },
    });
    if (!consommation) throw new NotFoundException(t('resto.consommation_introuvable'));
    if (consommation.statut !== StatutConsommation.VALIDE) {
      throw new BadRequestException(
        t('resto.cette_consommation_est_deja_consommation_statut_seul_un_repas_vali', { statut: consommation.statut }),
      );
    }

    const { maj, solde } = await this.prisma.$transaction(async (tx) => {
      const annulation = await tx.consommationResto.updateMany({
        where: { id, statut: StatutConsommation.VALIDE },
        data: { statut: StatutConsommation.ANNULE },
      });
      if (annulation.count !== 1) {
        throw new BadRequestException(
          t('resto.cette_consommation_est_deja_consommation_statut_seul_un_repas_vali', {
            statut: consommation.statut,
          }),
        );
      }
      const maj = await tx.consommationResto.findUnique({ where: { id } });
      const portefeuille = await tx.portefeuilleResto.update({
        where: { id: consommation.portefeuilleId },
        data: { solde: { increment: consommation.montant } },
      });
      await journaliser(tx, user, 'REPAS_ANNULE', 'ConsommationResto', id, {
        montant: consommation.montant,
        motifFourni: Boolean(dto.motif),
        avant: { statut: consommation.statut, solde: consommation.portefeuille.solde },
        apres: { statut: maj!.statut, solde: portefeuille.solde },
        champsModifies: ['statut', 'solde'],
      });
      return { maj: maj!, solde: portefeuille.solde };
    });

    return { consommation: maj, solde };
  }

  // ---------------------------------------------------------------- services

  /**
   * Identifier l'étudiant par la référence saisie : le jeton du QR de la carte
   * (UP-RESTO-…), le matricule INE ou le numéro de téléphone.
   */
  private async etudiantParReference(reference: string) {
    const ref = reference.trim();
    if (!ref || ref.length > 64) {
      throw new BadRequestException(t('resto.reference_vide_scannez_le_qr_ou_saisissez_le_matricule'));
    }

    const parQr = ref.startsWith('UP-RESTO-')
      ? await this.prisma.etudiant.findUnique({ where: { qrRestoToken: ref } })
      : null;
    const etudiant =
      parQr ??
      (await this.prisma.etudiant.findUnique({ where: { matricule: ref } })) ??
      (await this.prisma.etudiant.findFirst({ where: { telephone: ref } }));

    if (!etudiant) {
      throw new NotFoundException(t('resto.etudiant_introuvable_verifiez_la_reference_scannee_ou_saisie'));
    }
    return this.assurerQrToken(null, etudiant);
  }

  /**
   * Le QR de la carte se génère à la volée pour les anciens dossiers — au
   * premier passage au guichet comme à la première consultation du portail.
   */
  private async assurerQrToken(tx: Prisma.TransactionClient | null, etudiant: Etudiant): Promise<Etudiant> {
    if (etudiant.qrRestoToken) return etudiant;
    const client = tx ?? this.prisma;
    const qrRestoToken = nouveauQrRestoToken();
    const resultat = await client.etudiant.updateMany({
      where: { id: etudiant.id, qrRestoToken: null },
      data: { qrRestoToken },
    });
    if (resultat.count === 1) return { ...etudiant, qrRestoToken };

    // Deux premières lectures peuvent arriver ensemble : relire le jeton
    // gagné par l'autre requête au lieu de le remplacer et d'invalider son QR.
    const courant = await client.etudiant.findUnique({ where: { id: etudiant.id } });
    if (!courant) {
      throw new NotFoundException(t('resto.etudiant_introuvable_verifiez_la_reference_scannee_ou_saisie'));
    }
    return courant;
  }

  /** Portefeuille unique par étudiant : créé idempotent, jamais de doublon. */
  private async portefeuilleOuCree(tx: Prisma.TransactionClient | null, etudiantId: string) {
    const base = tx ?? this.prisma;
    return base.portefeuilleResto.upsert({
      where: { etudiantId },
      create: { etudiantId, solde: 0 },
      update: {},
    });
  }

  /**
   * Paiement + recharge jumeaux (une seule écriture comptable). Tout est
   * atomique : la référence "PAY-R-<année>-NNNNN" est distincte de celle du
   * module inscriptions ; le solde n'est crédité que si la création est
   * confirmée.
   */
  private async creerPaiementEtRecharge(args: {
    etudiantId: string;
    portefeuilleId: string;
    montant: number;
    mode: ModePaiement;
    operateur?: OperateurPaiement | undefined;
    telephone?: string | null;
    user: AuthUser;
    statutImmediat: boolean;
  }) {
    const annee = await this.numeroAnnee();

    return avecNumeroUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const paiement = await creerPaiementTx(tx, {
            data: {
              // "PAY-R-2026-00001" — référence des paiements du portefeuille resto.
              reference: await prochainNumeroSerie(tx, SERIES_NUMERO.PAIEMENT_RESTAURATION, annee),
              montant: args.montant,
              devise: 'GNF',
              mode: args.mode,
              operateur: args.operateur ?? null,
              telephone: args.telephone ?? null,
              motif: 'Rechargement portefeuille restaurant universitaire',
              etudiantId: args.etudiantId,
              statut: args.statutImmediat ? StatutPaiement.REUSSI : StatutPaiement.EN_ATTENTE,
              completeLe: args.statutImmediat ? new Date() : null,
              creeParId: args.user.id,
            },
          });

          const recharge = await tx.recharge.create({
            data: {
              portefeuilleId: args.portefeuilleId,
              etudiantId: args.etudiantId,
              montant: args.montant,
              statut: args.statutImmediat ? StatutPaiement.REUSSI : StatutPaiement.EN_ATTENTE,
              paiementId: paiement.id,
            },
          });

          const portefeuilleAvant = await tx.portefeuilleResto.findUniqueOrThrow({
            where: { id: args.portefeuilleId },
            select: { solde: true },
          });
          const soldeAvant = portefeuilleAvant.solde;
          let solde = soldeAvant;
          if (args.statutImmediat) {
            const maj = await tx.portefeuilleResto.update({
              where: { id: args.portefeuilleId },
              data: { solde: { increment: args.montant } },
              select: { solde: true },
            });
            solde = maj.solde;
          }

          await journaliser(tx, { id: args.user.id }, 'RECHARGE_CREEE', 'Recharge', recharge.id, {
            reference: paiement.reference,
            montant: args.montant,
            statut: recharge.statut,
            avant: { solde: soldeAvant },
            apres: { solde: args.statutImmediat ? solde : soldeAvant },
            champsModifies: args.statutImmediat ? ['paiement', 'recharge', 'solde'] : ['paiement', 'recharge'],
          });

          return { recharge, paiement, solde };
        }),
      {
        tentatives: 10,
        colonnes: ['reference'],
        erreur: () => new ConflictException(t('resto.reference_de_paiement_temporairement_indisponible_reessayez')),
      },
    );
  }

  /** Année des références "PAY-R-<aaaa>-…" : l'année scolaire active, sinon l'année civile. */
  private async numeroAnnee(): Promise<string> {
    const annee = await this.prisma.anneeAcademique.findFirst({
      where: { active: true, cloturee: false },
      select: { libelle: true },
    });
    return millesimeSerie(SERIES_NUMERO.PAIEMENT_RESTAURATION, annee?.libelle);
  }

  /**
   * Contrôle du poste de guichet. L'appareil du cantinier porte un jeton
   * valide : la route est publique, mais l'authentification est faite par la
   * garde globale (`@AuthentificationOptionnelle`), qui contrôle déjà la
   * signature, l'activité du compte et la révocation des sessions. Il ne
   * reste ici que le contrôle du rôle, propre à ce poste.
   */
  private verifierGuichet(utilisateur: AuthUser | undefined): AuthUser {
    if (!utilisateur) {
      throw new UnauthorizedException(t('resto.jeton_invalide_ou_expire_reconnectez_le_poste_de_guichet'));
    }
    if (!GUICHET.includes(utilisateur.role)) {
      throw new ForbiddenException(t('resto.le_poste_de_guichet_est_reserve_aux_comptes_controleur_scola'));
    }
    return utilisateur;
  }
}

/** Le jeton encodé dans le QR de la carte resto : aléatoire, unique. */
function nouveauQrRestoToken(): string {
  return `UP-RESTO-${randomBytes(12).toString('base64url')}`;
}
