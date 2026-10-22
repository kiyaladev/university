/** Scolarité LMD — évaluations, notes et délibérations du jury.
 *
 *  Le calcul des moyennes et des décisions vit dans calcul.service.ts
 *  (règles pilotées, testables) ; ce service ne fait que lire/écrire Prisma
 *  et orchestrer les vérifications d'état (évaluations clôturées, jury
 *  validé…).
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DecisionJury,
  Prisma,
  SessionDeliberation,
  StatutDeliberation,
  StatutEvaluation,
  TypeEvaluation,
} from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { I18nContext } from 'nestjs-i18n';
import { Paginated } from '../../common/dto';
import { pct, toDateOnly } from '../../common/utils';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from '../../common/annee';
import { PrismaService } from '../../prisma/prisma.service';
import { classer, decider, moyenneUe, type ResultatEtudiant } from './calcul.service';
import {
  CreateDeliberationDto,
  CreateEvaluationDto,
  DeliberationQueryDto,
  EvaluationQueryDto,
  NoteQueryDto,
  SaisieNotesDto,
  UpdateEvaluationDto,
} from './scolarite.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';
import { filtreDepartement } from '../../common/perimetre';

/** Inscrits « présents aux fichiers » : les dossiers validés par la scolarité. */
const INSCRITS_VALIDES = { statut: 'VALIDEE' } as const;

type Db = PrismaService | Prisma.TransactionClient;

interface Candidat {
  inscriptionId: string;
  nom: string;
  prenom: string;
}

@Injectable()
export class ScolariteService {
  constructor(private readonly prisma: PrismaService) {}

  private promotionAutorisee(user: AuthUser) {
    return filtreDepartement(user, 'promotion.filiere', '__aucun_departement__');
  }

  // ----------------------------------------------------------- Évaluations

