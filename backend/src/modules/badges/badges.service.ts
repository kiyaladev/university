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
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, StatutBadge } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
import {
  AnnulerBadgeDto,
  BadgeQueryDto,
  CreateBadgeDto,
  RallongerBadgeDto,
  UpdateBadgeDto,
} from './badges.dto';
import { documentsBadge, BadgeImprimable } from './documents';

const BADGE_INCLUDE = {
  creePar: { select: { id: true, nom: true, prenom: true } },
} as const;

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
  private async prochainNumero(
    tx: Prisma.TransactionClient,
    annee: string,
  ): Promise<string> {
    const prefixe = `${PREFIXE}${annee}-`;
    const existantes = await tx.badgeAcces.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
    const max = existantes.reduce((m, b) => {
      const n = Number(b.numero.slice(prefixe.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefixe}${String(max + 1).padStart(5, '0')}`;
  }

  private nouveauQrToken(): string {
    return `UP-BADGE-${randomBytes(12).toString('base64url')}`;
  }

  private async evaluerStatut(b: { dateValidite: Date | string; statut: StatutBadge }): Promise<StatutBadge> {
    if (b.statut === StatutBadge.ANNULE) return StatutBadge.ANNULE;
    const exp = new Date(b.dateValidite);
    if (exp < new Date()) return StatutBadge.EXPIRE;
    return StatutBadge.ACTIF;
  }

  // ----------------------------------------------------------- consultation

  async liste(query: BadgeQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.badgeAcces.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const badge = await this.prisma.badgeAcces.findUnique({
      where: { id },
      include: BADGE_INCLUDE,
    });
    if (!badge) throw new NotFoundException('Badge introuvable');
    // Auto-promotion du statut si la date de validité est dépassée.
    const evalue = await this.evaluerStatut(badge);
    if (evalue !== badge.statut) {
      return this.prisma.badgeAcces.update({
        where: { id },
        data: { statut: evalue },
        include: BADGE_INCLUDE,
      });
    }
    return badge;
  }

  // ---------------------------------------------------------------- édition

  async creer(dto: CreateBadgeDto, user: AuthUser) {
    const annee = String(new Date().getFullYear());
    let badge: Awaited<ReturnType<typeof this.prisma.badgeAcces.create>> | null = null;

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        badge = await this.prisma.$transaction(async (tx) => {
          const numero = await this.prochainNumero(tx, annee);
          return tx.badgeAcces.create({
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
        });
        break;
      } catch (e: any) {
        if (e?.code === 'P2002') continue;
        throw e;
      }
    }
    if (!badge) throw new BadRequestException("Impossible de générer un numéro de badge.");

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'BADGE_ACCES_EMIS',
        entite: 'BadgeAcces',
        entiteId: badge.id,
        details: `${badge.numero} — ${badge.type} (${badge.prenom} ${badge.nom})`,
      },
    });

    return badge;
  }

  async modifier(id: string, dto: UpdateBadgeDto, user: AuthUser) {
    const badge = await this.trouver(id);
    if (badge.statut === StatutBadge.ANNULE) {
      throw new BadRequestException("Un badge annulé ne se modifie plus.");
    }
    const miseAJour = await this.prisma.badgeAcces.update({
      where: { id },
      data: {
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
      },
      include: BADGE_INCLUDE,
    });

    // Si on a rallongé la validité et que le badge était EXPIRE, on le réactive.
    const evalue = await this.evaluerStatut(miseAJour);
    if (evalue !== miseAJour.statut) {
      const final = await this.prisma.badgeAcces.update({
        where: { id },
        data: { statut: evalue },
        include: BADGE_INCLUDE,
      });
      await this.journal(user.id, 'BADGE_ACCES_MODIFIE', id);
      return final;
    }

    await this.journal(user.id, 'BADGE_ACCES_MODIFIE', id);
    return miseAJour;
  }

  async annuler(id: string, dto: AnnulerBadgeDto, user: AuthUser) {
    const badge = await this.trouver(id);
    if (badge.statut === StatutBadge.ANNULE) {
      throw new BadRequestException('Ce badge est déjà annulé.');
    }
    const miseAJour = await this.prisma.badgeAcces.update({
      where: { id },
      data: {
        statut: StatutBadge.ANNULE,
        motif: dto.motif,
      },
      include: BADGE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'BADGE_ACCES_ANNULE',
        entite: 'BadgeAcces',
        entiteId: id,
        details: dto.motif,
      },
    });
    return miseAJour;
  }

  async rallonger(id: string, dto: RallongerBadgeDto, user: AuthUser) {
    const badge = await this.trouver(id);
    if (badge.statut === StatutBadge.ANNULE) {
      throw new BadRequestException("Un badge annulé ne se rallonge pas : créez-en un nouveau.");
    }
    if (new Date(dto.dateValidite) <= new Date()) {
      throw new BadRequestException('La nouvelle date doit être dans le futur.');
    }
    const miseAJour = await this.prisma.badgeAcces.update({
      where: { id },
      data: {
        dateValidite: new Date(dto.dateValidite),
        statut: StatutBadge.ACTIF,
      },
      include: BADGE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'BADGE_ACCES_RALLONGE',
        entite: 'BadgeAcces',
        entiteId: id,
        details: `Nouvelle validité : ${new Date(dto.dateValidite).toLocaleDateString('fr-FR')}`,
      },
    });
    return miseAJour;
  }

  // ----------------------------------------------------------- impression

  private urlVerification(baseUrl: string, badgeId: string, qrToken: string): string {
    const params = new URLSearchParams({ badge: badgeId, k: qrToken });
    return `${baseUrl.replace(/\/+$/, '')}/#/verification-badge?${params.toString()}`;
  }

  async imprimer(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    const badge = await this.trouver(id);
    const urlVerification = this.urlVerification(baseUrl, badge.id, badge.qrToken);
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    return documentsBadge.documentA4(badge as unknown as BadgeImprimable, {
      urlVerification,
      nomEtablissement: etablissement,
    });
  }

  // ---------------------------------------------------------------- journal

  private async journal(userId: string, action: string, entiteId: string, details?: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entite: 'BadgeAcces',
        entiteId,
        ...(details ? { details } : {}),
      },
    });
  }
}