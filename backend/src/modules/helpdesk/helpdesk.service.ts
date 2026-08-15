/**
 * Support IT & helpdesk campus : un QR collé sur chaque équipement (vidéo-
 * projecteur, micro d'amphi, poste informatique, climatisation…) amène
 * l'enseignant à la déclaration en deux clics. Le code QR (UP-IT-<base64url>)
 * est un jeton imprimé sur l'étiquette, inconnu de la base : le résoudre à
 * l'envers (par-code) rend l'usurpation d'intitulé impossible — un QR forgé
 * ne correspond à aucun équipement.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, StatutTicket } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as QRCode from 'qrcode';
import { AuthUser } from '../../common/decorators';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.module';
import {
  CreateEquipementDto,
  DeclarerTicketDto,
  EquipementQueryDto,
  TicketQueryDto,
  TraiterTicketDto,
  UpdateEquipementDto,
} from './helpdesk.dto';

const PREFIX_TICKET = 'TKT-';

const TICKET_INCLUDE = {
  equipement: { select: { id: true, libelle: true, emplacement: true } },
  utilisateur: { select: { id: true, nom: true, prenom: true } },
  traitePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.TicketSupportInclude;

/** Rôles qui voient tout le registre tickets ; les autres ne voient que les leurs. */
const ROLE_GESTION: Role[] = [Role.ADMIN, Role.SCOLARITE, Role.DIRECTION];

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class EquipementsService extends CrudService {
  constructor(
    prisma: PrismaService,
    private jwt: JwtService,
    private parametres: ParametresService,
  ) {
    super(prisma, 'equipementCampus', {
      orderBy: { libelle: 'asc' },
      include: { _count: { select: { tickets: true } } },
      searchFields: ['libelle', 'emplacement'],
      label: 'Équipement',
    });
  }

  /** Inventaire : tous les équipements, filtrés par ?search & ?actif. */
  liste(query: EquipementQueryDto) {
    return this.findAll(query, {
      ...(query.actif != null ? { actif: query.actif === 'true' } : {}),
    });
  }

  /**
   * Résolution du QR scanné : renvoie l'équipement si le code existe et est
   * actif. Le code est unique et imprimé au public — un QR forgé ne désigne
   * rien, une étiquette photocopiée ne détourne pas le flux vers un imposteur.
   */
  async parCode(codeQr: string) {
    const equipement = await this.prisma.equipementCampus.findUnique({
      where: { codeQr },
    });
    if (!equipement || !equipement.actif) {
      throw new NotFoundException('Équipement inconnu ou désactivé');
    }
    return equipement;
  }

  async creer(dto: CreateEquipementDto, user: AuthUser) {
    const equipement = await this.create({
      libelle: dto.libelle,
      emplacement: dto.emplacement || null,
      actif: dto.actif ?? true,
      codeQr: `UP-IT-${randomBytes(12).toString('base64url')}`,
    });
    await this.tracer(user, 'EQUIPEMENT_CREATION', equipement.id, equipement.libelle);
    return equipement;
  }

  async modifier(id: string, dto: UpdateEquipementDto, user: AuthUser) {
    const equipement = await this.update(id, {
      ...(dto.libelle != null ? { libelle: dto.libelle } : {}),
      ...(dto.emplacement != null ? { emplacement: dto.emplacement || null } : {}),
      ...(dto.actif != null ? { actif: dto.actif } : {}),
    });
    await this.tracer(user, 'EQUIPEMENT_MODIFICATION', equipement.id, equipement.libelle);
    return equipement;
  }

  async supprimer(id: string, user: AuthUser) {
    const equipement = await this.findOne(id);
    await this.remove(id);
    await this.tracer(user, 'EQUIPEMENT_SUPPRESSION', id, equipement.libelle);
    return { id, libelle: equipement.libelle };
  }

  private async tracer(user: AuthUser, action: string, entiteId: string, details?: string) {
    await this.prisma.auditLog.create({
      data: { userId: user.id, action, entite: 'Equipement', entiteId, details },
    });
  }

  /**
   * Feuille A4 d'étiquettes autocollantes (4 QR identiques) : ouverte dans un
   * nouvel onglet sans en-tête Authorization, le jeton passe par l'URL et est
   * vérifié à la main (même motif que l'impression des attestations).
   */
  async imprimerQr(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    const equipement = await this.findOne(id);
    const urlSignalement = `${baseUrl.replace(/\/+$/, '')}/#/helpdesk?equipement=${encodeURIComponent(equipement.codeQr)}`;
    const qr = await QRCode.toDataURL(urlSignalement, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    const nomEtablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');

    const etiquettes = Array.from(
      { length: 4 },
      () => `
      <div class="etiquette">
        <img src="${qr}" alt="QR de signalement" />
        <div class="libelle">${echapper(equipement.libelle)}</div>
        <div class="emplacement">${echapper(equipement.emplacement ?? 'Emplacement à préciser')}</div>
        <div class="code">${echapper(equipement.codeQr)}</div>
      </div>`,
    ).join('');

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Étiquette QR — ${echapper(equipement.libelle)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #10251E; margin: 0; }
  .entete { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #10251E; padding-bottom: 4px; margin-bottom: 6mm; }
  .etab { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #10251E; }
  .consigne { font-size: 10px; color: #33463F; }
  .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
  .etiquette { border: 1.5px dashed #33463F; padding: 5mm 4mm; text-align: center; page-break-inside: avoid; }
  .etiquette img { width: 40mm; height: 40mm; }
  .libelle { font-weight: 700; text-transform: uppercase; letter-spacing: .03em; font-size: 12.5px; margin-top: 2mm; }
  .emplacement { font-size: 11px; color: #33463F; margin-top: 1mm; }
  .code { font-size: 9px; font-family: Consolas, monospace; color: #10251E; margin-top: 2mm; word-break: break-all; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="entete">
    <span class="etab">${echapper(nomEtablissement)} — support IT</span>
    <span class="consigne">Scannez pour signaler un problème à la DSI · ${echapper(equipement.codeQr)}</span>
  </div>
  <div class="grille">${etiquettes}</div>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

@Injectable()
export class TicketsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'ticketSupport', {
      orderBy: { createdAt: 'desc' },
      include: TICKET_INCLUDE,
      label: 'Ticket',
    });
  }

  private visibiliteReduite(user: AuthUser): boolean {
    return !ROLE_GESTION.includes(user.role);
  }

  async liste(query: TicketQueryDto, user: AuthUser) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.TicketSupportWhereInput = {
      ...(this.visibiliteReduite(user) ? { utilisateurId: user.id } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.categorie ? { categorie: query.categorie } : {}),
      ...(query.priorite ? { priorite: query.priorite } : {}),
      ...(query.equipementId ? { equipementId: query.equipementId } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { declarantNom: { contains: query.search, mode: 'insensitive' } },
              { equipement: { libelle: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.ticketSupport.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.ticketSupport.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async findTicket(id: string, user: AuthUser) {
    const ticket = await this.findOne(id);
    if (this.visibiliteReduite(user) && ticket.utilisateurId !== user.id) {
      throw new NotFoundException('Ticket introuvable');
    }
    return ticket;
  }

  /**
   * Numéro séquentiel par année : "TKT-2026-0001". Le compteur se lit dans la
   * base ; deux déclarations simultanées tentent le même numéro, la contrainte
   * @unique départage et la création recommence avec le suivant.
   */
  private async prochainNumero(tx: Prisma.TransactionClient, annee: string): Promise<string> {
    const prefixe = `${PREFIX_TICKET}${annee}-`;
    const existants = await tx.ticketSupport.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
    const max = existants.reduce((m, t) => {
      const n = Number(t.numero.slice(prefixe.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefixe}${String(max + 1).padStart(4, '0')}`;
  }

  /** Déclaration rapide : n'importe quel utilisateur connecté. */
  async declarer(dto: DeclarerTicketDto, user: AuthUser) {
    if (dto.equipementId) {
      const equipement = await this.prisma.equipementCampus.findUnique({
        where: { id: dto.equipementId },
      });
      if (!equipement || !equipement.actif) {
        throw new BadRequestException("L'équipement visé est inconnu ou désactivé");
      }
    }

    const annee = String(new Date().getFullYear());
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const ticket = await this.prisma.$transaction(async (tx) => {
          const numero = await this.prochainNumero(tx, annee);
          return tx.ticketSupport.create({
            data: {
              numero,
              equipementId: dto.equipementId ?? null,
              categorie: dto.categorie,
              description: dto.description,
              priorite: dto.priorite,
              statut: StatutTicket.OUVERT,
              utilisateurId: user.id,
              declarantNom: `${user.prenom} ${user.nom}`,
              declarantEmail: user.email,
            },
            include: TICKET_INCLUDE,
          });
        });

        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'TICKET_OUVERT',
            entite: 'TicketSupport',
            entiteId: ticket.id,
            details: `${ticket.numero} — ${ticket.categorie} : ${ticket.description.slice(0, 120)}`,
          },
        });
        return ticket;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Numéro de ticket temporairement indisponible, réessayez.');
  }

  /** Prise en charge : seuls les tickets OUVERT ou EN_COURS changent de statut. */
  async changerStatut(id: string, dto: TraiterTicketDto, user: AuthUser) {
    const ticket = await this.findOne(id);
    if (ticket.statut !== StatutTicket.OUVERT && ticket.statut !== StatutTicket.EN_COURS) {
      throw new BadRequestException(
        'Seuls les tickets ouverts ou en cours changent de statut : un ticket résolu ou clôturé est clos.',
      );
    }

    const miseAJour = await this.prisma.ticketSupport.update({
      where: { id },
      data: {
        statut: dto.statut,
        traiteParId: user.id,
        ...(dto.statut === StatutTicket.CLOTURE
          ? { clicheLe: new Date() }
          : { traiteLe: new Date() }),
      },
      include: TICKET_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `TICKET_${dto.statut}`,
        entite: 'TicketSupport',
        entiteId: id,
        details: `${miseAJour.numero} — ${dto.statut}`,
      },
    });
    return miseAJour;
  }

  /** Petit agrégat pour la DSI : volumes et taux de traitement dans les 24h. */
  async stats() {
    const ilY24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, parStatut, resolus24h] = await Promise.all([
      this.prisma.ticketSupport.count(),
      this.prisma.ticketSupport.groupBy({
        by: ['statut'],
        _count: { _all: true },
      }),
      this.prisma.ticketSupport.count({
        where: { statut: StatutTicket.RESOLU, traiteLe: { gte: ilY24h } },
      }),
    ]);

    const comptes = { OUVERT: 0, EN_COURS: 0, RESOLU: 0, CLOTURE: 0 };
    for (const ligne of parStatut) comptes[ligne.statut] = ligne._count._all;
    const resolus = comptes.RESOLU;
    const taux24h = resolus > 0 ? Math.round((resolus24h / resolus) * 100) : 0;

    return {
      total,
      ...comptes,
      resolus24h,
      tauxResolution24h: taux24h,
    };
  }
}