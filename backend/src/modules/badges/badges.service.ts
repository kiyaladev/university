/**
 * Badges d'accès (visiteur, intervenant, technicien, VIP).
 *
 * Chaque badge porte un numéro séquentiel (BADGE-AAAA-NNNNN) et un jeton QR
 * unique : le scan ouvre la page de vérité. La validité est plafonnée dans
 * le temps ; le personnel peut la rallonger tant que le badge n'est pas
 * annulé. La révocation (annulation) est définitive : motif obligatoire.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { t } from '../../common/i18n';
import { Prisma, StatutBadge } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { chargerEtablissement } from '../../common/impression';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.service';
import {
  AnnulerBadgeDto,
  BadgeQueryDto,
  CreateBadgeDto,
  RallongerBadgeDto,
  VerifierBadgePubliqueDto,
  UpdateBadgeDto,
} from './badges.dto';
import { documentsBadge, BadgeImprimable } from './documents';
import { anneeNumero, prochainNumeroTx } from '../../common/numero';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';

const BADGE_INCLUDE = {
  creePar: { select: { id: true, nom: true, prenom: true } },
} as const;

/** Champs strictement nécessaires à la vérification QR publique d'un badge. */
export const BADGE_VERIFICATION_SELECT = {
  id: true,
  qrToken: true,
  statut: true,
  dateValidite: true,
  numero: true,
  type: true,
  prenom: true,
  nom: true,
  fonction: true,
  organisation: true,
  zonesAccess: true,
  dateDelivrance: true,
} satisfies Prisma.BadgeAccesSelect;

const PREFIXE = 'BADGE-';