  async listerEvaluations(query: EvaluationQueryDto, user: AuthUser): Promise<Paginated<any>> {
    const pagination = paginer(query);

    const where: Prisma.EvaluationWhereInput = {
      ...this.promotionAutorisee(user),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.matiereId ? { matiereId: query.matiereId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.evaluation.findMany({
        where,
        include: {
          matiere: true,
          promotion: { include: { filiere: true } },
          annee: true,
          _count: { select: { notes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.evaluation.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  private veillerEvaluation(id: string, db: Db = this.prisma) {
    return db.evaluation.findUnique({
      where: { id },
      include: {
        matiere: true,
        promotion: { include: { filiere: true } },
        annee: true,
        _count: { select: { notes: true } },
      },
    });
  }

  async findEvaluation(id: string) {
    const evaluation = await this.veillerEvaluation(id);
    if (!evaluation) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
    return evaluation;
  }

  private instantaneEvaluation(evaluation: any) {
    if (!evaluation) return null;
    return {
      id: evaluation.id,
      intitule: evaluation.intitule,
      type: evaluation.type,
      coefficient: evaluation.coefficient,
      matiereId: evaluation.matiereId,
      anneeId: evaluation.anneeId,
      promotionId: evaluation.promotionId,
      semestre: evaluation.semestre,
      date: evaluation.date,
      statut: evaluation.statut,
    };
  }

  async creerEvaluation(dto: CreateEvaluationDto, user: AuthUser) {
    const [matiere, annee, promotion] = await Promise.all([
      this.prisma.matiere.findUnique({ where: { id: dto.matiereId } }),
      this.prisma.anneeAcademique.findUnique({ where: { id: dto.anneeId } }),
      this.prisma.promotion.findUnique({ where: { id: dto.promotionId } }),
    ]);
    if (!matiere) throw new NotFoundException(I18nContext.current()!.t('scolarite.matiere_introuvable'));
    if (!annee) throw new NotFoundException(I18nContext.current()!.t('scolarite.annee_academique_introuvable'));
    await exigerAnneeOuverte(this.prisma, dto.anneeId);
    if (!promotion) throw new NotFoundException(I18nContext.current()!.t('scolarite.promotion_introuvable'));

    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId, dto.anneeId);
      const evaluation = await tx.evaluation.create({
        data: {
          intitule: dto.intitule,
          type: dto.type,
          coefficient: dto.coefficient ?? 1,
          matiereId: dto.matiereId,
          anneeId: dto.anneeId,
          promotionId: dto.promotionId,
          semestre: dto.semestre ?? 1,
          date: dto.date ? toDateOnly(dto.date) : null,
        },
        include: {
          matiere: true,
          promotion: true,
          annee: true,
          _count: { select: { notes: true } },
        },
      });
      await journaliser(
        tx,
        user,
        'EVALUATION_CREEE',
        'Evaluation',
        evaluation.id,
        { avant: null, apres: this.instantaneEvaluation(evaluation) },
      );
      return evaluation;
    });
  }

  async modifierEvaluation(id: string, dto: UpdateEvaluationDto, user: AuthUser) {
    const existante = await this.veillerEvaluation(id);
    if (!existante) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
    await exigerAnneeOuverte(this.prisma, existante.anneeId);
    if (dto.anneeId !== undefined) await exigerAnneeOuverte(this.prisma, dto.anneeId);
    if (existante.statut === StatutEvaluation.CLOTUREE) {
      throw new BadRequestException(I18nContext.current()!.t('scolarite.l_evaluation_existante_intitule_est_cloturee_ses_notes_sont_fig', { args: { intitule: existante.intitule } }));
    }
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.evaluation.findUnique({
        where: { id }, include: { matiere: true, promotion: true, annee: true, _count: { select: { notes: true } } },
      });
      if (!avant) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
      await exigerAnneeOuverte(tx, avant.anneeId);
      if (avant.statut === StatutEvaluation.CLOTUREE) {
        throw new BadRequestException(I18nContext.current()!.t('scolarite.l_evaluation_existante_intitule_est_cloturee_ses_notes_sont_fig', { args: { intitule: avant.intitule } }));
      }
      if (dto.anneeId !== undefined) await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId ?? avant.promotionId, dto.anneeId ?? avant.anneeId);
      const maj = await tx.evaluation.update({
        where: { id },
        data: {
          ...(dto.intitule !== undefined ? { intitule: dto.intitule } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.coefficient !== undefined ? { coefficient: dto.coefficient } : {}),
          ...(dto.matiereId !== undefined ? { matiereId: dto.matiereId } : {}),
          ...(dto.anneeId !== undefined ? { anneeId: dto.anneeId } : {}),
          ...(dto.promotionId !== undefined ? { promotionId: dto.promotionId } : {}),
          ...(dto.semestre !== undefined ? { semestre: dto.semestre } : {}),
          ...(dto.date !== undefined ? { date: dto.date ? toDateOnly(dto.date) : null } : {}),
        },
        include: {
          matiere: true,
          promotion: true,
          annee: true,
          _count: { select: { notes: true } },
        },
      });
      await journaliser(
        tx,
        user,
        'EVALUATION_MODIFIEE',
        'Evaluation',
        id,
        { avant: this.instantaneEvaluation(avant), apres: this.instantaneEvaluation(maj) },
      );
      return maj;
    });
  }

  async supprimerEvaluation(id: string, user: AuthUser) {
    const existante = await this.veillerEvaluation(id);
    if (!existante) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
    await exigerAnneeOuverte(this.prisma, existante.anneeId);
    if (existante._count.notes > 0) {
      throw new BadRequestException(I18nContext.current()!.t('scolarite.impossible_de_supprimer_existante_intitule_des_notes_y_sont_de', { args: { intitule: existante.intitule, nombre: existante._count.notes } }));
    }
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.evaluation.findUnique({
        where: { id }, include: { _count: { select: { notes: true } } },
      });
      if (!avant) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
      await exigerAnneeOuverte(tx, avant.anneeId);
      if (avant._count.notes > 0) {
        throw new BadRequestException(I18nContext.current()!.t('scolarite.impossible_de_supprimer_existante_intitule_des_notes_y_sont_de', { args: { intitule: avant.intitule, nombre: avant._count.notes } }));
      }
      await tx.evaluation.delete({ where: { id } });
      await journaliser(tx, user, 'EVALUATION_SUPPRIMEE', 'Evaluation', id, { avant: this.instantaneEvaluation(avant), apres: null });
      return { id };
    });
  }

