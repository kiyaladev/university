/**
 * Module Examens — planification et anti-fantômes.
 *
 * Cycle de vie d'un examen : PLANIFIE → EN_COURS → TERMINE (ou ANNULE).
 * À l'ouverture (POST /examens/:id/demarrer), le service calcule le nombre
 * d'inscrits (= inscriptions VALIDEE de la promotion + année) et fige ce
 * chiffre dans la fiche : c'est l'instantané qui sert de base aux scans.
 *
 * Le scan à l'entrée de la salle valide le porteur selon trois clés possibles,
 * par ordre de priorité : jeton QR resto (`Etudiant.qrRestoToken`), matricule
 * INE (`Etudiant.matricule`), identifiant interne (`Etudiant.id`). Tout autre
 * type de référence scannée est consigné avec `valide=false, motifRejet='Carte
 * autre'` : le porteur litigieux reste tracé, mais le compteur `nbPresents`
 * n'est pas incrémenté et un audit `EXAMEN_SCAN_REJETE` est inscrit.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatutExamen } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated, QueryDto } from '../../common/dto';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from '../../common/annee';
import { CreateExamenDto, ExamenQueryDto, ScanExamenDto } from './examens.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';

const EXAMEN_INCLUDE = {
  matiere: true,
  promotion: { include: { filiere: true } },
  annee: true,
  salle: { select: { id: true, code: true, nom: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  surveillant: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { scans: true, tirages: true } },
} satisfies Prisma.ExamenInclude;

const SCAN_INCLUDE = {
  inscription: {
    select: {
      id: true,
      etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
    },
  },
  scanneur: { select: { id: true, nom: true, prenom: true } },
  examen: {
    select: {
      id: true,
      intitule: true,
      codeExamen: true,
      dateExamen: true,
      heureDebut: true,
      heureFin: true,
    },
  },
} satisfies Prisma.ScanExamenInclude;

const MOTIF_REJET_CARTE_AUTRE = 'Carte autre';

@Injectable()
export class ExamensService {
  constructor(private prisma: PrismaService) {}

  listerSurveillants() {
    return this.prisma.user.findMany({
      where: { actif: true, role: { in: [Role.CONTROLEUR, Role.ENSEIGNANT] } },
      select: { id: true, nom: true, prenom: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take: 1000,
    });
  }

  // ------------------------------------------------------- lecture

  async liste(query: ExamenQueryDto, user: AuthUser): Promise<Paginated<any>> {
    const pagination = paginer(query);

    const where: Prisma.ExamenWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.matiereId ? { matiereId: query.matiereId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
      ...(user.role === Role.CONTROLEUR || user.role === Role.ENSEIGNANT ? { surveillantId: user.id } : {}),
    };
    if (query.dateDebut || query.dateFin) {
      where.dateExamen = {};
      if (query.dateDebut) where.dateExamen.gte = new Date(query.dateDebut);
      if (query.dateFin) where.dateExamen.lte = new Date(query.dateFin);
    }

    const [data, total] = await Promise.all([
      this.prisma.examen.findMany({
        where,
        include: EXAMEN_INCLUDE,
        orderBy: { dateExamen: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.examen.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  async trouver(id: string, user?: AuthUser) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: EXAMEN_INCLUDE,
    });
    if (!examen) throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
    if (user && (user.role === Role.CONTROLEUR || user.role === Role.ENSEIGNANT) && examen.surveillantId !== user.id) {
      throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
    }
    return examen;
  }

  async stats(id: string, user: AuthUser) {
    await this.trouver(id, user);
    const [examen, valide, rejete] = await Promise.all([
      this.prisma.examen.findUnique({
        where: { id },
        select: { nbInscrits: true, nbPresents: true, statut: true, codeExamen: true },
      }),
      this.prisma.scanExamen.count({ where: { examenId: id, valide: true, inscriptionId: { not: null } } }),
      this.prisma.scanExamen.count({ where: { examenId: id, valide: false } }),
    ]);
    return {
      ...examen,
      nbPresents: valide,
      totalScans: valide + rejete,
      scansValides: valide,
      scansRejetes: rejete,
      tauxPresence: examen && examen.nbInscrits > 0
        ? Math.round((examen.nbPresents / examen.nbInscrits) * 1000) / 10
        : 0,
    };
  }

  // ---------------------------------------------------- création

  async creer(dto: CreateExamenDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, dto.anneeId);
      await exigerPromotionMemeAnnee(tx, dto.promotionId, dto.anneeId);
      const examen = await tx.examen.create({
        data: {
          intitule: dto.intitule,
          type: dto.type,
          matiereId: dto.matiereId,
          promotionId: dto.promotionId,
          anneeId: dto.anneeId,
          dateExamen: new Date(dto.dateExamen),
          heureDebut: dto.heureDebut,
          heureFin: dto.heureFin,
          salleId: dto.salleId ?? null,
          nbInscrits: dto.nbInscrits ?? 0,
          codeExamen: dto.codeExamen,
          surveillantId: dto.surveillantId ?? null,
          creeParId: user.id,
        },
        include: EXAMEN_INCLUDE,
      });
      await journaliser(tx, user, 'EXAMEN_CREE', 'Examen', examen.id, { avant: null, apres: this.instantaneAudit(examen) });
      return examen;
    });
  }

  async changerStatut(id: string, statut: StatutExamen, user: AuthUser) {
    await this.trouver(id);
    return this.prisma.$transaction(async (tx) => {
      const examen: any = await tx.examen.findUnique({ where: { id }, include: EXAMEN_INCLUDE });
      if (!examen) throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
      await exigerAnneeOuverte(tx, examen.anneeId);
      // Les transitions de démarrage et de clôture ont chacune leur endpoint,
      // avec leurs contrôles et compteurs. Cette route ne sert qu'à annuler
      // un examen encore planifié.
      if (statut !== StatutExamen.ANNULE || examen.statut !== StatutExamen.PLANIFIE) {
        throw new BadRequestException(I18nContext.current()!.t('examens.transition_statut_invalide'));
      }
      const transition = await tx.examen.updateMany({
        where: { id, statut: StatutExamen.PLANIFIE },
        data: { statut: StatutExamen.ANNULE },
      });
      if (transition.count !== 1) {
        throw new BadRequestException(I18nContext.current()!.t('examens.transition_statut_invalide'));
      }
      const maj: any = await tx.examen.findUnique({ where: { id }, include: EXAMEN_INCLUDE });
      await journaliser(
        tx,
        user,
        'EXAMEN_STATUT',
        'Examen',
        id,
        { avant: this.instantaneAudit(examen), apres: this.instantaneAudit(maj) },
      );
      return maj;
    });
  }

  // ------------------------------------------------ cycle de vie

  /**
   * PLANIFIE → EN_COURS :
   *   - recalcule `nbInscrits` à partir des inscriptions VALIDEE pour la
   *     promotion + année de l'examen ;
   *   - remet `nbPresents` à 0 (reprise propre d'une session).
   */
  async demarrer(id: string, user: AuthUser) {
    await this.trouver(id, user);
    return this.prisma.$transaction(async (tx) => {
      const examen: any = await tx.examen.findUnique({ where: { id }, include: EXAMEN_INCLUDE });
      if (!examen) throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
      await exigerAnneeOuverte(tx, examen.anneeId);
      if (examen.statut === StatutExamen.ANNULE) {
        throw new BadRequestException(I18nContext.current()!.t('examens.examen_annule_demarrage_impossible'));
      }
      if (examen.statut !== StatutExamen.PLANIFIE) {
        throw new BadRequestException(I18nContext.current()!.t('examens.examen_deja_termine'));
      }
      const nbInscrits = await tx.inscription.count({
        where: { promotionId: examen.promotionId, anneeId: examen.anneeId, statut: 'VALIDEE' },
      });
      const transition = await tx.examen.updateMany({
        where: { id, statut: StatutExamen.PLANIFIE },
        data: { statut: StatutExamen.EN_COURS, nbInscrits, nbPresents: 0 },
      });
      if (transition.count !== 1) {
        throw new BadRequestException(I18nContext.current()!.t('examens.examen_deja_termine'));
      }
      const maj: any = await tx.examen.findUnique({ where: { id }, include: EXAMEN_INCLUDE });
      await journaliser(
        tx,
        user,
        'EXAMEN_DEMARRE',
        'Examen',
        id,
        { avant: this.instantaneAudit(examen), apres: this.instantaneAudit(maj) },
      );
      return maj;
    });
  }

  /** EN_COURS → TERMINE. Ne recalcule rien : `nbPresents` reflète l'existant. */
  async terminer(id: string, user: AuthUser) {
    await this.trouver(id);
    return this.prisma.$transaction(async (tx) => {
      const examen: any = await tx.examen.findUnique({ where: { id }, include: EXAMEN_INCLUDE });
      if (!examen) throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
      await exigerAnneeOuverte(tx, examen.anneeId);
      if (examen.statut !== StatutExamen.EN_COURS) {
        throw new BadRequestException(I18nContext.current()!.t('examens.seul_un_examen_en_cours_peut_etre_termine'));
      }
      const transition = await tx.examen.updateMany({
        where: { id, statut: StatutExamen.EN_COURS },
        data: { statut: StatutExamen.TERMINE },
      });
      if (transition.count !== 1) {
        throw new BadRequestException(I18nContext.current()!.t('examens.seul_un_examen_en_cours_peut_etre_termine'));
      }
      const maj: any = await tx.examen.findUnique({ where: { id }, include: EXAMEN_INCLUDE });
      await journaliser(
        tx,
        user,
        'EXAMEN_TERMINE',
        'Examen',
        id,
        { avant: this.instantaneAudit(examen), apres: this.instantaneAudit(maj) },
      );
      return maj;
    });
  }

  private instantaneAudit(examen: any) {
    return {
      id: examen.id,
      codeExamen: examen.codeExamen,
      intitule: examen.intitule,
      statut: examen.statut,
      anneeId: examen.anneeId,
      promotionId: examen.promotionId,
      nbInscrits: examen.nbInscrits,
      nbPresents: examen.nbPresents,
    };
  }

  // ------------------------------------------------ scans anti-fantômes

  async listeScans(id: string, query: QueryDto, user: AuthUser): Promise<Paginated<any>> {
    await this.trouver(id, user);
    const pagination = paginer(query);
    const where = { examenId: id };
    const [data, total] = await Promise.all([
      this.prisma.scanExamen.findMany({
        where,
        include: SCAN_INCLUDE,
        orderBy: { heureScan: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.scanExamen.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  /**
   * Scan à l'entrée — la règle de validation :
   *   1. La référence est reconnue via `Etudiant.qrRestoToken`, puis
   *      `Etudiant.matricule`, puis `Etudiant.id` (chacun, à tour de rôle) ;
   *   2. l'étudiant trouvé DOIT avoir une inscription VALIDEE pour la promotion
   *      et l'année académiques de l'examen — sinon le scan est consigné en
   *      invalide ;
   *   3. un scan déjà enregistré pour ce même étudiant/examen n'est pas
   *      dédoublonné : on ne crée pas de second enregistrement, et l'original
   *      n'est pas mis à jour (le scan est idempotent) ;
   *   4. sur scan valide, `nbPresents` est incrémenté.
   * Toute autre référence est consignée avec `valide=false, motifRejet='Carte
   * autre'`. Aucune erreur n'est lancée : un scan raté est une information de
   * service (anti-fantômes), pas une condition d'échec HTTP.
   */
  async scanner(dto: ScanExamenDto, ip: string | undefined, user: AuthUser) {
    const examen = await this.trouver(dto.examenId, user);
    await exigerAnneeOuverte(this.prisma, examen.anneeId);
    const reference = dto.reference.trim();
    if (!reference) throw new BadRequestException(I18nContext.current()!.t('examens.reference_vide'));

    if (examen.statut !== StatutExamen.EN_COURS) {
      throw new BadRequestException(I18nContext.current()!.t('examens.scan_exige_examen_en_cours'));
    }

    const candidat = await this.trouverEtudiantParReference(reference);

    if (!candidat) {
      return this.consignerRejet(dto, examen.anneeId, examen.codeExamen, reference, ip, user, MOTIF_REJET_CARTE_AUTRE);
    }

    const inscription = await this.prisma.inscription.findFirst({
      where: {
        etudiantId: candidat.id,
        promotionId: examen.promotionId,
        anneeId: examen.anneeId,
        statut: 'VALIDEE',
      },
      select: { id: true },
    });

    if (!inscription) {
      return this.consignerRejet(
        dto,
        examen.anneeId,
        examen.codeExamen,
        reference,
        ip,
        user,
        'Étudiant non inscrit à cette promotion',
        candidat,
      );
    }

    const scan = await this.prisma.$transaction(async (tx) => {
      await this.verifierExamenDansTransaction(tx, examen.id, examen.anneeId, user);
      const dejaScanne = await tx.scanExamen.findFirst({
        where: { examenId: examen.id, inscriptionId: inscription.id },
        include: SCAN_INCLUDE,
      });
      if (dejaScanne) return { ...dejaScanne, dejaEnregistre: true };
      const created = await tx.scanExamen.create({
        data: {
          examenId: examen.id,
          inscriptionId: inscription.id,
          matriculeSaisi: candidat.matricule,
          nomPorteur: candidat.nom,
          prenomPorteur: candidat.prenom,
          valide: true,
          scanneurId: user.id,
          ipAppareil: ip ?? null,
        },
        include: SCAN_INCLUDE,
      });

      // Incrément instantané : nbPresents est l'instantané affiché en haut de
      // la page ScanExamenPage. On laisse un recalcul possible via /stats.
      const examenMaj = await tx.examen.update({
        where: { id: examen.id },
        data: { nbPresents: { increment: 1 } },
      });

      await journaliser(
        tx,
        user,
        'EXAMEN_SCAN_VALIDE',
        'ScanExamen',
        created.id,
        `${examen.codeExamen} — présence enregistrée (${examenMaj.nbPresents}/${examenMaj.nbInscrits})`,
      );

      return created;
    });

    return scan;
  }

  /** Verrouille l’examen pendant l’écriture pour fermer le scan/démarrage/clôture concurrents. */
  private async verifierExamenDansTransaction(
    tx: Prisma.TransactionClient,
    examenId: string,
    anneeId: string,
    user: AuthUser,
  ) {
    // Garder le même ordre de verrouillage que les autres mutations : année,
    // puis examen, pour éviter un interblocage pendant la clôture d'année.
    await exigerAnneeOuverte(tx, anneeId);
    const examen = typeof (tx as any).$queryRaw === 'function'
      ? ((await (tx as any).$queryRaw`
          SELECT "anneeId", "statut", "surveillantId"
          FROM "Examen" WHERE "id" = ${examenId} FOR UPDATE
        `)[0] as { anneeId: string; statut: StatutExamen; surveillantId: string | null } | undefined)
      : await tx.examen.findUnique({
          where: { id: examenId },
          select: { anneeId: true, statut: true, surveillantId: true },
        });
    if (!examen) throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
    if (examen.anneeId !== anneeId) throw new BadRequestException(I18nContext.current()!.t('examens.examen_introuvable'));
    if ((user.role === Role.CONTROLEUR || user.role === Role.ENSEIGNANT) && examen.surveillantId !== user.id) {
      throw new NotFoundException(I18nContext.current()!.t('examens.examen_introuvable'));
    }
    if (examen.statut !== StatutExamen.EN_COURS) {
      throw new BadRequestException(I18nContext.current()!.t('examens.scan_exige_examen_en_cours'));
    }
    return examen;
  }

  // ------------------------------------------------------- helpers

  /**
   * Résolution de l'étudiant par référence : QR resto → matricule → id.
   * Couvre l'usage du lecteur QR (qui pose `UP-RESTO-…`), de la recherche
   * manuelle (matricule INE) et des saisies techniques (id interne).
   */
  private async trouverEtudiantParReference(reference: string) {
    if (!reference) return null;
    return (
      (await this.prisma.etudiant.findUnique({ where: { qrRestoToken: reference } })) ??
      (await this.prisma.etudiant.findUnique({ where: { matricule: reference } })) ??
      (await this.prisma.etudiant.findUnique({ where: { id: reference } }))
    );
  }

  private async consignerRejet(
    dto: ScanExamenDto,
    anneeId: string,
    codeExamen: string,
    reference: string,
    ip: string | undefined,
    user: AuthUser,
    motif: string,
    candidat?: { matricule: string; nom: string; prenom: string } | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.verifierExamenDansTransaction(tx, dto.examenId, anneeId, user);
      const scan = await tx.scanExamen.create({
        data: {
          examenId: dto.examenId,
          inscriptionId: null,
          matriculeSaisi: candidat?.matricule ?? (/^UP-RESTO-/i.test(reference) ? '[QR masqué]' : reference),
          nomPorteur: candidat?.nom ?? null,
          prenomPorteur: candidat?.prenom ?? null,
          valide: false,
          motifRejet: motif,
          scanneurId: user.id,
          ipAppareil: ip ?? null,
        },
        include: SCAN_INCLUDE,
      });

      await journaliser(tx, user, 'EXAMEN_SCAN_REJETE', 'ScanExamen', scan.id, `${codeExamen} — scan refusé`);
      return scan;
    });
  }
}
