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
}