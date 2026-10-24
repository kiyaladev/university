import { creer, lire, lister } from '@/shared/services/http';
import type { Liste, Notification } from '@/types';

/**
 * Diffusion de notifications SMS (`/notifications`).
 *
 * - `GET /notifications` : l'historique paginé des envois.
 * - `POST /notifications` : une diffusion (à tous les inscrits, à une liste de
 *   numéros, ou une simulation d'essai).
 * - `GET /notifications/destinataires/estimes` : le nombre de destinataires
 *   d'un mode de diffusion, pour annoncer la portée avant l'envoi.
 * - `GET /notifications/deliberations` : les délibérations dont les résultats
 *   peuvent être diffusés.
 * - `POST /notifications/resultats-deliberation` : la diffusion des résultats.
 * - `GET /notifications/stats` et `/notifications/stats/repartition` : les
 *   compteurs et la courbe des trente derniers jours.
 */

/** Corps d'une diffusion de notification. */
export interface CorpsNotification {
  message: string;
  motif: string;
  mode?: 'tousInscrits' | 'manuel';
  tousInscrits?: boolean;
  destinatairesTelephones?: string[];
  /** Un envoi de test ne part pas : la passerelle ne fait que le simuler. */
  simulation?: boolean;
}

/** Résumé d'un envoi : combien de messages sont partis, combien ont échoué. */
export interface ResumeEnvoi {
  total: number;
  envoyees: number;
  echouees: number;
}

/** Nombre de destinataires estimation pour un mode de diffusion. */
export interface EstimationDestinataires {
  total: number;
}

/** Une délibération dont les résultats peuvent être diffusés. */
export interface DeliberationDiffusion {
  id: string;
  session: string;
  annee: string;
  promotion: string;
  lignes: number;
}

/** Compteurs d'envois par statut. */
export interface StatsNotifications {
  EN_ATTENTE: number;
  ENVOYE: number;
  ECHOUE: number;
}

/** Répartition quotidienne des envois sur une période. */
export interface RepartitionNotifications {
  date: string;
  EN_ATTENTE: number;
  ENVOYE: number;
  ECHOUE: number;
}

/** Filtres de l'historique des envois. */
export type ParamsHistoriqueNotifications = {
  page?: number;
  pageSize?: number;
  all?: string;
  statut?: string;
  search?: string;
  dateDebut?: string;
  dateFin?: string;
};

export const notificationsService = {
  /** Historique paginé des notifications envoyées. */
  historique: (params: ParamsHistoriqueNotifications = {}) => lister<Notification>('/notifications', params),

  /** Envoie une notification (diffusion, renvoi ou simulation d'essai). */
  envoyer: (corps: CorpsNotification) => creer<ResumeEnvoi>('/notifications', corps),

  /** Nombre de destinataires estimation pour un mode de diffusion. */
  estimerDestinataires: (mode: 'tousInscrits' | 'manuel' = 'tousInscrits') =>
    lire<EstimationDestinataires>('/notifications/destinataires/estimes', { mode }),

  /** Délibérations dont les résultats peuvent être diffusés. */
  deliberations: () => lire<DeliberationDiffusion[]>('/notifications/deliberations'),

  /** Diffuse les résultats d'une délibération. */
  diffuserResultats: (deliberationId: string) =>
    creer<ResumeEnvoi>('/notifications/resultats-deliberation', { deliberationId }),

  /** Compteurs d'envois par statut. */
  stats: () => lire<StatsNotifications>('/notifications/stats'),

  /** Répartition quotidienne des envois sur les derniers jours. */
  repartition: (jours = 30) => lire<RepartitionNotifications[]>('/notifications/stats/repartition', { jours }),
};

/** Une liste de notifications est déjà une page : on l'expose telle quelle. */
export type PageNotifications = Liste<Notification>;
