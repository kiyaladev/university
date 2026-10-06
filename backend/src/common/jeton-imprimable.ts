import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { t } from './i18n';
import type { Request } from 'express';

/**
 * Les routes d'impression sont `@Public()` : la garde globale n'y remplit donc
 * pas `req.user`, et le contrôleur doit vérifier le jeton lui-même.
 *
 * On lit d'abord l'en-tête `Authorization` et seulement ensuite `?token=`.
 * L'en-tête est le seul mode sûr : un jeton en query string finit dans
 * l'historique du navigateur, dans l'en-tête `Referer` de toutes les
 * navigations suivantes et dans les journaux du serveur. Le paramètre reste
 * accepté pour les liens déjà diffusés et pour les usages hors navigateur
 * (impression directe depuis un navigateur sans en-tête).
 */
export function jetonImprimable(req: Request): string | undefined {
  const entete = req.headers.authorization;
  if (entete?.startsWith('Bearer ')) return entete.slice(7).trim();

  const parametre = (req.query as Record<string, unknown> | undefined)?.token;
  return typeof parametre === 'string' && parametre.length ? parametre : undefined;
}

/**
 * Vérifie le jeton d'une route imprimable et renvoie sa charge utile.
 * Lève un 401 explicite plutôt que de laisser remonter l'erreur de `jwt`.
 */
export function verifierJetonImprimable(
  jwt: JwtService,
  req: Request,
  options?: Record<string, unknown>,
): Record<string, any> {
  try {
    return jwt.verify(jetonImprimable(req) ?? '', options);
  } catch {
    throw new UnauthorizedException(t('scolarite.jeton_invalide_ou_expire'));
  }
}
