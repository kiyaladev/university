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
 * Ces deux fonctions concentrent la règle pour que les trois référentiels
 * concernés (enseignants, matières, affectations) ne dérivent pas entre eux.
 */

export function estChefDeDepartement(user: AuthUser): boolean {
  return user.role === Role.CHEF_DEPARTEMENT;
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
