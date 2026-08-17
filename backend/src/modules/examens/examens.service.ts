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
import { Prisma, StatutExamen } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { CreateExamenDto, ExamenQueryDto, ScanExamenDto } from './examens.dto';

const EXAMEN_INCLUDE = {
  matiere: true,
  promotion: { include: { filiere: true } },
  annee: true,
  salle: true,
  creePar: { select: { id: true, nom: true, prenom: true } },
  surveillant: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { scans: true, tirages: true } },
} satisfies Prisma.ExamenInclude;

const SCAN_INCLUDE = {
  inscription: { include: { etudiant: true } },
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

  // ------------------------------------------------------- lecture

  async liste(query: ExamenQueryDto): Promise<Paginated<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const where: Prisma.ExamenWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.matiereId ? { matiereId: query.matiereId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.salleId ? { salleId: query.salleId } : {}),
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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.examen.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: EXAMEN_INCLUDE,
    });
    if (!examen) throw new NotFoundException('Examen introuvable');
    return examen;
  }

  async stats(id: string) {
    await this.trouver(id);
    const [examen, valide, rejete] = await Promise.all([
      this.prisma.examen.findUnique({
        where: { id },
        select: { nbInscrits: true, nbPresents: true, statut: true, codeExamen: true },
      }),
      this.prisma.scanExamen.count({ where: { examenId: id, valide: true } }),
      this.prisma.scanExamen.count({ where: { examenId: id, valide: false } }),
    ]);
    return {
      ...examen,
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
    const examen = await this.prisma.examen.create({
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
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAMEN_CREE',
        entite: 'Examen',
        entiteId: examen.id,
        details: `${examen.codeExamen} — ${examen.intitule}`,
      },
    });
    return examen;
  }

  async changerStatut(id: string, statut: StatutExamen, user: AuthUser) {
    const examen = await this.trouver(id);
    const maj = await this.prisma.examen.update({
      where: { id },
      data: { statut },
      include: EXAMEN_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAMEN_STATUT',
        entite: 'Examen',
        entiteId: id,
        details: `${examen.codeExamen} → ${statut}`,
      },
    });
    return maj;
  }

  // ------------------------------------------------ cycle de vie

  /**
   * PLANIFIE → EN_COURS :
   *   - recalcule `nbInscrits` à partir des inscriptions VALIDEE pour la
   *     promotion + année de l'examen ;
   *   - remet `nbPresents` à 0 (reprise propre d'une session).
   */
  async demarrer(id: string, user: AuthUser) {
    const examen = await this.trouver(id);
    if (examen.statut === StatutExamen.TERMINE) {
      throw new BadRequestException("Examen déjà terminé");
    }
    if (examen.statut === StatutExamen.ANNULE) {
      throw new BadRequestException('Examen annulé : démarrage impossible');
    }

    const nbInscrits = await this.prisma.inscription.count({
      where: {
        promotionId: examen.promotionId,
        anneeId: examen.anneeId,
        statut: 'VALIDEE',
      },
    });

    const maj = await this.prisma.examen.update({
      where: { id },
      data: { statut: StatutExamen.EN_COURS, nbInscrits, nbPresents: 0 },
      include: EXAMEN_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAMEN_DEMARRE',
        entite: 'Examen',
        entiteId: id,
        details: `${examen.codeExamen} — ${nbInscrits} inscrit(s)`,
      },
    });
    return maj;
  }

  /** EN_COURS → TERMINE. Ne recalcule rien : `nbPresents` reflète l'existant. */
  async terminer(id: string, user: AuthUser) {
    const examen = await this.trouver(id);
    if (examen.statut !== StatutExamen.EN_COURS) {
      throw new BadRequestException('Seul un examen EN_COURS peut être terminé');
    }
    const maj = await this.prisma.examen.update({
      where: { id },
      data: { statut: StatutExamen.TERMINE },
      include: EXAMEN_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAMEN_TERMINE',
        entite: 'Examen',
        entiteId: id,
        details: `${examen.codeExamen} — ${examen.nbPresents}/${examen.nbInscrits} présent(s)`,
      },
    });
    return maj;
  }

  // ------------------------------------------------ scans anti-fantômes

  async listeScans(id: string) {
    await this.trouver(id);
    const scans = await this.prisma.scanExamen.findMany({
      where: { examenId: id },
      include: SCAN_INCLUDE,
      orderBy: { heureScan: 'desc' },
    });
    return scans;
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
    const examen = await this.trouver(dto.examenId);
    const reference = dto.reference.trim();
    if (!reference) throw new BadRequestException('Référence vide');

    if (examen.statut === StatutExamen.ANNULE || examen.statut === StatutExamen.TERMINE) {
      throw new BadRequestException(
        `Examen ${examen.statut} : aucun scan n'est accepté`,
      );
    }

    const candidat = await this.trouverEtudiantParReference(reference);

    if (!candidat) {
      return this.consignerRejet(dto, examen.codeExamen, reference, ip, user, MOTIF_REJET_CARTE_AUTRE);
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
        examen.codeExamen,
        reference,
        ip,
        user,
        'Étudiant non inscrit à cette promotion',
        candidat,
      );
    }

    const existant = await this.prisma.scanExamen.findFirst({
      where: { examenId: examen.id, inscriptionId: inscription.id },
    });
    if (existant) {
      return { ...existant, dejaEnregistre: true };
    }

    const scan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.scanExamen.create({
        data: {
          examenId: examen.id,
          inscriptionId: inscription.id,
          matriculeSaisi: reference,
          nomPorteur: candidat.nom,
          prenomPorteur: candidat.prenom,
          valide: true,
          scanneurId: dto.scanneurId ?? user.id,
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

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'EXAMEN_SCAN_VALIDE',
          entite: 'ScanExamen',
          entiteId: created.id,
          details: `${examen.codeExamen} — ${candidat.matricule} ${candidat.nom} ${candidat.prenom} (${examenMaj.nbPresents}/${examenMaj.nbInscrits})`,
        },
      });

      return created;
    });

    return scan;
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
    codeExamen: string,
    reference: string,
    ip: string | undefined,
    user: AuthUser,
    motif: string,
    candidat?: { matricule: string; nom: string; prenom: string } | null,
  ) {
    const scan = await this.prisma.scanExamen.create({
      data: {
        examenId: dto.examenId,
        inscriptionId: null,
        matriculeSaisi: reference,
        nomPorteur: candidat?.nom ?? null,
        prenomPorteur: candidat?.prenom ?? null,
        valide: false,
        motifRejet: motif,
        scanneurId: dto.scanneurId ?? user.id,
        ipAppareil: ip ?? null,
      },
      include: SCAN_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAMEN_SCAN_REJETE',
        entite: 'ScanExamen',
        entiteId: scan.id,
        details: `${codeExamen} — ${motif} — réf scannée « ${reference} »${
          candidat ? ` (carte de ${candidat.matricule} ${candidat.nom} ${candidat.prenom})` : ''
        }`,
      },
    });
    return scan;
  }
}
