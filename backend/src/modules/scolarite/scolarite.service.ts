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
import { Paginated } from '../../common/dto';
import { pct, toDateOnly } from '../../common/utils';
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

  // ----------------------------------------------------------- Évaluations

  async listerEvaluations(query: EvaluationQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.EvaluationWhereInput = {
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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.evaluation.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  private veillerEvaluation(id: string) {
    return this.prisma.evaluation.findUnique({
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
    if (!evaluation) throw new NotFoundException('Évaluation introuvable');
    return evaluation;
  }

  async creerEvaluation(dto: CreateEvaluationDto) {
    const [matiere, annee, promotion] = await Promise.all([
      this.prisma.matiere.findUnique({ where: { id: dto.matiereId } }),
      this.prisma.anneeAcademique.findUnique({ where: { id: dto.anneeId } }),
      this.prisma.promotion.findUnique({ where: { id: dto.promotionId } }),
    ]);
    if (!matiere) throw new NotFoundException('Matière introuvable');
    if (!annee) throw new NotFoundException('Année académique introuvable');
    if (!promotion) throw new NotFoundException('Promotion introuvable');

    return this.prisma.evaluation.create({
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
  }

  async modifierEvaluation(id: string, dto: UpdateEvaluationDto) {
    const existante = await this.veillerEvaluation(id);
    if (!existante) throw new NotFoundException('Évaluation introuvable');
    if (existante.statut === StatutEvaluation.CLOTUREE) {
      throw new BadRequestException(
        `L'évaluation « ${existante.intitule} » est clôturée : ses notes sont figées et elle ne peut plus être modifiée.`,
      );
    }
    return this.prisma.evaluation.update({
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
  }

  async supprimerEvaluation(id: string) {
    const existante = await this.veillerEvaluation(id);
    if (!existante) throw new NotFoundException('Évaluation introuvable');
    if (existante._count.notes > 0) {
      throw new BadRequestException(
        `Impossible de supprimer « ${existante.intitule} » : des notes y sont déjà saisies (${existante._count.notes}).`,
      );
    }
    await this.prisma.evaluation.delete({ where: { id } });
    return { id };
  }

  async cloturerEvaluation(id: string) {
    const existante = await this.veillerEvaluation(id);
    if (!existante) throw new NotFoundException('Évaluation introuvable');
    if (existante.statut === StatutEvaluation.CLOTUREE) {
      throw new BadRequestException(`L'évaluation « ${existante.intitule} » est déjà clôturée.`);
    }
    return this.prisma.evaluation.update({
      where: { id },
      data: { statut: StatutEvaluation.CLOTUREE },
      include: {
        matiere: true,
        promotion: true,
        annee: true,
        _count: { select: { notes: true } },
      },
    });
  }

  // ----------------------------------------------------------------- Notes

  /** Feuille de notes d'une évaluation : les inscrits de la promotion, leur
   *  note éventuelle et le badge « manquante » pour les saisies absentes. */
  async feuilleEvaluation(id: string) {
    const evaluation = await this.veillerEvaluation(id);
    if (!evaluation) throw new NotFoundException('Évaluation introuvable');

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

  async listerNotes(query: NoteQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';
    const where = query.evaluationId ? { evaluationId: query.evaluationId } : {};

    const [data, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        include: {
          evaluation: { include: { matiere: true } },
          inscription: { include: { etudiant: true, promotion: true } },
        },
        orderBy: { saisieLe: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.note.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  /** Saisie en bloc (bulk upsert, transaction). Les lignes hors contexte
   *  (inscrit d'une autre promotion/année, note hors bornes) sont ignorées
   *  et comptabilisées dans `ignorees`. */
  async saisirNotes(dto: SaisieNotesDto, saisiePar: AuthUser) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: dto.evaluationId },
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable');
    if (evaluation.statut === StatutEvaluation.CLOTUREE) {
      throw new BadRequestException(
        `L'évaluation « ${evaluation.intitule} » est clôturée : la saisie des notes est fermée.`,
      );
    }

    const inscrits = await this.prisma.inscription.findMany({
      where: { promotionId: evaluation.promotionId, anneeId: evaluation.anneeId, ...INSCRITS_VALIDES },
      select: { id: true },
    });
    const dansLaPromotion = new Set(inscrits.map((i) => i.id));

    const valides = dto.notes.filter(
      (n) =>
        dansLaPromotion.has(n.inscriptionId) &&
        ((n.note ?? null) === null || (n.note! >= 0 && n.note! <= 20)),
    );
    const ignorees = dto.notes.length - valides.length;

    await this.prisma.$transaction(
      valides.map((n) =>
        this.prisma.note.upsert({
          where: {
            evaluationId_inscriptionId: {
              evaluationId: dto.evaluationId,
              inscriptionId: n.inscriptionId,
            },
          },
          create: {
            evaluationId: dto.evaluationId,
            inscriptionId: n.inscriptionId,
            note: n.note ?? null,
            present: n.present ?? true,
            saisieParId: saisiePar.id,
          },
          update: {
            note: n.note ?? null,
            present: n.present ?? true,
            saisieParId: saisiePar.id,
          },
        }),
      ),
    );

    return { n: valides.length, ignorees };
  }

  // -------------------------------------------------------- Délibérations

  async listerDeliberations(query: DeliberationQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';
    const where = query.anneeId ? { anneeId: query.anneeId } : {};

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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.deliberation.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
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
    if (!delib) throw new NotFoundException('Délibération introuvable');
    const lignes = [...delib.lignes].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));
    return { ...delib, lignes };
  }

  /** Nouvelle délibération (BROUILLON) : lignes catégorisées et calculées
   *  d'emblée (session rattrapage : uniquement les AJOURNÉ de la normale). */
  async creerDeliberation(dto: CreateDeliberationDto, creePar: AuthUser) {
    const session: SessionDeliberation = dto.session ?? SessionDeliberation.NORMALE;

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
        session === SessionDeliberation.NORMALE
          ? 'Une délibération de session normale existe déjà pour cette promotion et cette année.'
          : 'Une délibération de rattrapage existe déjà pour cette promotion et cette année.',
      );
    }

    const [annee, promotion] = await Promise.all([
      this.prisma.anneeAcademique.findUnique({ where: { id: dto.anneeId } }),
      this.prisma.promotion.findUnique({ where: { id: dto.promotionId } }),
    ]);
    if (!annee) throw new NotFoundException('Année académique introuvable');
    if (!promotion) throw new NotFoundException('Promotion introuvable');

    const delib = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.deliberation.create({
        data: {
          anneeId: dto.anneeId,
          promotionId: dto.promotionId,
          session,
          creeParId: creePar.id,
        },
      });
      await this.calculerDeliberation(cree.id, tx);
      return this.detailDeliberation(cree.id, tx);
    });
    return delib;
  }

  /** Recalcule moyennes, décisions, rangs et taux de réussite. Bloqué dès
   *  que le jury a validé. */
  async calculerDeliberation(deliberationId: string, db: Db = this.prisma) {
    const delib = await db.deliberation.findUnique({
      where: { id: deliberationId },
      include: { annee: true, promotion: true },
    });
    if (!delib) throw new NotFoundException('Délibération introuvable');
    if (delib.statut === StatutDeliberation.VALIDEE) {
      throw new BadRequestException(
        'Délibération validée par le jury : tout recalcul est bloqué.',
      );
    }
    return this.calculerInternes(delib, db);
  }

  /** Le jury (ADMIN|DIRECTION) valide : BROUILLON → VALIDEE, tout est figé. */
  async validerDeliberation(deliberationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const delib = await tx.deliberation.findUnique({ where: { id: deliberationId } });
      if (!delib) throw new NotFoundException('Délibération introuvable');
      if (delib.statut === StatutDeliberation.VALIDEE) {
        const le = delib.valideeLe?.toLocaleDateString('fr-FR');
        throw new BadRequestException(
          le ? `Cette délibération a déjà été validée par le jury le ${le}.` : 'Cette délibération est déjà validée.',
        );
      }
      return tx.deliberation.update({
        where: { id: deliberationId },
        data: { statut: StatutDeliberation.VALIDEE, valideeParId: userId, valideeLe: new Date() },
      });
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
        throw new BadRequestException(
          "La délibération de la session normale doit d'abord exister.",
        );
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
        delib.session === SessionDeliberation.RATTRAPAGE
          ? 'Aucun étudiant à repositionner (aucun AJOURNÉ à la session normale).'
          : 'Aucun étudiant inscrit (statut validé) pour cette promotion.',
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
    if (!ligne) throw new NotFoundException('Aucune ligne pour cet étudiant à cette délibération');
    const matieres = await this.matieresDuEtudiant(delib, inscriptionId, this.prisma);
    return { delib, ligne, matieres };
  }
}