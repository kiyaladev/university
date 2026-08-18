/**
 * Plateforme de réclamations : guichet unique des doléances étudiantes.
 *
 * Cycle de vie d'une réclamation :
 *  - OUVERTE : déclaration, en attente de prise en charge
 *  - EN_COURS : un agent a pris le dossier
 *  - EN_ATTENTE_REPONSE : une réponse a été envoyée à l'étudiant, on attend son retour
 *  - RESOLUE / FERMEE : décision finale, l'étudiant est satisfait
 *  - REJETEE : décision finale, la réclamation est rejetée (motif obligatoire)
 *
 * Le délai d'escalade (delaiEscaladeHeures, 48 h par défaut) borne le temps
 * pendant lequel une réclamation peut dormir sans réaction. Une escalade force
 * la main à la direction en datant escaladeLe. La note de clôture (champ libre
 * concaténé aux notes existantes) consigne la décision finale.
 *
 * L'étudiant reste propriétaire : il voit l'historique complet et peut envoyer
 * des messages tant que la réclamation n'est pas close.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrioriteReclamation, Role, StatutReclamation, TypeReclamation } from '@prisma/client';
import { CrudService } from '../../common/crud.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

const PREFIX_RECLAMATION = 'REC-';
const STATUTS_OUVERTS: StatutReclamation[] = [
  StatutReclamation.OUVERTE,
  StatutReclamation.EN_COURS,
  StatutReclamation.EN_ATTENTE_REPONSE,
];

const STATUTS_CLOS: StatutReclamation[] = [
  StatutReclamation.RESOLUE,
  StatutReclamation.FERMEE,
  StatutReclamation.REJETEE,
];

export const RECLAMATION_INCLUDE = {
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true, telephone: true } },
  departement: { select: { id: true, code: true, nom: true } },
  assigneA: { select: { id: true, nom: true, prenom: true, role: true } },
  messages: {
    orderBy: { creeLe: 'asc' as const },
    include: {
      auteur: { select: { id: true, nom: true, prenom: true, role: true } },
    },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.ReclamationInclude;

@Injectable()
export class ReclamationsService extends CrudService {
  constructor(prisma: PrismaService) {
    super(prisma, 'reclamation', {
      orderBy: { creeLe: 'desc' },
      include: RECLAMATION_INCLUDE,
      label: 'Réclamation',
    });
  }

  /** Rôles autorisés à voir le registre entier (ADMIN, DIRECTION, SCOLARITE). */
  private voitTout(user: AuthUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.DIRECTION || user.role === Role.SCOLARITE;
  }

  /**
   * Le champ `notes` est le bloc-notes interne de la scolarité : il concatène
   * les commentaires de changement de statut et les notes de clôture, donc les
   * motifs de rejet rédigés « entre nous ». L'étudiant est propriétaire de sa
   * réclamation, pas de la délibération interne : on retire le champ de la
   * projection dès que le demandeur est un étudiant. `omit` agit côté Prisma,
   * le champ ne quitte donc jamais la base.
   */
  private omissionPour(user: AuthUser): Prisma.ReclamationOmit | undefined {
    return user.role === Role.ETUDIANT ? { notes: true } : undefined;
  }

  /** Numéro séquentiel par année : "REC-2026-00001". */
  private async prochainNumero(
    tx: Prisma.TransactionClient,
    annee: string,
  ): Promise<string> {
    const prefixe = `${PREFIX_RECLAMATION}${annee}-`;
    const existantes = await tx.reclamation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
    const max = existantes.reduce((m, r) => {
      const n = Number(r.numero.slice(prefixe.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefixe}${String(max + 1).padStart(5, '0')}`;
  }

  /** Liste paginée du registre, restreinte au propriétaire si l'utilisateur est étudiant. */
  async liste(
    query: {
      page?: number;
      pageSize?: number;
      all?: string;
      search?: string;
      statut?: StatutReclamation;
      type?: TypeReclamation;
      priorite?: PrioriteReclamation;
      departementId?: string;
      assigneAId?: string;
      escalade?: string;
    },
    user: AuthUser,
  ) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.ReclamationWhereInput = {
      ...(this.voitTout(user) ? {} : { etudiantId: user.etudiantId ?? '__aucun__' }),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.priorite ? { priorite: query.priorite } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
      ...(query.assigneAId ? { assigneAId: query.assigneAId } : {}),
      ...(query.escalade === 'oui' ? { escaladeLe: { not: null } } : {}),
      ...(query.escalade === 'non' ? { escaladeLe: null } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
              { sujet: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { nomAuteur: { contains: query.search, mode: 'insensitive' } },
              { emailAuteur: { contains: query.search, mode: 'insensitive' } },
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
      this.prisma.reclamation.findMany({
        where,
        include: RECLAMATION_INCLUDE,
        omit: this.omissionPour(user),
        orderBy: [{ priorite: 'desc' }, { creeLe: 'desc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.reclamation.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  /** Variante pour l'étudiant connecté — strictement bornée à ses réclamations. */
  async mesReclamations(query: {
    page?: number;
    pageSize?: number;
    all?: string;
    statut?: StatutReclamation;
  }, user: AuthUser) {
    if (!user.etudiantId) {
      throw new NotFoundException('Aucun dossier étudiant rattaché à ce compte');
    }
    return this.liste(query, user);
  }

  /**
   * Détail d'une réclamation — l'étudiant ne peut voir que les siennes, et
   * sans le bloc-notes interne (voir `omissionPour`). On requête ici plutôt
   * que via `findOne` du CRUD générique, qui ne sait pas omettre de champ.
   */
  async findOnePour(id: string, user: AuthUser) {
    const reclamation = await this.prisma.reclamation.findUnique({
      where: { id },
      include: RECLAMATION_INCLUDE,
      omit: this.omissionPour(user),
    });
    if (!reclamation) {
      throw new NotFoundException('Réclamation introuvable');
    }
    if (!this.voitTout(user) && reclamation.etudiantId !== user.etudiantId) {
      throw new NotFoundException('Réclamation introuvable');
    }
    return reclamation;
  }

  /**
   * Petite agrégation pour le tableau de bord (ADMIN, DIRECTION) : compteurs
   * par statut, urgentes, et réclamations dont le délai d'escalade est passé.
   */
  async dashboard() {
    const ilYA48h = new Date(Date.now() - 48 * 3600 * 1000);

    const [total, parStatut, urgentes, depassees] = await Promise.all([
      this.prisma.reclamation.count(),
      this.prisma.reclamation.groupBy({
        by: ['statut'],
        _count: { _all: true },
      }),
      this.prisma.reclamation.count({
        where: { priorite: PrioriteReclamation.URGENTE, statut: { in: STATUTS_OUVERTS } },
      }),
      this.prisma.reclamation.count({
        where: {
          statut: { in: STATUTS_OUVERTS },
          escaladeLe: null,
          creeLe: { lt: ilYA48h },
        },
      }),
    ]);

    const comptes: Record<StatutReclamation, number> = {
      OUVERTE: 0,
      EN_COURS: 0,
      EN_ATTENTE_REPONSE: 0,
      RESOLUE: 0,
      FERMEE: 0,
      REJETEE: 0,
    };
    for (const ligne of parStatut) comptes[ligne.statut] = ligne._count._all;

    return {
      total,
      ...comptes,
      urgentes,
      delaiDepasse: depassees,
    };
  }

  /** Création d'une réclamation : numéro séquentiel, premier message inclus. */
  async creer(
    dto: {
      type: TypeReclamation;
      sujet: string;
      description: string;
      priorite?: PrioriteReclamation;
      anonyme?: boolean;
      departementId?: string;
      nomAuteur?: string;
      emailAuteur?: string;
    },
    user: AuthUser,
  ) {
    const annee = String(new Date().getFullYear());
    const anonyme = dto.anonyme === true;

    // Un étudiant identifié ne peut pas être anonyme : on le rattache à sa fiche.
    const etudiantId = anonyme || !user.etudiantId ? null : user.etudiantId;
    const nomAuteur = anonyme ? dto.nomAuteur?.trim() || null : null;
    const emailAuteur = anonyme ? dto.emailAuteur?.trim() || null : null;

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const reclamation = await this.prisma.$transaction(async (tx) => {
          const numero = await this.prochainNumero(tx, annee);
          return tx.reclamation.create({
            data: {
              numero,
              type: dto.type,
              sujet: dto.sujet.trim(),
              description: dto.description.trim(),
              anonyme,
              etudiantId,
              nomAuteur,
              emailAuteur,
              priorite: dto.priorite ?? PrioriteReclamation.NORMALE,
              statut: StatutReclamation.OUVERTE,
              departementId: dto.departementId ?? null,
              messages: {
                create: {
                  auteurId: anonyme || !user.id ? null : user.id,
                  nomAffichage: anonyme
                    ? dto.nomAuteur?.trim() || 'Anonyme'
                    : `${user.prenom} ${user.nom}`.trim(),
                  contenu: dto.description.trim(),
                },
              },
            },
            include: RECLAMATION_INCLUDE,
          });
        });

        await this.tracer(user, 'RECLAMATION_OUVERTE', reclamation.id,
          `${reclamation.numero} — ${reclamation.type} : ${reclamation.sujet.slice(0, 80)}`);
        return reclamation;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Numéro de réclamation temporairement indisponible, réessayez.');
  }

  /**
   * Ajout d'un message à une réclamation. L'étudiant ne peut poster que sur
   * ses propres réclamations, et uniquement tant qu'elles ne sont pas closes.
   */
  async posterMessage(
    id: string,
    dto: { contenu: string; joint?: string },
    user: AuthUser,
  ) {
    const reclamation = await this.findOnePour(id, user);
    if (STATUTS_CLOS.includes(reclamation.statut)) {
      throw new BadRequestException(
        'Cette réclamation est close : aucun message supplémentaire n\'est accepté.',
      );
    }
    const contenu = dto.contenu.trim();
    if (!contenu) {
      throw new BadRequestException('Le message est vide.');
    }

    const message = await this.prisma.messageReclamation.create({
      data: {
        reclamationId: id,
        auteurId: user.id,
        nomAffichage: `${user.prenom} ${user.nom}`.trim(),
        contenu,
        joint: dto.joint ?? null,
      },
      include: {
        auteur: { select: { id: true, nom: true, prenom: true, role: true } },
      },
    });

    await this.tracer(user, 'RECLAMATION_MESSAGE', id, `message sur ${reclamation.numero}`);
    return message;
  }

  /** Changement de statut (ADMIN, DIRECTION, SCOLARITE). */
  async changerStatut(
    id: string,
    dto: { statut: StatutReclamation; commentaire?: string },
    user: AuthUser,
  ) {
    const reclamation = await this.findOne(id);

    if (STATUTS_CLOS.includes(dto.statut) && !dto.commentaire?.trim()) {
      throw new BadRequestException(
        'Une note est obligatoire pour clore (résoudre, fermer ou rejeter) une réclamation.',
      );
    }

    const data: Prisma.ReclamationUpdateInput = { statut: dto.statut };
    if (dto.commentaire?.trim()) {
      const stamp = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] ${dto.commentaire.trim()}`;
      data.notes = reclamation.notes
        ? `${reclamation.notes}\n${stamp}`
        : stamp;
    }
    if (dto.statut === StatutReclamation.RESOLUE || dto.statut === StatutReclamation.FERMEE || dto.statut === StatutReclamation.REJETEE) {
      data.fermeLe = new Date();
    }

    const miseAJour = await this.prisma.reclamation.update({
      where: { id },
      data,
      include: RECLAMATION_INCLUDE,
    });
    await this.tracer(user, `RECLAMATION_${dto.statut}`, id, `${reclamation.numero} → ${dto.statut}`);
    return miseAJour;
  }

  /** Assignation d'un agent à la réclamation. */
  async assigner(id: string, dto: { assigneAId: string }, user: AuthUser) {
    const reclamation = await this.findOne(id);
    const assigne = await this.prisma.user.findUnique({ where: { id: dto.assigneAId } });
    if (!assigne) throw new NotFoundException('Utilisateur introuvable');

    const data: Prisma.ReclamationUpdateInput = {
      assigneA: { connect: { id: dto.assigneAId } },
      // Prise en charge automatique si la réclamation était encore ouverte.
      statut: reclamation.statut === StatutReclamation.OUVERTE
        ? StatutReclamation.EN_COURS
        : reclamation.statut,
    };
    const miseAJour = await this.prisma.reclamation.update({
      where: { id },
      data,
      include: RECLAMATION_INCLUDE,
    });
    await this.tracer(user, 'RECLAMATION_ASSIGNEE', id,
      `${reclamation.numero} → ${assigne.prenom} ${assigne.nom}`);
    return miseAJour;
  }

  /**
   * Escalade forcée : la direction date escaladeLe = now(). Le contrôle est
   * partagé : escalader une réclamation exige que le délai configuré soit
   * effectivement dépassé — sauf si l'utilisateur est ADMIN (droit de
   * forçage manuel pour les urgences vraies).
   */
  async escalader(id: string, user: AuthUser) {
    const reclamation = await this.findOne(id);
    if (STATUTS_CLOS.includes(reclamation.statut)) {
      throw new BadRequestException('Cette réclamation est close : escalader n\'a plus de sens.');
    }
    const delaiHeures = reclamation.delaiEscaladeHeures ?? 48;
    const echeance = new Date(reclamation.creeLe.getTime() + delaiHeures * 3600 * 1000);
    const depasse = Date.now() >= echeance.getTime();

    if (!depasse && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `L'escalade automatique n'est possible qu'après ${delaiHeures} h sans réponse ` +
          `(échéance ${echeance.toISOString().slice(0, 16).replace('T', ' ')}).`,
      );
    }

    const miseAJour = await this.prisma.reclamation.update({
      where: { id },
      data: { escaladeLe: new Date() },
      include: RECLAMATION_INCLUDE,
    });
    await this.tracer(user, 'RECLAMATION_ESCALADEE', id,
      `${reclamation.numero} — escaladée (${depasse ? 'délai atteint' : 'forcée manuellement'})`);
    return miseAJour;
  }

  /**
   * Clôture avec note libre (sans changer le statut, qui doit déjà être l'un
   * des trois états terminaux). On consigne l'horodatage de fermeture.
   */
  async cloturer(
    id: string,
    dto: { noteCloture?: string },
    user: AuthUser,
  ) {
    const reclamation = await this.findOne(id);
    if (!STATUTS_CLOS.includes(reclamation.statut)) {
      throw new BadRequestException(
        'Pour clôturer, passez d\'abord la réclamation à l\'état RESOLUE, FERMEE ou REJETEE.',
      );
    }
    const note = dto.noteCloture?.trim();
    if (!note) {
      throw new BadRequestException('Une note de clôture est requise.');
    }

    const stamp = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] CLÔTURE — ${note}`;
    const data: Prisma.ReclamationUpdateInput = {
      notes: reclamation.notes ? `${reclamation.notes}\n${stamp}` : stamp,
      fermeLe: reclamation.fermeLe ?? new Date(),
    };
    const miseAJour = await this.prisma.reclamation.update({
      where: { id },
      data,
      include: RECLAMATION_INCLUDE,
    });
    await this.tracer(user, 'RECLAMATION_CLOTUREE', id, `${reclamation.numero} — note ajoutée`);
    return miseAJour;
  }

  /**
   * Cron manuel : escalade en série toutes les réclamations ouvertes dont le
   * délai est écoulé. Renvoie la liste des réclamations escaladées.
   */
  async cronEscalade(user: AuthUser) {
    const maintenant = Date.now();
    const toutes = await this.prisma.reclamation.findMany({
      where: { statut: { in: STATUTS_OUVERTS }, escaladeLe: null },
      select: { id: true, numero: true, creeLe: true, delaiEscaladeHeures: true },
    });
    const depassees = toutes.filter(
      (r) => maintenant >= r.creeLe.getTime() + (r.delaiEscaladeHeures ?? 48) * 3600 * 1000,
    );
    if (!depassees.length) return { escaladees: 0, numeros: [] };

    await this.prisma.reclamation.updateMany({
      where: { id: { in: depassees.map((r) => r.id) } },
      data: { escaladeLe: new Date() },
    });

    for (const r of depassees) {
      await this.tracer(user, 'RECLAMATION_ESCALADEE', r.id, `${r.numero} — cron`);
    }
    return {
      escaladees: depassees.length,
      numeros: depassees.map((r) => r.numero),
    };
  }

  private async tracer(user: AuthUser, action: string, entiteId: string, details?: string) {
    await this.prisma.auditLog.create({
      data: { userId: user.id, action, entite: 'Reclamation', entiteId, details },
    });
  }
}