@Injectable()
export class BadgesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------- calcul

  /** Numéro séquentiel par année : "BADGE-AAAA-NNNNN". */
  private async prochainNumero(tx: Prisma.TransactionClient, annee: string): Promise<string> {
    return prochainNumeroTx(tx, 'badgeAcces', 'numero', `${PREFIXE}${annee}-`, 5);
  }

  private nouveauQrToken(): string {
    return `UP-BADGE-${randomBytes(12).toString('base64url')}`;
  }

  /** Projection d'audit sans identité, coordonnées, pièce, photo, QR ni motif libre. */
  private instantaneAudit(badge: {
    id: string;
    numero: string;
    type: string;
    statut: StatutBadge;
    dateValidite: Date;
    zonesAccess: string | null;
    qrToken: string;
    photoUrl: string | null;
  }) {
    return {
      id: badge.id,
      numero: badge.numero,
      type: badge.type,
      statut: badge.statut,
      dateValidite: badge.dateValidite,
      zonesAccess: badge.zonesAccess,
      qrConfigure: Boolean(badge.qrToken),
      photoPresente: Boolean(badge.photoUrl),
    };
  }

  private evaluerStatut(b: { dateValidite: Date | string; statut: StatutBadge }): StatutBadge {
    if (b.statut === StatutBadge.ANNULE) return StatutBadge.ANNULE;
    const exp = new Date(b.dateValidite);
    if (exp < new Date()) return StatutBadge.EXPIRE;
    return StatutBadge.ACTIF;
  }

  // ----------------------------------------------------------- consultation

  async liste(query: BadgeQueryDto) {
    const pagination = paginer(query);

    const where: Prisma.BadgeAccesWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut as StatutBadge } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
              { nom: { contains: query.search, mode: 'insensitive' } },
              { prenom: { contains: query.search, mode: 'insensitive' } },
              { organisation: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.badgeAcces.findMany({
        where,
        include: BADGE_INCLUDE,
        orderBy: { dateDelivrance: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.badgeAcces.count({ where }),
    ]);

    // Le statut stocké se périme tout seul : la liste expose donc le statut
    // effectif calculé depuis la date, sans écrire en base lors d'une lecture.
    // Réserve connue : le filtre `?statut=` porte toujours sur la valeur
    // stockée, un badge périmé remonte donc encore dans le filtre « ACTIF ».
    const lignes = data.map((b) => ({ ...b, statut: this.evaluerStatut(b) }));

    return pagine(lignes, total, pagination);
  }

  async trouver(id: string) {
    const badge = await this.prisma.badgeAcces.findUnique({
      where: { id },
      include: BADGE_INCLUDE,
    });
    if (!badge) throw new NotFoundException(t('badges.badge_introuvable'));
    // Projection seulement : une lecture ne modifie pas le badge sans audit.
    return { ...badge, statut: this.evaluerStatut(badge) };
  }

  // ---------------------------------------------------------------- édition

  async creer(dto: CreateBadgeDto, user: AuthUser) {
    const annee = anneeNumero();
    let badge: Awaited<ReturnType<typeof this.prisma.badgeAcces.create>> | null = null;

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        badge = await this.prisma.$transaction(async (tx) => {
          const numero = await this.prochainNumero(tx, annee);
          const badge = await tx.badgeAcces.create({
            data: {
              numero,
              type: dto.type,
              nom: dto.nom,
              prenom: dto.prenom,
              fonction: dto.fonction ?? null,
              organisation: dto.organisation ?? null,
              telephone: dto.telephone ?? null,
              email: dto.email ?? null,
              pieceIdentite: dto.pieceIdentite ?? null,
              numeroPiece: dto.numeroPiece ?? null,
              dateValidite: new Date(dto.dateValidite),
              zonesAccess: dto.zonesAccess ?? null,
              qrToken: this.nouveauQrToken(),
              creeParId: user.id,
              photoUrl: dto.photoUrl ?? null,
              statut: StatutBadge.ACTIF,
            },
            include: BADGE_INCLUDE,
          });
          await journaliser(tx, user, 'BADGE_ACCES_EMIS', 'BadgeAcces', badge.id, {
            avant: null,
            apres: this.instantaneAudit(badge),
            champsModifies: ['type', 'statut', 'dateValidite', 'zonesAccess', 'qrToken', 'photoUrl'],
          });
          return badge;
        });
        break;
      } catch (e: any) {
        if (e?.code === 'P2002') continue;
        throw e;
      }
    }
    if (!badge) throw new BadRequestException(t('badges.impossible_de_generer_un_numero_de_badge'));

    return badge;
  }

  async modifier(id: string, dto: UpdateBadgeDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BadgeAcces" WHERE id = ${id} FOR UPDATE`;
      const badge = await tx.badgeAcces.findUnique({ where: { id }, include: BADGE_INCLUDE });
      if (!badge) throw new NotFoundException(t('badges.badge_introuvable'));
      if (this.evaluerStatut(badge) === StatutBadge.ANNULE) {
        throw new BadRequestException(t('badges.un_badge_annule_ne_se_modifie_plus'));
      }
      const data: Prisma.BadgeAccesUpdateInput = {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.prenom !== undefined ? { prenom: dto.prenom } : {}),
        ...(dto.fonction !== undefined ? { fonction: dto.fonction } : {}),
        ...(dto.organisation !== undefined ? { organisation: dto.organisation } : {}),
        ...(dto.telephone !== undefined ? { telephone: dto.telephone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.pieceIdentite !== undefined ? { pieceIdentite: dto.pieceIdentite } : {}),
        ...(dto.numeroPiece !== undefined ? { numeroPiece: dto.numeroPiece } : {}),
        ...(dto.dateValidite !== undefined ? { dateValidite: new Date(dto.dateValidite) } : {}),
        ...(dto.zonesAccess !== undefined ? { zonesAccess: dto.zonesAccess } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.motif !== undefined ? { motif: dto.motif } : {}),
      };
      const maj = await tx.badgeAcces.update({ where: { id }, data, include: BADGE_INCLUDE });
      const statut = this.evaluerStatut(maj);
      const final =
        statut !== maj.statut
          ? await tx.badgeAcces.update({ where: { id }, data: { statut }, include: BADGE_INCLUDE })
          : maj;
      await journaliser(tx, user, 'BADGE_ACCES_MODIFIE', 'BadgeAcces', id, {
        avant: this.instantaneAudit(badge),
        apres: this.instantaneAudit(final),
        champsModifies: [...Object.keys(data), ...(statut !== badge.statut ? ['statut'] : [])],
      });
      return final;
    });
  }

  async annuler(id: string, dto: AnnulerBadgeDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BadgeAcces" WHERE id = ${id} FOR UPDATE`;
      const badge = await tx.badgeAcces.findUnique({ where: { id }, include: BADGE_INCLUDE });
      if (!badge) throw new NotFoundException(t('badges.badge_introuvable'));
      if (this.evaluerStatut(badge) === StatutBadge.ANNULE) {
        throw new BadRequestException(t('badges.ce_badge_est_deja_annule'));
      }
      const miseAJour = await tx.badgeAcces.update({
        where: { id },
        data: { statut: StatutBadge.ANNULE, motif: dto.motif },
        include: BADGE_INCLUDE,
      });
      await journaliser(tx, user, 'BADGE_ACCES_ANNULE', 'BadgeAcces', id, {
        avant: this.instantaneAudit(badge),
        apres: this.instantaneAudit(miseAJour),
        motifFourni: Boolean(dto.motif),
        champsModifies: ['statut', 'motif'],
      });
      return miseAJour;
    });
  }

  async rallonger(id: string, dto: RallongerBadgeDto, user: AuthUser) {
    if (new Date(dto.dateValidite) <= new Date()) {
      throw new BadRequestException(t('badges.la_nouvelle_date_doit_etre_dans_le_futur'));
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BadgeAcces" WHERE id = ${id} FOR UPDATE`;
      const badge = await tx.badgeAcces.findUnique({ where: { id }, include: BADGE_INCLUDE });
      if (!badge) throw new NotFoundException(t('badges.badge_introuvable'));
      if (this.evaluerStatut(badge) === StatutBadge.ANNULE) {
        throw new BadRequestException(t('badges.un_badge_annule_ne_se_rallonge_pas_creez_en_un_nouveau'));
      }
      const ecriture = await tx.badgeAcces.updateMany({
        where: { id, statut: badge.statut },
        data: { dateValidite: new Date(dto.dateValidite), statut: StatutBadge.ACTIF },
      });
      if (ecriture.count !== 1) {
        throw new ConflictException(t('badges.ecriture_concurrente_reessayez'));
      }
      const miseAJour = await tx.badgeAcces.findUnique({ where: { id }, include: BADGE_INCLUDE });
      if (!miseAJour) throw new NotFoundException(t('badges.badge_introuvable'));
      await journaliser(tx, user, 'BADGE_ACCES_RALLONGE', 'BadgeAcces', id, {
        avant: this.instantaneAudit(badge),
        apres: this.instantaneAudit(miseAJour),
        champsModifies: ['dateValidite', 'statut'],
      });
      return miseAJour;
    });
  }

  // ----------------------------------------------------------- impression

  private urlVerification(baseUrl: string, badgeId: string, qrToken: string): string {
    const params = new URLSearchParams({ badge: badgeId, k: qrToken });
    return `${baseUrl.replace(/\/+$/, '')}/#/verification-badge?${params.toString()}`;
  }

  /**
   * Page de vérité du badge : ce que voit le vigile qui scanne le QR imprimé.
   * Ouverte à tous — la sécurité tient au jeton, pas à une session — et
   * volontairement avare : on confirme une identité présentée, on ne publie
   * pas le carnet des visiteurs (ni téléphone, ni e-mail, ni pièce).
   */
  async verifier(dto: VerifierBadgePubliqueDto, ip?: string) {
    const id = String(dto.badge ?? '').trim();
    const jeton = String(dto.k ?? '').trim();

    const badge = await this.prisma.badgeAcces.findUnique({
      where: { id },
      select: BADGE_VERIFICATION_SELECT,
    });

    if (!badge) {
      await this.prisma.auditLog.create({
        data: {
          action: 'VERIF_BADGE_ECHEC',
          entite: 'badges',
          entiteId: id,
          details: `Identifiant inconnu ${id}`,
          ip,
        },
      });
      return { valide: false, raison: 'Aucun badge ne correspond à cet identifiant.' };
    }

    const jetonOk = badge.qrToken === jeton;
    const statutEffectif = this.evaluerStatut(badge);
    const valide = jetonOk && statutEffectif === StatutBadge.ACTIF;

    await this.prisma.auditLog.create({
      data: {
        action: valide ? 'VERIF_BADGE_OK' : 'VERIF_BADGE_ECHEC',
        entite: 'badges',
        entiteId: badge.id,
        details: valide
          ? 'Vérification publique réussie'
          : `Jeton ${jetonOk ? 'OK' : 'invalide'} / statut ${statutEffectif}`,
        ip,
      },
    });

    if (!jetonOk) {
      return {
        valide: false,
        raison:
          'Le code de vérification ne correspond pas à ce badge : le document présenté est peut-être une copie falsifiée.',
      };
    }
    if (statutEffectif === StatutBadge.ANNULE) {
      return {
        valide: false,
        raison: "Ce badge a été annulé. Il n'ouvre plus aucun accès.",
      };
    }
    if (statutEffectif === StatutBadge.EXPIRE) {
      return {
        valide: false,
        raison: 'La validité de ce badge est expirée : il doit être rallongé par la scolarité.',
      };
    }

    return {
      valide: true,
      message: 'Badge authentique',
      badge: {
        numero: badge.numero,
        type: badge.type,
        porteur: `${badge.prenom} ${badge.nom}`,
        fonction: badge.fonction,
        organisation: badge.organisation,
        zonesAccess: badge.zonesAccess,
        dateDelivrance: badge.dateDelivrance,
        dateValidite: badge.dateValidite,
      },
    };
  }

  async imprimer(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException(t('badges.jeton_invalide_ou_expire'));
    }
    const badge = await this.trouver(id);
    const urlVerification = this.urlVerification(baseUrl, badge.id, badge.qrToken);
    const etablissement = await chargerEtablissement(this.prisma);
    return documentsBadge.documentA4(badge as unknown as BadgeImprimable, {
      urlVerification,
      etablissement,
    });
  }

  // ---------------------------------------------------------------- journal
}
