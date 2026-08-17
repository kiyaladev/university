import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DecisionJury,
  Prisma,
  StatutDeliberation,
  StatutInscription,
  StatutNotification,
} from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { numerique } from './otp.client';
import { SmsService } from './sms.service';
import {
  DiffusionNotificationDto,
  DiffusionResultatsDto,
  ListeNotificationsQueryDto,
} from './portail.dto';

/**
 * Notifications SMS : diffusion manuelle ou automatique des résultats de
 * délibération, historique consultable et petit compteur pour la barre de
 * navigation. Chaque SMS partant est consigné dans `Notification` avec son
 * statut d'émission.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /** Historique paginé, filtrable par statut et par recherche (téléphone…). */
  async lister(query: ListeNotificationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.NotificationWhereInput = {};
    if (query.statut) where.statut = query.statut;
    const chercher = (query.search ?? '').trim();
    if (chercher) {
      where.OR = [
        { telephone: { contains: chercher } },
        { destinataireNom: { contains: chercher, mode: 'insensitive' } },
        { motif: { contains: chercher, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
          envoyePar: { select: { id: true, nom: true, prenom: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, total, page, pageSize };
  }

  /** Diffusion manuelle : numéros explicites ou tous les inscrits de l'année. */
  async diffuser(dto: DiffusionNotificationDto, utilisateur: AuthUser) {
    let cibles: { telephone: string; etudiantId?: string; destinataireNom?: string }[];

    if (dto.tousInscrits) {
      const annee = await this.prisma.anneeAcademique.findFirst({ where: { active: true } });
      if (!annee) {
        throw new BadRequestException(
          'Aucune année académique active : impossible de cibler les inscrits.',
        );
      }
      const lignes = await this.prisma.inscription.findMany({
        where: { anneeId: annee.id, statut: { not: StatutInscription.ANNULEE } },
        include: {
          etudiant: {
            select: { id: true, nom: true, prenom: true, telephone: true },
          },
        },
      });
      cibles = lignes
        .filter((l) => numerique(l.etudiant.telephone).length >= 8)
        .map((l) => ({
          telephone: numerique(l.etudiant.telephone),
          etudiantId: l.etudiant.id,
          destinataireNom: `${l.etudiant.nom} ${l.etudiant.prenom}`.trim(),
        }));
      if (!cibles.length) {
        throw new BadRequestException(
          'Aucun étudiant joignable (aucun numéro valide sur les fiches d’inscription).',
        );
      }
    } else {
      cibles = (dto.destinatairesTelephones ?? []).map((t) => ({ telephone: numerique(t) }));
      if (!cibles.length || !dto.message) {
        throw new BadRequestException(
          'Précisez au moins un numéro (ou « tous les inscrits ») et un message.',
        );
      }
    }

    // Un même numéro ne reçoit qu'un SMS par diffusion.
    const uniques = [...new Map(cibles.map((c) => [c.telephone, c])).values()];

    return this.sms.envoyerPlusieurs(
      uniques.map((c) => ({
        ...c,
        message: dto.message,
        motif: dto.motif ?? 'AVIS',
        envoyeParId: utilisateur.id,
      })),
    );
  }

  /**
   * Diffusion des résultats d'une délibération validée : uniquement les
   * étudiants ADMIS ou AJOURNÉS (un défaillant n'est pas notifié), uniquement
   * sur les numéros valides de leur fiche.
   */
  async diffuserResultats(dto: DiffusionResultatsDto, utilisateur: AuthUser) {
    const deliberation = await this.prisma.deliberation.findUnique({
      where: { id: dto.deliberationId },
      include: {
        promotion: { include: { filiere: true } },
        lignes: {
          include: {
            inscription: { include: { etudiant: { select: { id: true, nom: true, prenom: true, telephone: true } } } },
          },
        },
      },
    });
    if (!deliberation) throw new NotFoundException('Délibération introuvable');
    if (deliberation.statut !== StatutDeliberation.VALIDEE) {
      throw new ConflictException(
        'Seuls des résultats validés par le jury peuvent être diffusés aux étudiants.',
      );
    }

    const libellePromotion = deliberation.promotion?.nom ?? 'Scolarité';
    const cibles = deliberation.lignes
      .filter((l) => l.decision === DecisionJury.ADMIS || l.decision === DecisionJury.AJOURNE)
      .map((l) => ({
        ligne: l,
        telephone: numerique(l.inscription.etudiant.telephone),
        nom: `${l.inscription.etudiant.prenom} ${l.inscription.etudiant.nom}`.trim(),
      }))
      .filter((c) => c.telephone.length >= 8)
      .map((c) => {
        const decision =
          c.ligne.decision === DecisionJury.ADMIS ? 'ADMIS' : 'AJOURNÉ';
        const rang = c.ligne.rang != null ? ` (rang ${c.ligne.rang})` : '';
        const corps =
          `Résultats — ${libellePromotion} : ${c.nom} : moyenne ` +
          `${c.ligne.moyenne.toFixed(2)} — ${decision}${rang}`;
        return {
          telephone: c.telephone,
          message: corps.slice(0, 160),
          motif: 'RESULTATS',
          destinataireNom: c.nom,
          etudiantId: c.ligne.inscription.etudiant.id,
          envoyeParId: utilisateur.id,
        };
      });

    if (!cibles.length) {
      throw new BadRequestException(
        'Aucun étudiant joignable : la délibération ne compte aucun admis ou ajourné avec un numéro valide.',
      );
    }

    return this.sms.envoyerPlusieurs(cibles);
  }

  /** Petit comptage par statut, pour le badge de la barre de navigation. */
  async stats() {
    const groupes = await this.prisma.notification.groupBy({
      by: ['statut'],
      _count: { _all: true },
    });
    const parStatut: Record<StatutNotification, number> = {
      [StatutNotification.EN_ATTENTE]: 0,
      [StatutNotification.ENVOYEE]: 0,
      [StatutNotification.ECHOUE]: 0,
    };
    for (const groupe of groupes) parStatut[groupe.statut] = groupe._count._all;
    const total = Object.values(parStatut).reduce((s, n) => s + n, 0);
    return { ...parStatut, total };
  }

  /** Délibérations validées, pour le sélecteur de la page de diffusion. */
  async deliberationsDisponibles() {
    const deliberations = await this.prisma.deliberation.findMany({
      where: { statut: StatutDeliberation.VALIDEE },
      include: {
        promotion: { include: { filiere: true } },
        annee: true,
        _count: { select: { lignes: true } },
      },
      orderBy: { valideeLe: 'desc' },
    });
    return deliberations.map((d) => ({
      id: d.id,
      session: d.session,
      statut: d.statut,
      tauxReussite: d.tauxReussite,
      valideeLe: d.valideeLe,
      annee: d.annee.libelle,
      promotion: d.promotion?.nom ?? '—',
      filiere: d.promotion?.filiere?.nom ?? null,
      lignes: d._count.lignes,
    }));
  }

  /**
   * Estimation du nombre de destinataires pour une diffusion à venir.
   * Utilisé par la page de diffusion pour prévisualiser l'impact.
   */
  async estimerDestinataires(mode?: string): Promise<number> {
    if (mode === 'tousInscrits' || mode === 'tous') {
      // Tous les étudiants inscrits (statut >= EN_ATTENTE_PAIEMENT sur l'année active)
      const annee = await this.prisma.anneeAcademique.findFirst({
        where: { active: true },
        select: { id: true },
      });
      if (!annee) return 0;
      const total = await this.prisma.inscription.count({
        where: {
          anneeId: annee.id,
          statut: { in: ['EN_ATTENTE_PAIEMENT', 'PAYEE', 'VALIDEE'] },
        },
      });
      // Soustraire ceux sans téléphone (un envoi SMS échouerait)
      const avecNumero = await this.prisma.etudiant.count({
        where: {
          inscriptions: { some: { anneeId: annee.id, statut: { in: ['EN_ATTENTE_PAIEMENT', 'PAYEE', 'VALIDEE'] } } },
          telephone: { not: null },
        },
      });
      return avecNumero;
    }
    if (mode === 'vacataires') {
      return await this.prisma.enseignant.count({
        where: { statut: 'VACATAIRE', actif: true, telephone: { not: null } },
      });
    }
    if (mode === 'enseignants') {
      return await this.prisma.enseignant.count({
        where: { actif: true, telephone: { not: null } },
      });
    }
    return 0;
  }

  /**
   * Répartition quotidienne des envois sur les N derniers jours.
   * Retourne un tableau de { date, EN_ATTENTE, ENVOYEE, ECHOUE } par jour calendaire.
   * Les jours sans envoi sont retournés avec 0 pour assurer la continuité du graphique.
   */
  async repartitionQuotidienne(jours: number): Promise<Array<{ date: string; EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number }>> {
    const depuis = new Date();
    depuis.setUTCDate(depuis.getUTCDate() - jours + 1);
    depuis.setUTCHours(0, 0, 0, 0);

    // Postgres date_trunc pour grouper par jour (UTC) — portable, performant
    const lignes = await this.prisma.$queryRaw<
      Array<{ jour: Date; statut: StatutNotification; n: bigint }>
    >`
      SELECT date_trunc('day', "createdAt") AS jour,
             statut,
             COUNT(*)::bigint AS n
      FROM "Notification"
      WHERE "createdAt" >= ${depuis}
      GROUP BY date_trunc('day', "createdAt"), statut
      ORDER BY jour ASC
    `;

    // Indexation par date ISO (YYYY-MM-DD)
    const parJour = new Map<string, { EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number }>();
    for (const l of lignes) {
      const cle = l.jour.toISOString().slice(0, 10);
      const cur = parJour.get(cle) ?? { EN_ATTENTE: 0, ENVOYEE: 0, ECHOUE: 0 };
      cur[l.statut] = Number(l.n);
      parJour.set(cle, cur);
    }

    // Compléter avec les jours manquants pour assurer la continuité
    const sortie: Array<{ date: string; EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number }> = [];
    for (let i = 0; i < jours; i++) {
      const d = new Date(depuis);
      d.setUTCDate(d.getUTCDate() + i);
      const cle = d.toISOString().slice(0, 10);
      const cur = parJour.get(cle) ?? { EN_ATTENTE: 0, ENVOYEE: 0, ECHOUE: 0 };
      sortie.push({ date: cle, ...cur });
    }
    return sortie;
  }
}