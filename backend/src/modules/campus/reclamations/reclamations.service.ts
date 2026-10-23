/**
 * Plateforme de réclamations : guichet unique des doléances étudiantes.
 *
 * Cycle de vie d'une réclamation :
 *  - OUVERT : déclaration, en attente de prise en charge
 *  - EN_COURS : un agent a pris le dossier
 *  - EN_ATTENTE_REPONSE : une réponse a été envoyée à l'étudiant, on attend son retour
 *  - RESOLU / FERME : décision finale, l'étudiant est satisfait
 *  - REJETE : décision finale, la réclamation est rejetée (motif obligatoire)
 *
 * Le délai d'escalade (delaiEscaladeHeures, 48 h par défaut) borne le temps
 * pendant lequel une réclamation peut dormir sans réaction. Une escalade force
 * la main à la direction en datant escaladeLe. La note de clôture (champ libre
 * concaténé aux notes existantes) consigne la décision finale.
 *
 * Une réclamation identifiée reste la propriété de l'étudiant : il voit son
 * historique et peut répondre tant qu'elle n'est pas close. Une référence de
 * création séparée maintient le fil anonyme sans apparaître dans les réponses.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, PrioriteReclamation, Role, StatutReclamation, TypeReclamation } from '@prisma/client';
import { CrudService } from '../../../common/crud.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { SERIES_NUMERO, avecNumeroUnique, millesimeSerie, prochainNumeroSerie } from '../../../common/numero';
import { paginer, pagine } from '../../../common/pagination';
import { journaliser } from '../../../common/audit';

const STATUTS_OUVERTS: StatutReclamation[] = [
  StatutReclamation.OUVERT,
  StatutReclamation.EN_COURS,
  StatutReclamation.EN_ATTENTE_REPONSE,
];

/**
 * Journal d'audit : le vocabulaire des actions est une convention propre,
 * écrite en base et lue par les rapports. Il ne suit pas le renommage des
 * statuts : une action inscrite avant la migration reste lisible après, sans
 * réécriture du journal.
 */
const ACTION_STATUT: Record<StatutReclamation, string> = {
  OUVERT: 'RECLAMATION_OUVERTE',
  EN_COURS: 'RECLAMATION_EN_COURS',
  EN_ATTENTE_REPONSE: 'RECLAMATION_EN_ATTENTE_REPONSE',
  RESOLU: 'RECLAMATION_RESOLUE',
  FERME: 'RECLAMATION_FERMEE',
  REJETE: 'RECLAMATION_REJETEE',
};

const STATUTS_CLOS: StatutReclamation[] = [StatutReclamation.RESOLU, StatutReclamation.FERME, StatutReclamation.REJETE];

const TRANSITIONS_AUTORISEES: Record<StatutReclamation, StatutReclamation[]> = {
  OUVERT: [StatutReclamation.EN_COURS],
  EN_COURS: [
    StatutReclamation.EN_ATTENTE_REPONSE,
    StatutReclamation.RESOLU,
    StatutReclamation.FERME,
    StatutReclamation.REJETE,
  ],
  EN_ATTENTE_REPONSE: [
    StatutReclamation.EN_COURS,
    StatutReclamation.RESOLU,
    StatutReclamation.FERME,
    StatutReclamation.REJETE,
  ],
  RESOLU: [],
  FERME: [],
  REJETE: [],
};

const ROLES_AGENTS: Role[] = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT];