  async cloturerEvaluation(id: string, user: AuthUser) {
    const existante = await this.veillerEvaluation(id);
    if (!existante) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
    await exigerAnneeOuverte(this.prisma, existante.anneeId);
    if (existante.statut === StatutEvaluation.CLOTUREE) {
      throw new BadRequestException(I18nContext.current()!.t('scolarite.l_evaluation_existante_intitule_est_deja_cloturee', { args: { 'existante.intitule': existante.intitule } }));
    }
    return this.prisma.$transaction(async (tx) => {
      const avant: any = await tx.evaluation.findUnique({
        where: { id }, include: { matiere: true, promotion: true, annee: true, _count: { select: { notes: true } } },
      });
      if (!avant) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
      await exigerAnneeOuverte(tx, avant.anneeId);
      if (avant.statut === StatutEvaluation.CLOTUREE) {
        throw new BadRequestException(I18nContext.current()!.t('scolarite.l_evaluation_existante_intitule_est_deja_cloturee', { args: { 'existante.intitule': avant.intitule } }));
      }
      const maj = await tx.evaluation.update({
        where: { id },
        data: { statut: StatutEvaluation.CLOTUREE },
        include: {
          matiere: true,
          promotion: true,
          annee: true,
          _count: { select: { notes: true } },
        },
      });
      await journaliser(
        tx,
        user,
        'EVALUATION_CLOTUREE',
        'Evaluation',
        id,
        { avant: this.instantaneEvaluation(avant), apres: this.instantaneEvaluation(maj) },
      );
      return maj;
    });
  }

  // ----------------------------------------------------------------- Notes

