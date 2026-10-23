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
import { t } from '../../common/i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.service';
import { SERIES_NUMERO, millesimeSerie, prochainNumeroSerie } from '../../common/numero';
import { chargerEtablissement, echapper, pageA4, PALETTE_IMPRESSION, STYLE_ETIQUETTES } from '../../common/impression';
import {
  CreateEquipementDto,
  DeclarerTicketDto,
  EquipementQueryDto,
  TicketQueryDto,
  TraiterTicketDto,
  UpdateEquipementDto,
} from './helpdesk.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';

const TICKET_INCLUDE = {
  equipement: { select: { id: true, libelle: true, emplacement: true } },
  utilisateur: { select: { id: true, nom: true, prenom: true } },
  traitePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.TicketSupportInclude;

/** Rôles qui voient tout le registre tickets ; les autres ne voient que les leurs. */
const ROLE_GESTION: Role[] = [Role.ADMIN, Role.SCOLARITE, Role.DIRECTION];

/**
 * Colonnes lues pour l'état « avant » d'un équipement : le code QR imprimé
 * n'est jamais chargé par le chemin du journal, il ne peut donc pas s'y
 * glisser. Même projection que celle renvoyée à l'écran.
 */
const EQUIPEMENT_AUDIT = {
  id: true,
  libelle: true,
  emplacement: true,
  actif: true,
  createdAt: true,
} satisfies Prisma.EquipementCampusSelect;

/**
 * Colonnes lues pour l'état « avant » d'un ticket. Les champs de texte libre
 * et de coordonnées y figurent pour produire de simples indicateurs de
 * présence : leurs valeurs ne quittent jamais le service.
 */
const TICKET_AUDIT = {
  id: true,
  numero: true,
  categorie: true,
  priorite: true,
  statut: true,
  equipementId: true,
  utilisateurId: true,
  traiteParId: true,
  traiteLe: true,
  clicheLe: true,
  description: true,
  declarantNom: true,
  declarantEmail: true,
  declarantTelephone: true,
} satisfies Prisma.TicketSupportSelect;

/** Inventaire projeté : ni code QR, ni jeton, aucune donnée personnelle. */
function instantaneEquipement(equipement: any) {
  return {
    id: equipement.id,
    libelle: equipement.libelle,
    emplacement: equipement.emplacement ?? null,
    actif: equipement.actif,
    createdAt: equipement.createdAt ?? null,
  };
}

/**
 * Ticket projeté : catégorie, priorité, statut, affectation et horodatages de
 * traitement. Le texte du ticket, la réponse, les pièces jointes et
 * l'identité de contact du déclarant restent hors journal — leur présence
 * seule est notée.
 */
function instantaneTicket(ticket: any) {
  return {
    id: ticket.id,
    numero: ticket.numero,
    categorie: ticket.categorie,
    priorite: ticket.priorite,
    statut: ticket.statut,
    equipementId: ticket.equipementId ?? null,
    utilisateurId: ticket.utilisateurId ?? null,
    traiteParId: ticket.traiteParId ?? null,
    traiteLe: ticket.traiteLe ?? null,
    clicheLe: ticket.clicheLe ?? null,
    descriptionFournie: Boolean(ticket.description),
    declarantNomFourni: Boolean(ticket.declarantNom),
    contactDeclarantFourni: Boolean(ticket.declarantEmail || ticket.declarantTelephone),
  };
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
      // Le code imprimé dans le QR est un identifiant de résolution public :
      // l'inventaire ne doit pas le recopier dans chaque réponse authentifiée.
      select: {
        id: true,
        libelle: true,
        emplacement: true,
        actif: true,
        createdAt: true,
        _count: { select: { tickets: true } },
      },
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
   * Résolution publique du QR : ne renvoie que l'identité fonctionnelle
   * nécessaire au formulaire de signalement, sans recopier le code secret.
   */
  async parCode(codeQr: string) {
    const equipement =
      codeQr.length > 64
        ? null
        : await this.prisma.equipementCampus.findUnique({
            where: { codeQr },
            select: { id: true, libelle: true, emplacement: true, actif: true },
          });
    if (!equipement || !equipement.actif) {
      throw new NotFoundException(t('helpdesk.equipement_inconnu_ou_desactive'));
    }
    return {
      id: equipement.id,
      libelle: equipement.libelle,
      emplacement: equipement.emplacement,
    };
  }

  /**
   * Les écritures de l'inventaire passent par le client transactionnel plutôt
   * que par le CrudService : la mutation et son entrée de journal sont
   * validées ensemble, ce que le CrudService (hors transaction) ne permet pas.
   * La projection renvoyée est inchangée — le code QR imprimé en est absent.
   */
  async creer(dto: CreateEquipementDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const equipement = await tx.equipementCampus.create({
        data: {
          libelle: dto.libelle,
          emplacement: dto.emplacement || null,
          actif: dto.actif ?? true,
          codeQr: `UP-IT-${randomBytes(12).toString('base64url')}`,
        },
        select: EQUIPEMENT_AUDIT,
      });
      await journaliser(tx, user, 'EQUIPEMENT_CREATION', 'Equipement', equipement.id, {
        avant: null,
        apres: instantaneEquipement(equipement),
      });
      return equipement;
    });
  }

  /**
   * Activation, désactivation, déplacement ou renommage : la trace conserve
   * l'état précédant l'écriture et les champs réellement touchés, ce qui
   * rend la bascule d'activité lisible sans le code QR.
   */
  async modifier(id: string, dto: UpdateEquipementDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.equipementCampus.findUnique({ where: { id }, select: EQUIPEMENT_AUDIT });
      if (!avant) {
        throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Équipement' }));
      }

      const data = {
        ...(dto.libelle != null ? { libelle: dto.libelle } : {}),
        ...(dto.emplacement != null ? { emplacement: dto.emplacement || null } : {}),
        ...(dto.actif != null ? { actif: dto.actif } : {}),
      };
      const apres = await tx.equipementCampus.update({ where: { id }, data, select: EQUIPEMENT_AUDIT });
      await journaliser(tx, user, 'EQUIPEMENT_MODIFICATION', 'Equipement', id, {
        avant: instantaneEquipement(avant),
        apres: instantaneEquipement(apres),
        champsModifies: Object.keys(data),
      });
      return apres;
    });
  }

  async supprimer(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await tx.equipementCampus.findUnique({ where: { id }, select: EQUIPEMENT_AUDIT });
      if (!avant) {
        throw new NotFoundException(t('helpdesk.equipement_inconnu_ou_desactive'));
      }
      await tx.equipementCampus.delete({ where: { id } });
      await journaliser(tx, user, 'EQUIPEMENT_SUPPRESSION', 'Equipement', id, {
        avant: instantaneEquipement(avant),
        apres: null,
      });
      return { id, libelle: avant.libelle };
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
      throw new UnauthorizedException(t('helpdesk.jeton_invalide_ou_expire'));
    }

    // `findOne` intentionally omits codeQr from authenticated API responses;
    // printing is the one internal path that needs the stored code itself.
    const equipement = await this.prisma.equipementCampus.findUnique({
      where: { id },
      select: { id: true, libelle: true, emplacement: true, codeQr: true },
    });
    if (!equipement) throw new NotFoundException(t('patrimoine.equipement_introuvable'));
    const urlSignalement = `${baseUrl.replace(/\/+$/, '')}/#/helpdesk?equipement=${encodeURIComponent(equipement.codeQr)}`;
    const qr = await QRCode.toDataURL(urlSignalement, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    const etablissement = await chargerEtablissement(this.prisma);

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

    return pageA4({
      titre: `Étiquette QR — ${equipement.libelle}`,
      lang: 'fr',
      etablissement,
      marge: '8mm',
      entete: null,
      styles: STYLE_ETIQUETTE_SUPPORT,
      corps: `<div class="entete">
    <span class="etab">${echapper(etablissement.nom)} — support IT</span>
    <span class="consigne">Scannez pour signaler un problème à la DSI · ${echapper(equipement.codeQr)}</span>
  </div>
  <div class="grille">${etiquettes}</div>`,
    });
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
    const pagination = paginer(query);

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
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.ticketSupport.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  async findTicket(id: string, user: AuthUser) {
    const ticket = await this.prisma.ticketSupport.findFirst({
      where: {
        id,
        ...(this.visibiliteReduite(user) ? { utilisateurId: user.id } : {}),
      },
      include: TICKET_INCLUDE,
    });
    if (!ticket) throw new NotFoundException(t('helpdesk.ticket_introuvable'));
    return ticket;
  }

  /**
   * Numéro séquentiel par année : "TKT-2026-0001". Le compteur se lit dans la
   * base ; deux déclarations simultanées tentent le même numéro, la contrainte
   * @unique départage et la création recommence avec le suivant.
   */
  private async prochainNumero(tx: Prisma.TransactionClient, annee: string): Promise<string> {
    return prochainNumeroSerie(tx, SERIES_NUMERO.TICKET_SUPPORT, annee);
  }

  /** Déclaration rapide : n'importe quel utilisateur connecté. */
  async declarer(dto: DeclarerTicketDto, user: AuthUser) {
    if (dto.equipementId) {
      const equipement = await this.prisma.equipementCampus.findUnique({
        where: { id: dto.equipementId },
      });
      if (!equipement || !equipement.actif) {
        throw new BadRequestException(t('helpdesk.l_equipement_vise_est_inconnu_ou_desactive'));
      }
    }

    const annee = millesimeSerie(SERIES_NUMERO.TICKET_SUPPORT);
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const numero = await this.prochainNumero(tx, annee);
          const ticket = await tx.ticketSupport.create({
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
          // La trace est dans la transaction de la création : la reprise sur
          // conflit de numéro annule aussi la trace de la tentative avortée,
          // et un ticket créé ne peut pas rester sans entrée de journal.
          await journaliser(tx, user, 'TICKET_OUVERT', 'TicketSupport', ticket.id, {
            avant: null,
            apres: instantaneTicket(ticket),
          });
          return ticket;
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('helpdesk.numero_de_ticket_temporairement_indisponible_reessayez'));
  }

  /**
   * Prise en charge : seuls les tickets OUVERT ou EN_COURS changent de statut.
   *
   * La transition porte le statut, l'agent affecté et l'horodatage (prise en
   * charge ou clôture) ; les trois sont écrits avec la trace dans la même
   * transaction, et l'état « avant » est relu dans cette transaction pour que
   * la trace décrive l'état réellement remplacé.
   */
  async changerStatut(id: string, dto: TraiterTicketDto, user: AuthUser) {
    const ticket = await this.findOne(id);
    if (ticket.statut !== StatutTicket.OUVERT && ticket.statut !== StatutTicket.EN_COURS) {
      throw new BadRequestException(t('helpdesk.seuls_les_tickets_ouverts_ou_en_cours_changent_de_statut_un_'));
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TicketSupport" WHERE id = ${id} FOR UPDATE`;
      const avant = await tx.ticketSupport.findUnique({ where: { id }, select: TICKET_AUDIT });
      if (!avant) throw new NotFoundException(t('common.notFound'));
      if (avant.statut !== StatutTicket.OUVERT && avant.statut !== StatutTicket.EN_COURS) {
        throw new BadRequestException(t('helpdesk.seuls_les_tickets_ouverts_ou_en_cours_changent_de_statut_un_'));
      }
      const cloture = dto.statut === StatutTicket.CLOTURE;
      const apres = await tx.ticketSupport.update({
        where: { id },
        data: {
          statut: dto.statut,
          traiteParId: user.id,
          ...(cloture ? { clicheLe: new Date() } : { traiteLe: new Date() }),
        },
        include: TICKET_INCLUDE,
      });

      await journaliser(tx, user, `TICKET_${dto.statut}`, 'TicketSupport', id, {
        avant: avant ? instantaneTicket(avant) : null,
        apres: instantaneTicket(apres),
        champsModifies: ['statut', 'traiteParId', cloture ? 'clicheLe' : 'traiteLe'],
      });
      return apres;
    });
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

/** Étiquette de support IT : planche commune + lignes propres au helpdesk. */
const STYLE_ETIQUETTE_SUPPORT = `${STYLE_ETIQUETTES}
  .etiquette img { width: 40mm; height: 40mm; }
  .emplacement { font-size: 11px; color: ${PALETTE_IMPRESSION.encreDouce}; margin-top: 1mm; }
  .code { font-size: 9px; font-family: Consolas, monospace; margin-top: 2mm; word-break: break-all; }
`;
