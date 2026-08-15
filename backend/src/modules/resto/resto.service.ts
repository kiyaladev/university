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
 *    l'interface) : le jeton est vérifié A LA MAIN, comme pour l'impression
 *    des attestations. Seuls CONTROLEUR | ADMIN | SCOLARITE y sont admis.
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
 *    de celles du module inscriptions ("PAY-AAAA-NNNNN") pour ne jamais
 *    prendre les deux transactions l'une pour l'autre à la trésorerie.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ModePaiement, Prisma, Role, StatutConsommation, StatutPaiement, type Etudiant } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
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

/** Lecture & gestion du module : administration, direction, scolarité. */
const GESTIONNAIRES = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

/** Postes de guichet admis à valider un repas (jeton vérifié à la main). */
const GUICHET: Role[] = [Role.CONTROLEUR, Role.ADMIN, Role.SCOLARITE];

export const PORTEFEUILLE_INCLUDE = {
  etudiant: {
    select: { id: true, matricule: true, nom: true, prenom: true, telephone: true },
  },
} satisfies Prisma.PortefeuilleRestoInclude;

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
    private jwt: JwtService,
  ) {}

  // ------------------------------------------------------------ consultation

  async listePortefeuilles(query: PortefeuillesQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.portefeuilleResto.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  /** Portefeuille de l'étudiant connecté (portail) : créé si absent, jamais null. */
  async monPortefeuille(user: AuthUser) {
    if (!user.etudiantId) {
      throw new ForbiddenException("Compte non rattaché à une fiche étudiante");
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
    if (!etudiant) throw new NotFoundException('Étudiant introuvable');

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
      if (!etu) throw new NotFoundException('Portefeuille introuvable');
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
   */
  async simulerRecharge(id: string, dto: SimulerRechargeDto, user: AuthUser) {
    const recharge = await this.prisma.recharge.findUnique({
      where: { id },
      include: { paiement: true, portefeuille: { select: { id: true } } },
    });
    if (!recharge) throw new NotFoundException('Recharge introuvable');

    if (recharge.statut === StatutPaiement.REUSSI && dto.statut === StatutPaiement.REUSSI) {
      return this.prisma.recharge.findUnique({
        where: { id },
        include: { paiement: true, portefeuille: { include: PORTEFEUILLE_INCLUDE } },
      });
    }
    if (recharge.statut === StatutPaiement.REUSSI) {
      throw new BadRequestException('Cette recharge est déjà encaissée, impossible de la faire échouer');
    }
    if (recharge.statut === StatutPaiement.ANNULE || recharge.statut === StatutPaiement.REMBOURSE) {
      throw new BadRequestException('Cette recharge est close, elle ne peut plus être confirmée');
    }

    const reussi = dto.statut === StatutPaiement.REUSSI;
    await this.prisma.$transaction(async (tx) => {
      if (reussi) {
        await tx.portefeuilleResto.update({
          where: { id: recharge.portefeuilleId },
          data: { solde: { increment: recharge.montant } },
        });
      }
      await tx.recharge.update({
        where: { id },
        data: { statut: dto.statut },
      });
      if (recharge.paiementId) {
        await tx.paiement.update({
          where: { id: recharge.paiementId },
          data: {
            statut: dto.statut,
            completeLe: reussi ? new Date() : null,
          },
        });
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: reussi ? 'RECHARGE_CONFIRMEE' : 'RECHARGE_ECHOUEE',
        entite: 'Recharge',
        entiteId: id,
        details: `${recharge.montant} GNF → ${dto.statut} (confirmation pilote)`,
      },
    });

    return this.prisma.recharge.findUnique({
      where: { id },
      include: { paiement: true, portefeuille: { include: PORTEFEUILLE_INCLUDE } },
    });
  }

  /** Recharger depuis le portail : Mobile Money, jamais crédité directement. */
  async rechargerDepuisPortail(dto: RechargerPortailDto, user: AuthUser) {
    if (!user.etudiantId) {
      throw new ForbiddenException("Compte non rattaché à une fiche étudiante");
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
  async carteInfo(reference: string, token?: string) {
    await this.verifierGuichet(token);
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
  async validerRepas(dto: ValiderRepasDto, token?: string) {
    const user = await this.verifierGuichet(token);
    const etudiant = await this.etudiantParReference(dto.reference);

    const { consommation, solde } = await this.prisma.$transaction(async (tx) => {
      // Les anciens dossiers n'ont pas de QR : etudiantParReference le génère
      // à la volée avant d'entrer ici.
      const portefeuille = await this.portefeuilleOuCree(tx, etudiant.id);
      if (portefeuille.solde < dto.montant) {
        throw new ConflictException(
          `Solde insuffisant — rechargez via le portail (solde : ${portefeuille.solde} GNF, repas : ${dto.montant} GNF)`,
        );
      }

      const consommation = await tx.consommationResto.create({
        data: {
          portefeuilleId: portefeuille.id,
          etudiant: `${etudiant.matricule} — ${etudiant.nom} ${etudiant.prenom}`,
          repas: dto.repas,
          montant: dto.montant,
          cantine: dto.cantine ?? null,
          statut: StatutConsommation.VALIDEE,
          valideurId: user.id,
          valideLe: new Date(),
          consommeLe: new Date(),
        },
      });

      const maj = await tx.portefeuilleResto.update({
        where: { id: portefeuille.id },
        data: { solde: { decrement: dto.montant } },
      });
      return { consommation, solde: maj.solde };
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REPAS_VALIDE',
        entite: 'ConsommationResto',
        entiteId: consommation.id,
        details: `${dto.repas} ${dto.montant} GNF — ${etudiant.matricule} ${etudiant.nom} ${etudiant.prenom} (nouveau solde ${solde})`,
      },
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
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.RechargeWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.dateDebut ? { rechargeLe: { gte: new Date(`${query.dateDebut}T00:00:00`) } } : {}),
      ...(query.dateFin ? { rechargeLe: { lte: new Date(`${query.dateFin}T23:59:59.999`) } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.recharge.findMany({
        where,
        include: {
          paiement: { select: { reference: true, mode: true } },
          portefeuille: { include: PORTEFEUILLE_INCLUDE },
        },
        orderBy: [{ rechargeLe: 'desc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.recharge.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async listeConsommations(query: ConsommationsQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.ConsommationRestoWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.cantine ? { cantine: { contains: query.cantine, mode: 'insensitive' } } : {}),
      ...(query.dateDebut ? { consommeLe: { gte: new Date(`${query.dateDebut}T00:00:00`) } } : {}),
      ...(query.dateFin ? { consommeLe: { lte: new Date(`${query.dateFin}T23:59:59.999`) } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.consommationResto.findMany({
        where,
        include: { portefeuille: { include: PORTEFEUILLE_INCLUDE } },
        orderBy: [{ consommeLe: 'desc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.consommationResto.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
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
    if (!consommation) throw new NotFoundException('Consommation introuvable');
    if (consommation.statut !== StatutConsommation.VALIDEE) {
      throw new BadRequestException(
        `Cette consommation est déjà « ${consommation.statut} » : seul un repas validé se rembourse.`,
      );
    }

    const { maj, solde } = await this.prisma.$transaction(async (tx) => {
      const maj = await tx.consommationResto.update({
        where: { id },
        data: { statut: StatutConsommation.ANNULEE },
      });
      const portefeuille = await tx.portefeuilleResto.update({
        where: { id: consommation.portefeuilleId },
        data: { solde: { increment: consommation.montant } },
      });
      return { maj, solde: portefeuille.solde };
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REPAS_ANNULE',
        entite: 'ConsommationResto',
        entiteId: id,
        details: `Remboursement ${consommation.montant} GNF — ${consommation.etudiant}${dto.motif ? ` — motif : ${dto.motif}` : ''}`,
      },
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
    if (!ref) throw new BadRequestException('Référence vide : scannez le QR ou saisissez le matricule');

    const parQr = ref.startsWith('UP-RESTO-') ? await this.prisma.etudiant.findUnique({ where: { qrRestoToken: ref } }) : null;
    const etudiant =
      parQr ??
      (await this.prisma.etudiant.findUnique({ where: { matricule: ref } })) ??
      (await this.prisma.etudiant.findFirst({ where: { telephone: ref } }));

    if (!etudiant) {
      throw new NotFoundException('Étudiant introuvable — vérifiez la référence scannée ou saisie');
    }
    return this.assurerQrToken(null, etudiant);
  }

  /**
   * Le QR de la carte se génère à la volée pour les anciens dossiers — au
   * premier passage au guichet comme à la première consultation du portail.
   */
  private async assurerQrToken(
    tx: Prisma.TransactionClient | null,
    etudiant: Etudiant,
  ): Promise<Etudiant> {
    if (etudiant.qrRestoToken) return etudiant;
    const client = tx ?? this.prisma;
    return client.etudiant.update({
      where: { id: etudiant.id },
      data: { qrRestoToken: nouveauQrRestoToken() },
    });
  }

  /** Portefeuille unique par étudiant : créé idempotent, jamais de doublon. */
  private async portefeuilleOuCree(
    tx: Prisma.TransactionClient | null,
    etudiantId: string,
  ) {
    const base = tx ?? this.prisma;
    const existant = await base.portefeuilleResto.findUnique({ where: { etudiantId } });
    if (existant) return existant;
    return base.portefeuilleResto.create({ data: { etudiantId, solde: 0 } });
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
    operateur?: string | undefined;
    telephone?: string | null;
    user: AuthUser;
    statutImmediat: boolean;
  }) {
    const annee = await this.numeroAnnee();

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const paiement = await tx.paiement.create({
            data: {
              reference: await prochainNumeroPaiement(tx, annee),
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

          let solde = 0;
          if (args.statutImmediat) {
            const maj = await tx.portefeuilleResto.update({
              where: { id: args.portefeuilleId },
              data: { solde: { increment: args.montant } },
            });
            solde = maj.solde;
          }

          return { recharge, paiement, solde };
        });
      } catch (e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Référence de paiement temporairement indisponible, réessayez');
  }

  /** Année des références "PAY-R-<aaaa>-…" : l'année scolaire active, sinon l'année civile. */
  private async numeroAnnee(): Promise<string> {
    const annee = await this.prisma.anneeAcademique.findFirst({
      where: { active: true, cloturee: false },
      select: { libelle: true },
    });
    const fin = annee?.libelle.split('-')[1]?.trim();
    if (fin && /^\d{4}$/.test(fin)) return fin;
    return String(new Date().getFullYear());
  }

  /**
   * Vérification manuelle du jeton sur une route @Public : l'appareil du
   * cantinier passe par l'interface, le jeton voyage en en-tête OU en
   * paramètre d'URL (pattern attestations). On re-charge l'utilisateur en
   * base pour contrôler activité et rôle — pas seulement la signature.
   */
  private async verifierGuichet(token: string | undefined): Promise<AuthUser> {
    let payload: { sub?: string; iat?: number };
    try {
      payload = (await this.jwt.verifyAsync(token ?? '')) as any;
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré — reconnectez le poste de guichet');
    }
    if (!payload?.sub) throw new UnauthorizedException('Jeton invalide');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        etudiant: { select: { id: true } },
        enseignant: { select: { id: true } },
      },
    });
    if (!user || !user.actif) {
      throw new UnauthorizedException('Compte inexistant ou désactivé');
    }
    if (payload.iat && user.motDePasseModifieLe) {
      if (payload.iat * 1000 < user.motDePasseModifieLe.getTime() - 1000) {
        throw new UnauthorizedException('Session expirée, reconnectez-vous');
      }
    }
    if (!GUICHET.includes(user.role)) {
      throw new ForbiddenException(
        "Le poste de guichet est réservé aux comptes contrôleur, scolarité et administration — connectez-vous avec un de ces comptes.",
      );
    }
    return {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      departementId: user.departementId,
      enseignantId: user.enseignant?.id ?? null,
      etudiantId: user.etudiant?.id ?? null,
    };
  }
}

/** Le jeton encodé dans le QR de la carte resto : aléatoire, unique. */
function nouveauQrRestoToken(): string {
  return `UP-RESTO-${randomBytes(12).toString('base64url')}`;
}

/** Numéro séquentiel "PRÉFIXE-NNNNN" lu dans la base (pas de table de séquence). */
async function prochainNumero(delegate: any, champ: string, prefixe: string, largeur: number): Promise<string> {
  const existantes = await delegate.findMany({
    where: { [champ]: { startsWith: prefixe } },
    select: { [champ]: true },
  });
  const max = existantes.reduce((m: number, e: any) => {
    const n = Number(e[champ].slice(prefixe.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefixe}${String(max + 1).padStart(largeur, '0')}`;
}

/** "PAY-R-2026-00001" — référence des paiements du portefeuille resto. */
async function prochainNumeroPaiement(
  tx: Prisma.TransactionClient,
  annee: string,
): Promise<string> {
  return prochainNumero(tx.paiement, 'reference', `PAY-R-${annee}-`, 5);
}