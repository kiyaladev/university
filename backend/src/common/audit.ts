import type { Prisma } from '@prisma/client';
import type { AuthUser } from './decorators';

/**
 * Écriture d'une ligne du journal d'audit (`AuditLog`).
 *
 * Remplace les variantes privées `journaliser` que chaque module recopiait.
 * La ligne produite est strictement celle qu'elles écrivaient :
 * `{ userId, action, entite, entiteId, details }`, plus `ip` quand l'appelant
 * l'a fourni.
 *
 * - `client` : la transaction de la mutation (`tx`) de préférence, pour que
 *   l'état et sa trace soient committés ensemble, ou `PrismaService` ;
 * - `user` : l'acteur, ou `null` pour un traitement sans acteur (tâche
 *   planifiée, moteur de détection, dépôt anonyme) — `userId` vaut alors `null` ;
 * - `details` : un objet est sérialisé en JSON (format lu par l'écran
 *   « Journal ») ; une chaîne est écrite telle quelle ; absent, le champ
 *   n'est pas écrit ;
 * - `ip` : l'adresse de l'appelant, quand elle est connue. Elle est réservée
 *   à l'exploitation serveur : l'écran « Journal » ne l'affiche pas.
 */
export type ClientAudit = Pick<Prisma.TransactionClient, 'auditLog'>;

export function journaliser(
  client: ClientAudit,
  user: Pick<AuthUser, 'id'> | null,
  action: string,
  entite: string,
  entiteId: string | null,
  details?: unknown,
  ip?: string | null,
) {
  return client.auditLog.create({
    data: {
      userId: user ? user.id : null,
      action,
      entite,
      entiteId,
      ...(details === undefined ? {} : { details: typeof details === 'string' ? details : JSON.stringify(details) }),
      ...(ip ? { ip } : {}),
    },
  });
}

/**
 * Format avant/après commun aux modules : `{ avant, apres, ...complement }`
 * (ex. `champsModifies`), dans cet ordre de clés.
 */
export function avantApres(avant: unknown, apres: unknown, complement?: Record<string, unknown>) {
  return { avant, apres, ...complement };
}