  /** Feuille de notes d'une évaluation : les inscrits de la promotion, leur
   *  note éventuelle et le badge « manquante » pour les saisies absentes. */
  async feuilleEvaluation(id: string) {
    const evaluation = await this.veillerEvaluation(id);
    if (!evaluation) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));

    const inscriptions = await this.prisma.inscription.findMany({
      where: { promotionId: evaluation.promotionId, anneeId: evaluation.anneeId, ...INSCRITS_VALIDES },
      orderBy: [{ etudiant: { nom: 'asc' } }, { etudiant: { prenom: 'asc' } }],
      include: { etudiant: { select: { nom: true, prenom: true, matricule: true } } },
    });
    const notes = await this.prisma.note.findMany({
      where: { evaluationId: id, inscriptionId: { in: inscriptions.map((i) => i.id) } },
    });
    const parInscription = new Map(notes.map((n) => [n.inscriptionId, n]));

    return {
      evaluation,
      lignes: inscriptions.map((i) => {
        const n = parInscription.get(i.id);
        return {
          inscriptionId: i.id,
          numero: i.numero,
          matricule: i.etudiant.matricule,
          nom: i.etudiant.nom,
          prenom: i.etudiant.prenom,
          note: n?.note ?? null,
          present: n?.present ?? true,
          manquante: !n || (n.note === null && n.present),
        };
      }),
    };
  }

  async listerNotes(query: NoteQueryDto, user: AuthUser): Promise<Paginated<any>> {
    const pagination = paginer(query);
    const where: Prisma.NoteWhereInput = {
      ...(query.evaluationId ? { evaluationId: query.evaluationId } : {}),
      ...filtreDepartement(user, 'evaluation.promotion.filiere', '__aucun_departement__'),
    };

    const [data, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        include: {
          evaluation: { include: { matiere: true } },
          inscription: {
            include: {
              etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
              promotion: true,
            },
          },
        },
        orderBy: { saisieLe: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.note.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  /** Saisie en bloc (bulk upsert, transaction). Les lignes hors contexte
   *  (inscrit d'une autre promotion/année, note hors bornes) sont ignorées
   *  et comptabilisées dans `ignorees`. */
  async saisirNotes(dto: SaisieNotesDto, saisiePar: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const evaluation = await tx.evaluation.findFirst({
        where: { id: dto.evaluationId, ...this.promotionAutorisee(saisiePar) },
      });
      if (!evaluation) throw new NotFoundException(I18nContext.current()!.t('scolarite.evaluation_introuvable'));
      await exigerAnneeOuverte(tx, evaluation.anneeId);
      if (evaluation.statut === StatutEvaluation.CLOTUREE) {
        throw new BadRequestException(I18nContext.current()!.t('scolarite.l_evaluation_evaluation_intitule_est_cloturee_la_saisie_des_notes', { args: { intitule: evaluation.intitule } }));
      }

      const inscrits = await tx.inscription.findMany({
        where: { promotionId: evaluation.promotionId, anneeId: evaluation.anneeId, ...INSCRITS_VALIDES },
        select: { id: true },
      });
      const dansLaPromotion = new Set(inscrits.map((i) => i.id));
      const valides = dto.notes.filter((n) =>
        dansLaPromotion.has(n.inscriptionId) && ((n.note ?? null) === null || (n.note! >= 0 && n.note! <= 20)),
      );
      const ignorees = dto.notes.length - valides.length;
      const precedentes = valides.length
        ? await tx.note.findMany({
            where: { evaluationId: dto.evaluationId, inscriptionId: { in: valides.map((n) => n.inscriptionId) } },
            select: { inscriptionId: true, note: true, present: true },
          })
        : [];
      const parInscription = new Map(precedentes.map((note) => [note.inscriptionId, note]));

      for (const n of valides) {
        await tx.note.upsert({
          where: { evaluationId_inscriptionId: { evaluationId: dto.evaluationId, inscriptionId: n.inscriptionId } },
          create: {
            evaluationId: dto.evaluationId,
            inscriptionId: n.inscriptionId,
            note: n.note ?? null,
            present: n.present ?? true,
            saisieParId: saisiePar.id,
          },
          update: { note: n.note ?? null, present: n.present ?? true, saisieParId: saisiePar.id },
        });
      }

      if (valides.length) {
        await journaliser(
          tx,
          saisiePar,
          'NOTES_SAISIES',
          'Evaluation',
          dto.evaluationId,
          {
              acteur: saisiePar.id,
              changements: valides.map((note) => {
                const precedent = parInscription.get(note.inscriptionId);
                return {
                  inscriptionId: note.inscriptionId,
                  avant: precedent ? { note: precedent.note, present: precedent.present } : null,
                  apres: { note: note.note ?? null, present: note.present ?? true },
                };
              }),
            },
        );
      }
      return { n: valides.length, ignorees };
    });
  }

  // -------------------------------------------------------- Délibérations

  async listerDeliberations(query: DeliberationQueryDto, user: AuthUser): Promise<Paginated<any>> {
    const pagination = paginer(query);
    const where = { ...(query.anneeId ? { anneeId: query.anneeId } : {}), ...this.promotionAutorisee(user) };

    const [data, total] = await Promise.all([
      this.prisma.deliberation.findMany({
        where,
        include: {
          annee: true,
          promotion: { include: { filiere: true } },
          creePar: { select: { id: true, nom: true, prenom: true } },
          valideePar: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true } },
        },
        orderBy: { creeLe: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.deliberation.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  /** Détail d'une délibération, lignes réordonnées par rang. */
  async detailDeliberation(id: string, db: Db = this.prisma) {
    const delib = await db.deliberation.findUnique({
      where: { id },
      include: {
        annee: true,
        promotion: { include: { filiere: true } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        valideePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            inscription: {
              include: { etudiant: { select: { nom: true, prenom: true, matricule: true } } },
            },
          },
        },
      },
    });
    if (!delib) throw new NotFoundException(I18nContext.current()!.t('scolarite.deliberation_introuvable'));
    const lignes = [...delib.lignes].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));
    return { ...delib, lignes };
  }

  /** Nouvelle délibération (BROUILLON) : lignes catégorisées et calculées
   *  d'emblée (session rattrapage : uniquement les AJOURNÉ de la normale). */
  async creerDeliberation(dto: CreateDeliberationDto, creePar: AuthUser) {
    const session: SessionDeliberation = dto.session ?? SessionDeliberation.NORMALE;
    await exigerAnneeOuverte(this.prisma, dto.anneeId);

    const existante = await this.prisma.deliberation.findUnique({
      where: {
        anneeId_promotionId_session: {
          anneeId: dto.anneeId,
          promotionId: dto.promotionId,
          session,
        },
      },
    });
    if (existante) {
      throw new ConflictException(
        I18nContext.current()!.t(session === SessionDeliberation.NORMALE
          ? 'scolarite.une_deliberation_de_session_normale_existe_deja_pour_cette_p'
          : 'scolarite.une_deliberation_de_rattrapage_existe_deja_pour_cette_promot'),
      );
    }

    const [annee, promotion] = await Promise.all([
      this.prisma.anneeAcademique.findUnique({ where: { id: dto.anneeId } }),
      this.prisma.promotion.findUnique({ where: { id: dto.promotionId } }),
    ]);
    if (!annee) throw new NotFoundException(I18nContext.current()!.t('scolarite.annee_academique_introuvable'));
    await exigerAnneeOuverte(this.prisma, annee.id);
    if (!promotion) throw new NotFoundException(I18nContext.current()!.t('scolarite.promotion_introuvable'));

    const delib = await this.prisma.$transaction(async (tx) => {
      await exigerPromotionMemeAnnee(tx, dto.promotionId, dto.anneeId);
      // Prendre le verrou avant la première écriture afin qu’une clôture
      // concurrente ne puisse pas s’intercaler entre la création et la garde.
      await exigerAnneeOuverte(tx, dto.anneeId);
      const cree = await tx.deliberation.create({
        data: {
          anneeId: dto.anneeId,
          promotionId: dto.promotionId,
          session,
          creeParId: creePar.id,
        },
      });
      const calcul = await this.calculerDeliberation(cree.id, tx);
      await journaliser(
        tx,
        creePar,
        'DELIBERATION_CREEE',
        'Deliberation',
        cree.id,
        { anneeId: cree.anneeId, promotionId: cree.promotionId, resultat: calcul },
      );
      return this.detailDeliberation(cree.id, tx);
    });
    return delib;
  }

  /** Recalcule moyennes, décisions, rangs et taux de réussite. Bloqué dès
   *  que le jury a validé. */
  async calculerDeliberation(deliberationId: string, db?: Db, user?: AuthUser) {
    if (!db) {
      return this.prisma.$transaction(async (tx) => this.calculerDeliberation(deliberationId, tx, user));
    }
    let delib = await db.deliberation.findUnique({
      where: { id: deliberationId },
      include: { annee: true, promotion: true },
    });
    if (!delib) throw new NotFoundException(I18nContext.current()!.t('scolarite.deliberation_introuvable'));
    await exigerAnneeOuverte(db, delib.anneeId);
    await db.$queryRaw`SELECT id FROM "Deliberation" WHERE id = ${deliberationId} FOR UPDATE`;
    delib = await db.deliberation.findUnique({ where: { id: deliberationId }, include: { annee: true, promotion: true } });
    if (!delib) throw new NotFoundException(I18nContext.current()!.t('scolarite.deliberation_introuvable'));
    if (delib.statut === StatutDeliberation.VALIDEE) {
      throw new BadRequestException(I18nContext.current()!.t('scolarite.deliberation_validee_par_le_jury_tout_recalcul_est_bloque'));
    }
    const resultat = await this.calculerInternes(delib, db);
    if (user) {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELIBERATION_RECALCULEE',
          entite: 'Deliberation',
          entiteId: deliberationId,
          details: JSON.stringify(resultat),
        },
      });
    }
    return resultat;
  }

  /** Le jury (ADMIN|DIRECTION) valide : BROUILLON → VALIDEE, tout est figé. */
  async validerDeliberation(deliberationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      let delib = await tx.deliberation.findUnique({ where: { id: deliberationId }, include: { annee: true } });
      if (!delib) throw new NotFoundException(I18nContext.current()!.t('scolarite.deliberation_introuvable'));
      await exigerAnneeOuverte(tx, delib.anneeId);
      await tx.$queryRaw`SELECT id FROM "Deliberation" WHERE id = ${deliberationId} FOR UPDATE`;
      delib = await tx.deliberation.findUnique({ where: { id: deliberationId }, include: { annee: true } });
      if (!delib) throw new NotFoundException(I18nContext.current()!.t('scolarite.deliberation_introuvable'));
      if (delib.statut === StatutDeliberation.VALIDEE) {
        const le = delib.valideeLe?.toLocaleDateString('fr-FR');
        throw new BadRequestException(
          I18nContext.current()!.t(le ? 'scolarite.cette_deliberation_a_deja_ete_validee_par_le_jury_le_le' : 'scolarite.cette_deliberation_est_deja_validee', le ? { args: { le } } : undefined),
        );
      }
      const miseAJour = await tx.deliberation.update({
        where: { id: deliberationId },
        data: { statut: StatutDeliberation.VALIDEE, valideeParId: userId, valideeLe: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELIBERATION_VALIDEE',
          entite: 'Deliberation',
          entiteId: deliberationId,
          details: JSON.stringify({
            avant: { statut: delib.statut, tauxReussite: delib.tauxReussite ?? null },
            apres: { statut: miseAJour.statut, tauxReussite: miseAJour.tauxReussite ?? null },
          }),
        },
      });
      return miseAJour;
    });
  }

  // ---------------------------------------------------------- Calcul (pré)

  /** Étudiants du jury : inscrits validés (normale) ; AJOURNÉ de la session
   *  normale (rattrapage). */
  private async candidatsDeliberation(delib: any, tx: Db): Promise<Candidat[]> {
    if (delib.session === SessionDeliberation.RATTRAPAGE) {
      const normale = await tx.deliberation.findFirst({
        where: {
          anneeId: delib.anneeId,
          promotionId: delib.promotionId,
          session: SessionDeliberation.NORMALE,
        },
      });
      if (!normale) {
        throw new BadRequestException(I18nContext.current()!.t('scolarite.la_deliberation_de_la_session_normale_doit_d_abord_exister'));
      }
      const lignes = await tx.deliberationLigne.findMany({
        where: { deliberationId: normale.id, decision: DecisionJury.AJOURNE },
        include: {
          inscription: {
            include: { etudiant: { select: { nom: true, prenom: true, matricule: true } } },
          },
        },
      });
      return lignes.map((l) => ({
        inscriptionId: l.inscriptionId,
        nom: l.inscription.etudiant.nom,
        prenom: l.inscription.etudiant.prenom,
      }));
    }
    const inscriptions = await tx.inscription.findMany({
      where: { promotionId: delib.promotionId, anneeId: delib.anneeId, ...INSCRITS_VALIDES },
      include: { etudiant: { select: { nom: true, prenom: true, matricule: true } } },
    });
    return inscriptions.map((i) => ({
      inscriptionId: i.id,
      nom: i.etudiant.nom,
      prenom: i.etudiant.prenom,
    }));
  }

  /** Matières d'un étudiant avec leurs épreuves — sert au calcul ET au
   *  bulletin. En session normale, les épreuves de rattrapage ne comptent
   *  pas encore ; en session de rattrapage, toutes entrent. */
  private async matieresDuEtudiant(delib: any, inscriptionId: string, tx: Db) {
    const evaluations = await tx.evaluation.findMany({
      where: {
        promotionId: delib.promotionId,
        anneeId: delib.anneeId,
        ...(delib.session === SessionDeliberation.NORMALE
          ? { type: { not: TypeEvaluation.RATTRAPAGE } }
          : {}),
      },
      include: {
        matiere: true,
        notes: { where: { inscriptionId } },
      },
    });

    const parMatiere = new Map<string, any[]>();
    for (const e of evaluations) {
      const liste = parMatiere.get(e.matiereId) ?? [];
      liste.push(e);
      parMatiere.set(e.matiereId, liste);
    }

    return [...parMatiere.entries()].map(([matiereId, evals]) => {
      const matiere = evals[0].matiere;
      const epreuves = evals.map((e: any) => ({
        note: e.notes[0]?.note ?? null,
        present: e.notes[0]?.present ?? true,
        coefficient: e.coefficient,
        cloturee: e.statut === StatutEvaluation.CLOTUREE,
      }));
      const moyenne = moyenneUe(epreuves);
      return {
        matiereId,
        matiereIntitule: matiere.intitule,
        credits: matiere.credits,
        matiere: {
          id: matiere.id,
          code: matiere.code,
          intitule: matiere.intitule,
          credits: matiere.credits,
        },
        moyenne: moyenne.moyenne,
        enDefaut: moyenne.enDefaut,
        absenceCloturee: moyenne.absencesCloturees,
        epreuves: evals.map((e: any) => ({
          intitule: e.intitule,
          coefficient: e.coefficient,
          statut: e.statut,
          note: e.notes[0]?.note ?? null,
          present: e.notes[0]?.present ?? true,
        })),
      };
    });
  }

  /** Le cœur du jury : moyennes, décisions, rangs, taux de réussite. */
  private async calculerInternes(delib: any, tx: Db) {
    const candidats = await this.candidatsDeliberation(delib, tx);
    if (!candidats.length) {
      throw new BadRequestException(
        I18nContext.current()!.t(delib.session === SessionDeliberation.RATTRAPAGE
          ? 'scolarite.aucun_etudiant_a_repositionner_aucun_ajourne_a_la_session_no'
          : 'scolarite.aucun_etudiant_inscrit_statut_valide_pour_cette_promotion'),
      );
    }

    const tribunes: Array<Candidat & { moyenne: number }> = [];
    const resultats = new Map<string, ResultatEtudiant>();

    for (const c of candidats) {
      const matieres = await this.matieresDuEtudiant(delib, c.inscriptionId, tx);
      const resultat = decider(matieres);
      resultats.set(c.inscriptionId, resultat);
      tribunes.push({ ...c, moyenne: resultat.moyenneGenerale ?? 0 });
    }

    const classes = classer(tribunes);
    const rangParId = new Map(classes.map((c) => [c.inscriptionId, c.rang]));

    const mises = await Promise.all(
      candidats.map(async (c) => {
        const r = resultats.get(c.inscriptionId)!;
        return tx.deliberationLigne.upsert({
          where: {
            deliberationId_inscriptionId: {
              deliberationId: delib.id,
              inscriptionId: c.inscriptionId,
            },
          },
          create: {
            deliberationId: delib.id,
            inscriptionId: c.inscriptionId,
            moyenne: r.moyenneGenerale ?? 0,
            decision: r.decision as DecisionJury,
            mention: r.mention,
            rang: rangParId.get(c.inscriptionId) ?? 0,
          },
          update: {
            moyenne: r.moyenneGenerale ?? 0,
            decision: r.decision as DecisionJury,
            mention: r.mention,
            rang: rangParId.get(c.inscriptionId) ?? 0,
          },
        });
      }),
    );

    let admis = 0;
    for (const ligne of mises) {
      if (ligne.decision === DecisionJury.ADMIS) admis++;
    }
    const defaillants = mises.filter((l) => l.decision === DecisionJury.DEFAILLANT).length;
    const tauxReussite = pct(admis, mises.length);

    const deliberation = await tx.deliberation.update({
      where: { id: delib.id },
      data: { tauxReussite },
    });

    return {
      etudiants: mises.length,
      admis,
      defaillants,
      ajournes: mises.length - admis - defaillants,
      tauxReussite,
      statut: deliberation.statut,
    };
  }

  // --------------------------------------------------------- Bulletins & PV

  /** Détail complet pour le PV : délibération + lignes classées par rang. */
  pourImpression(deliberationId: string) {
    return this.detailDeliberation(deliberationId);
  }

  /** Bulletin d'un étudiant : ligne du jury + moyennes d'UE détaillées. */
  async bulletin(deliberationId: string, inscriptionId: string) {
    const delib = await this.detailDeliberation(deliberationId);
    const ligne = delib.lignes.find((l: any) => l.inscriptionId === inscriptionId);
    if (!ligne) throw new NotFoundException(I18nContext.current()!.t('scolarite.aucune_ligne_pour_cet_etudiant_a_cette_deliberation'));
    const matieres = await this.matieresDuEtudiant(delib, inscriptionId, this.prisma);
    return { delib, ligne, matieres };
  }
}