export const RECLAMATION_INCLUDE = {
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true, telephone: true } },
  departement: { select: { id: true, code: true, nom: true } },
  assigneA: { select: { id: true, nom: true, prenom: true, role: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.ReclamationInclude;

const RECLAMATION_DETAIL_INCLUDE = {
  ...RECLAMATION_INCLUDE,
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    include: {
      auteur: { select: { id: true, nom: true, prenom: true, role: true } },
    },
  },
} satisfies Prisma.ReclamationInclude;

const MAX_MESSAGES_PAR_RECLAMATION = 100;

@Injectable()
export class ReclamationsService extends CrudService {
  private readonly logger = new Logger(ReclamationsService.name);

  constructor(prisma: PrismaService) {
    super(prisma, 'reclamation', {
      orderBy: { createdAt: 'desc' },
      include: RECLAMATION_INCLUDE,
      omit: { createurId: true },
      label: 'Réclamation',
    });
  }

  /**
   * Les contrôles d'état et leurs écritures doivent partager un instantané
   * sérialisable. Partagé avec le cron d'escalade : le message passe par t(),
   * qui fonctionne aussi hors requête HTTP.
   */
  private async transactionSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw this.conflitConcurrent();
      }
      throw error;
    }
  }

  private conflitConcurrent() {
    return new ConflictException(t('reclamations.ecriture_concurrente_reessayez'));
  }

  /** Rôles autorisés à voir le registre entier (ADMIN, DIRECTION, SCOLARITE). */
  agents() {
    return this.prisma.user.findMany({
      where: { actif: true, role: { in: [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT] } },
      select: { id: true, nom: true, prenom: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  private voitTout(user: AuthUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.DIRECTION || user.role === Role.SCOLARITE;
  }

  /**
   * Le champ `notes` est le bloc-notes interne de la scolarité : il concatène
   * les commentaires de changement de statut et les notes de clôture, donc les
   * motifs de rejet rédigés « entre nous ». L'étudiant est propriétaire de sa
   * réclamation, pas de la délibération interne : on retire le champ de la
   * projection dès que le demandeur est un étudiant. La référence interne du
   * créateur est toujours omise. `omit` agit côté Prisma.
   */
  private omissionPour(user: AuthUser): Prisma.ReclamationOmit | undefined {
    return { createurId: true, ...(user.role === Role.ETUDIANT ? { notes: true } : {}) };
  }

  /**
   * Projection minimale journalisée avant/après. Une réclamation est un dossier
   * de doléance : son sujet, sa description, ses messages, les notes internes et
   * l'identité de son auteur sont des textes libres et des données personnelles
   * que le journal ne recopie jamais. Il ne retient que la vie du dossier —
   * identification technique, qualification, situation, affectation et
   * horodatages — et la *présence* des contenus sensibles sous forme de
   * booléens. Ni matricule, ni nom, ni téléphone, ni adresse, ni contenu de
   * pièce jointe ; les clés étrangères techniques (agent, département) restent,
   * comme dans les autres modules, pour qu'une affectation soit reconstituable.
   */
  private instantaneAudit(reclamation: any) {
    return {
      id: reclamation.id,
      numero: reclamation.numero,
      type: reclamation.type,
      priorite: reclamation.priorite,
      statut: reclamation.statut,
      anonyme: Boolean(reclamation.anonyme),
      etudiantId: reclamation.etudiantId ?? null,
      departementId: reclamation.departementId ?? null,
      assigneAId: reclamation.assigneAId ?? null,
      assigneARole: reclamation.assigneA?.role ?? null,
      delaiEscaladeHeures: reclamation.delaiEscaladeHeures ?? null,
      escaladeLe: reclamation.escaladeLe ?? null,
      createdAt: reclamation.createdAt ?? null,
      fermeLe: reclamation.fermeLe ?? null,
      nombreMessages: reclamation._count?.messages ?? null,
      // Présence des contenus libres, jamais leur texte. Le bloc-notes interne
      // est omis des réponses adressées à un étudiant : dans ce cas la clé
      // disparaît du journal plutôt que d'y porter un « faux » non.
      sujetFourni: Boolean(reclamation.sujet),
      descriptionFournie: Boolean(reclamation.description),
      noteInterneFournie: 'notes' in reclamation ? Boolean(reclamation.notes) : undefined,
      nomAuteurFourni: Boolean(reclamation.nomAuteur),
      emailAuteurFourni: Boolean(reclamation.emailAuteur),
    };
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
    const pagination = paginer(query);

    const filtreProprietaire: Prisma.ReclamationWhereInput = this.voitTout(user)
      ? {}
      : {
          OR: [{ etudiantId: user.etudiantId ?? '__aucun__' }, { anonyme: true, createurId: user.id }],
        };
    const filtreRecherche: Prisma.ReclamationWhereInput = query.search
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
      : {};

    const where: Prisma.ReclamationWhereInput = {
      ...(query.search ? { AND: [filtreProprietaire, filtreRecherche] } : filtreProprietaire),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.priorite ? { priorite: query.priorite } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
      ...(query.assigneAId ? { assigneAId: query.assigneAId } : {}),
      ...(query.escalade === 'oui' ? { escaladeLe: { not: null } } : {}),
      ...(query.escalade === 'non' ? { escaladeLe: null } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.reclamation.findMany({
        where,
        include: RECLAMATION_INCLUDE,
        omit: this.omissionPour(user),
        orderBy: [{ priorite: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.reclamation.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  /** Variante pour l'étudiant connecté — strictement bornée à ses réclamations. */
  async mesReclamations(
    query: {
      page?: number;
      pageSize?: number;
      all?: string;
      statut?: StatutReclamation;
    },
    user: AuthUser,
  ) {
    if (!user.etudiantId) {
      throw new NotFoundException(t('reclamations.aucun_dossier_etudiant_rattache_a_ce_compte'));
    }
    return this.liste(query, user);
  }

  /**
   * Détail d'une réclamation — l'étudiant ne peut voir que les siennes, et
   * sans le bloc-notes interne (voir `omissionPour`). On requête ici plutôt
   * que via `findOne` du CRUD générique, qui ne sait pas omettre de champ.
   */
  async findOnePour(id: string, user: AuthUser) {
    const reclamation = await this.prisma.reclamation.findFirst({
      where: {
        id,
        ...(this.voitTout(user)
          ? {}
          : {
              OR: [{ etudiantId: user.etudiantId ?? '__aucun__' }, { anonyme: true, createurId: user.id }],
            }),
      },
      include: RECLAMATION_DETAIL_INCLUDE,
      omit: this.omissionPour(user),
    });
    if (!reclamation) {
      throw new NotFoundException(t('reclamations.reclamation_introuvable'));
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
          createdAt: { lt: ilYA48h },
        },
      }),
    ]);

    const comptes: Record<StatutReclamation, number> = {
      OUVERT: 0,
      EN_COURS: 0,
      EN_ATTENTE_REPONSE: 0,
      RESOLU: 0,
      FERME: 0,
      REJETE: 0,
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
    const annee = millesimeSerie(SERIES_NUMERO.RECLAMATION);
    const anonyme = dto.anonyme === true;

    if (user.role === Role.ETUDIANT && !user.etudiantId) {
      throw new NotFoundException(t('reclamations.aucun_dossier_etudiant_rattache_a_ce_compte'));
    }

    // L'anonymat est un choix de confidentialité : aucune fiche étudiante ni
    // compte n'est rattaché au dossier anonyme.
    const etudiantId = anonyme || !user.etudiantId ? null : user.etudiantId;
    const nomAuteur = anonyme
      ? dto.nomAuteur?.trim() || null
      : user.etudiantId
        ? null
        : `${user.prenom} ${user.nom}`.trim();
    const emailAuteur = anonyme ? dto.emailAuteur?.trim() || null : null;

    return avecNumeroUnique(
      () =>
        this.prisma.$transaction(async (tx) => {
          const numero = await prochainNumeroSerie(tx, SERIES_NUMERO.RECLAMATION, annee);
          const reclamation = await tx.reclamation.create({
            data: {
              numero,
              type: dto.type,
              sujet: dto.sujet.trim(),
              description: dto.description.trim(),
              anonyme,
              etudiantId,
              createurId: user.id,
              nomAuteur,
              emailAuteur,
              priorite: dto.priorite ?? PrioriteReclamation.NORMALE,
              statut: StatutReclamation.OUVERT,
              departementId: dto.departementId ?? null,
              messages: {
                create: {
                  auteurId: anonyme || !user.id ? null : user.id,
                  nomAffichage: anonyme ? dto.nomAuteur?.trim() || 'Anonyme' : `${user.prenom} ${user.nom}`.trim(),
                  contenu: dto.description.trim(),
                },
              },
            },
            include: RECLAMATION_INCLUDE,
            omit: { createurId: true },
          });
          await journaliser(tx, anonyme ? null : user, 'RECLAMATION_OUVERTE', 'Reclamation', reclamation.id, {
            avant: null,
            apres: this.instantaneAudit(reclamation),
            champsModifies: ['statut', 'priorite', 'anonyme', 'departementId'],
            premierMessageInclus: true,
          });
          return reclamation;
        }),
      {
        tentatives: 10,
        colonnes: ['numero'],
        erreur: () =>
          new ConflictException(t('reclamations.numero_de_reclamation_temporairement_indisponible_reessayez')),
      },
    );
  }

  /**
   * Ajout d'un message à une réclamation. L'étudiant ne peut poster que sur
   * ses propres réclamations, et uniquement tant qu'elles ne sont pas closes.
   */
  async posterMessage(id: string, dto: { contenu: string; joint?: string }, user: AuthUser) {
    const contenu = dto.contenu.trim();
    if (!contenu) {
      throw new BadRequestException(t('reclamations.le_message_est_vide'));
    }
    return this.transactionSerializable(async (tx) => {
      const reclamation = await tx.reclamation.findFirst({
        where: {
          id,
          ...(this.voitTout(user)
            ? {}
            : { OR: [{ etudiantId: user.etudiantId ?? '__aucun__' }, { anonyme: true, createurId: user.id }] }),
        },
        include: RECLAMATION_INCLUDE,
        omit: this.omissionPour(user),
      });
      if (!reclamation) throw new NotFoundException(t('reclamations.reclamation_introuvable'));
      if (STATUTS_CLOS.includes(reclamation.statut)) {
        throw new BadRequestException(t('reclamations.cette_reclamation_est_close_aucun_message_supplement'));
      }
      const nombreMessages = await tx.messageReclamation.count({ where: { reclamationId: id } });
      if (nombreMessages >= MAX_MESSAGES_PAR_RECLAMATION) {
        throw new BadRequestException(t('reclamations.limite_messages_atteinte'));
      }
      const cree = await tx.messageReclamation.create({
        data: {
          reclamationId: id,
          auteurId: reclamation.anonyme && user.role === Role.ETUDIANT ? null : user.id,
          nomAffichage:
            reclamation.anonyme && user.role === Role.ETUDIANT ? 'Anonyme' : `${user.prenom} ${user.nom}`.trim(),
          contenu,
          joint: dto.joint ?? null,
        },
        include: {
          auteur: { select: { id: true, nom: true, prenom: true, role: true } },
        },
      });

      await journaliser(
        tx,
        reclamation.anonyme && user.role === Role.ETUDIANT ? null : user,
        'RECLAMATION_MESSAGE',
        'Reclamation',
        id,
        {
          avant: this.instantaneAudit(reclamation),
          apres: this.instantaneAudit({ ...reclamation, _count: { messages: nombreMessages + 1 } }),
          champsModifies: ['messages'],
          // Ni le texte du message ni sa pièce jointe ne sortent d'ici.
          message: {
            id: cree.id,
            auteurId: cree.auteurId ?? null,
            auteurRole: cree.auteur?.role ?? null,
            auteurAnonyme: cree.auteurId === null,
            createdAt: cree.createdAt ?? null,
            contenuFourni: Boolean(contenu),
            pieceJointeFournie: Boolean(dto.joint),
          },
        },
      );
      return cree;
    });
  }

  /** Changement de statut (ADMIN, DIRECTION, SCOLARITE). */
  async changerStatut(id: string, dto: { statut: StatutReclamation; commentaire?: string }, user: AuthUser) {
    if (STATUTS_CLOS.includes(dto.statut) && !dto.commentaire?.trim()) {
      throw new BadRequestException(t('reclamations.une_note_est_obligatoire_pour_clore_resoudre_fermer_ou_rejet'));
    }

    return this.transactionSerializable(async (tx) => {
      const reclamation = await tx.reclamation.findUnique({
        where: { id },
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      if (!reclamation) throw new NotFoundException(t('reclamations.reclamation_introuvable'));
      if (!TRANSITIONS_AUTORISEES[reclamation.statut].includes(dto.statut)) {
        throw new BadRequestException(t('reclamations.transition_de_statut_non_autorisee'));
      }
      const data: Prisma.ReclamationUpdateInput = { statut: dto.statut };
      if (dto.commentaire?.trim()) {
        const stamp = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] ${dto.commentaire.trim()}`;
        data.notes = reclamation.notes ? `${reclamation.notes}\n${stamp}` : stamp;
      }
      if (STATUTS_CLOS.includes(dto.statut)) data.fermeLe = new Date();
      const miseAJour = await tx.reclamation.update({
        where: { id, statut: reclamation.statut },
        data,
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      await journaliser(tx, user, ACTION_STATUT[dto.statut], 'Reclamation', id, {
        avant: this.instantaneAudit(reclamation),
        apres: this.instantaneAudit(miseAJour),
        champsModifies: ['statut', ...(dto.commentaire?.trim() ? ['notes'] : []), ...(data.fermeLe ? ['fermeLe'] : [])],
        // Le commentaire de transition et le motif de rejet sont des textes
        // libres : seule leur présence est journalisée.
        commentaireFourni: Boolean(dto.commentaire?.trim()),
      });
      return miseAJour;
    });
  }

  /** Assignation d'un agent à la réclamation. */
  async assigner(id: string, dto: { assigneAId: string }, user: AuthUser) {
    return this.transactionSerializable(async (tx) => {
      const reclamation = await tx.reclamation.findUnique({
        where: { id },
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      if (!reclamation) throw new NotFoundException(t('reclamations.reclamation_introuvable'));
      if (STATUTS_CLOS.includes(reclamation.statut))
        throw new BadRequestException(t('reclamations.reclamation_close_assignation_impossible'));
      const assigne = await tx.user.findFirst({
        where: { id: dto.assigneAId, actif: true, role: { in: ROLES_AGENTS } },
        select: { id: true, nom: true, prenom: true },
      });
      if (!assigne) throw new NotFoundException(t('reclamations.utilisateur_introuvable'));
      const data: Prisma.ReclamationUpdateInput = {
        assigneA: { connect: { id: dto.assigneAId } },
        statut: reclamation.statut === StatutReclamation.OUVERT ? StatutReclamation.EN_COURS : reclamation.statut,
      };
      const miseAJour = await tx.reclamation.update({
        where: { id, statut: reclamation.statut },
        data,
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      await journaliser(tx, user, 'RECLAMATION_ASSIGNEE', 'Reclamation', id, {
        avant: this.instantaneAudit(reclamation),
        apres: this.instantaneAudit(miseAJour),
        champsModifies: ['assigneAId', ...(miseAJour.statut !== reclamation.statut ? ['statut'] : [])],
        // L'agent pressenti est désigné par son identifiant et son rôle, pas par
        // son nom : le journal n'a pas à recopier l'identité de l'agent.
        assigneAId: dto.assigneAId,
        assigneARole: miseAJour.assigneA?.role ?? null,
        priseEnCharge: miseAJour.statut !== reclamation.statut,
      });
      return miseAJour;
    });
  }

  /**
   * Escalade forcée : la direction date escaladeLe = now(). Le contrôle est
   * partagé : escalader une réclamation exige que le délai configuré soit
   * effectivement dépassé — sauf si l'utilisateur est ADMIN (droit de
   * forçage manuel pour les urgences vraies).
   */
  async escalader(id: string, user: AuthUser) {
    return this.transactionSerializable(async (tx) => {
      const reclamation = await tx.reclamation.findUnique({
        where: { id },
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      if (!reclamation) throw new NotFoundException(t('reclamations.reclamation_introuvable'));
      if (STATUTS_CLOS.includes(reclamation.statut))
        throw new BadRequestException(t('reclamations.cette_reclamation_est_close_escalader_n_a_plus_de_sens'));
      const delaiHeures = reclamation.delaiEscaladeHeures ?? 48;
      const echeance = new Date(reclamation.createdAt.getTime() + delaiHeures * 3600 * 1000);
      const depasse = Date.now() >= echeance.getTime();
      if (reclamation.escaladeLe) throw this.conflitConcurrent();
      if (!depasse && user.role !== Role.ADMIN) {
        throw new ForbiddenException(
          t('reclamations.l_escalade_automatique_n_est_possible_qu_apres_delaiheures', { delaiHeures }),
        );
      }
      const miseAJour = await tx.reclamation.update({
        where: { id, statut: reclamation.statut, escaladeLe: null },
        data: { escaladeLe: new Date() },
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      await journaliser(tx, user, 'RECLAMATION_ESCALADEE', 'Reclamation', id, {
        avant: this.instantaneAudit(reclamation),
        apres: this.instantaneAudit(miseAJour),
        champsModifies: ['escaladeLe'],
        delaiAtteint: depasse,
        delaiEscaladeHeures: delaiHeures,
        // Le forçage manuel par l'ADMIN reste visible : c'est la seule
        // escalade qui ne suit pas le délai configuré.
        forcee: !depasse,
      });
      return miseAJour;
    });
  }

  /**
   * Clôture avec note libre (sans changer le statut, qui doit déjà être l'un
   * des trois états terminaux). On consigne l'horodatage de fermeture.
   */
  async cloturer(id: string, dto: { noteCloture?: string }, user: AuthUser) {
    const note = dto.noteCloture?.trim();
    if (!note) {
      throw new BadRequestException(t('reclamations.une_note_de_cloture_est_requise'));
    }

    return this.transactionSerializable(async (tx) => {
      const reclamation = await tx.reclamation.findUnique({
        where: { id },
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      if (!reclamation) throw new NotFoundException(t('reclamations.reclamation_introuvable'));
      if (!STATUTS_CLOS.includes(reclamation.statut)) {
        throw new BadRequestException(t('reclamations.pour_cloturer_passez_d_abord_la_reclamation_a_l_etat'));
      }
      const stamp = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${user.prenom} ${user.nom}] CLÔTURE — ${note}`;
      const data: Prisma.ReclamationUpdateInput = {
        notes: reclamation.notes ? `${reclamation.notes}\n${stamp}` : stamp,
        fermeLe: reclamation.fermeLe ?? new Date(),
      };
      const miseAJour = await tx.reclamation.update({
        where: { id, statut: reclamation.statut },
        data,
        include: RECLAMATION_INCLUDE,
        omit: { createurId: true },
      });
      await journaliser(tx, user, 'RECLAMATION_CLOTUREE', 'Reclamation', id, {
        avant: this.instantaneAudit(reclamation),
        apres: this.instantaneAudit(miseAJour),
        champsModifies: ['notes', ...(reclamation.fermeLe ? [] : ['fermeLe'])],
        // La note de clôture est la décision finale rédigée : sa présence est
        // journalisée, jamais son texte.
        noteClotureFournie: true,
      });
      return miseAJour;
    });
  }

  /**
   * Escalade en série de toutes les réclamations ouvertes dont le délai est
   * écoulé. Déclenchée chaque heure par `escaladerReclamationsEchues` (sans
   * utilisateur) ou à la main par un ADMIN via POST /reclamations/cron/escalade.
   * Renvoie la liste des réclamations escaladées.
   */
  async cronEscalade(user: AuthUser | null) {
    const maintenant = Date.now();
    const toutes = await this.prisma.reclamation.findMany({
      where: { statut: { in: STATUTS_OUVERTS }, escaladeLe: null },
      // La projection porte de quoi journaliser l'escalade (situation avant,
      // horodatage après) sans rien charger des textes ni des coordonnées.
      select: {
        id: true,
        numero: true,
        createdAt: true,
        delaiEscaladeHeures: true,
        type: true,
        priorite: true,
        statut: true,
        anonyme: true,
        escaladeLe: true,
      },
    });
    const depassees = toutes.filter(
      (r) => maintenant >= r.createdAt.getTime() + (r.delaiEscaladeHeures ?? 48) * 3600 * 1000,
    );
    if (!depassees.length) return { escaladees: 0, numeros: [] };

    const escalateLe = new Date();
    const escaladees: typeof depassees = [];
    await this.transactionSerializable(async (tx) => {
      for (const r of depassees) {
        const resultat = await tx.reclamation.updateMany({
          where: { id: r.id, statut: { in: STATUTS_OUVERTS }, escaladeLe: null },
          data: { escaladeLe: escalateLe },
        });
        if (resultat.count !== 1) continue;
        escaladees.push(r);
        await journaliser(tx, user, 'RECLAMATION_ESCALADEE', 'Reclamation', r.id, {
          avant: this.instantaneAudit(r),
          apres: this.instantaneAudit({ ...r, escaladeLe: escalateLe }),
          champsModifies: ['escaladeLe'],
          delaiAtteint: true,
          delaiEscaladeHeures: r.delaiEscaladeHeures ?? 48,
          forcee: false,
          // L'escalade automatique est un traitement de fond : elle est
          // attribuée au compte qui l'a lancée à la main, à aucun compte
          // quand c'est la tâche planifiée.
          origine: 'CRON',
        });
      }
    });
    return {
      escaladees: escaladees.length,
      numeros: escaladees.map((r) => r.numero),
    };
  }

  /**
   * Chaque heure : escalade des réclamations dont le délai est dépassé. Le
   * délai se compte en heures (48 h par défaut), une passe horaire suffit à
   * ne jamais laisser une échéance dormir plus d'une heure. Hors requête
   * HTTP, il n'y a ni utilisateur ni contexte i18n : le journal d'audit porte
   * userId null (comme la clôture nocturne des séances) et une erreur est
   * consignée sans remonter, la passe suivante reprenant les mêmes dossiers.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async escaladerReclamationsEchues() {
    try {
      const resultat = await this.cronEscalade(null);
      if (resultat.escaladees) {
        this.logger.log(
          `${resultat.escaladees} réclamation(s) escaladée(s) automatiquement : ${resultat.numeros.join(', ')}`,
        );
      }
      return resultat;
    } catch (error: unknown) {
      this.logger.error(
        `Escalade automatique des réclamations interrompue : ${(error as Error | null)?.message ?? error}`,
      );
      return null;
    }
  }
}
