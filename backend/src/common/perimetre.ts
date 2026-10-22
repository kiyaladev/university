import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from './decorators';

/**
 * Périmètre d'un chef de département.
 *
 * Les référentiels bornaient la *lecture* au département du demandeur mais
 * confiaient l'*écriture* à `CrudService`, qui applique le DTO tel quel : un
 * chef de département pouvait alors réécrire une fiche d'un autre département,
 * y compris en changeant son `departementId` — c'est-à-dire en faisant sortir
 * la fiche de son propre périmètre, ou en la désactivant.
 *
 * Ces fonctions concentrent la règle pour que les trois référentiels
 * concernés (enseignants, matières, affectations) ne dérivent pas entre eux.
 */

export function estChefDeDepartement(
  user: AuthUser | null | undefined,
): user is AuthUser & { role: typeof Role.CHEF_DEPARTEMENT } {
  return user?.role === Role.CHEF_DEPARTEMENT;
}

/**
 * Valeur sentinelle d'un chef de département sans département rattaché :
 * aucun identifiant réel ne lui correspond, la liste filtrée est donc vide
 * au lieu de s'ouvrir à tous les départements.
 */
export const AUCUN_DEPARTEMENT = '__aucun__';

/**
 * Fragment `where` Prisma qui borne une lecture au département d'un chef de
 * département ; `{}` pour tout autre rôle (ou sans utilisateur).
 *
 * @param chemin relations à traverser jusqu'au champ `departementId`, séparées
 *   par des points (ex. `'affectation.promotion.filiere'`) ; vide pour un
 *   `departementId` porté par l'entité elle-même.
 * @param sentinelle valeur retenue quand le chef n'a pas de département.
 *
 * @example filtreDepartement(chef, 'promotion.filiere')
 *   // { promotion: { filiere: { departementId: chef.departementId ?? '__aucun__' } } }
 */
export function filtreDepartement(
  user: AuthUser | null | undefined,
  chemin = '',
  sentinelle: string = AUCUN_DEPARTEMENT,
): Record<string, any> {
  if (!user || !estChefDeDepartement(user)) return {};
  let fragment: Record<string, any> = { departementId: user.departementId ?? sentinelle };
  for (const relation of chemin.split('.').filter(Boolean).reverse()) {
    fragment = { [relation]: fragment };
  }
  return fragment;
}

/**
 * Vérifie qu'un chef de département n'agit que sur son propre département.
 * Les autres rôles (ADMIN, SCOLARITE, DIRECTION) gardent l'accès complet.
 *
 * @param departementId département de la fiche visée, ou de la fiche créée.
 */
export function exigerPerimetre(user: AuthUser, departementId?: string | null): void {
  if (!estChefDeDepartement(user)) return;
  if (departementId && departementId === user.departementId) return;
  throw new ForbiddenException();
}
