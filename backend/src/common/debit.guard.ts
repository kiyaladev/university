import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limitation de débit par adresse réelle.
 *
 * Le garde d'origine suit `req.ips[0]`, c'est-à-dire la valeur la plus à gauche
 * de `X-Forwarded-For` — celle que le client a lui-même écrite. Il suffit alors
 * de changer cet en-tête à chaque essai pour repartir d'un compteur neuf, et la
 * limite de connexion ne protège plus rien.
 *
 * `req.ip` est calculé par Express à partir de `trust proxy` : c'est l'adresse
 * ajoutée par nginx, celle de la vraie socket, que le client ne contrôle pas.
 *
   * Une session authentifiée compte pour elle-même. L'identité vient de
   * `req.user`, déjà validée par JwtAuthGuard, jamais d'un Bearer fourni par le
   * client : les routes publiques restent ainsi comptées par adresse réelle.
 */
@Injectable()
export class DebitGuard extends ThrottlerGuard {
  /**
   * La limite de connexion se compte par compte visé, pas seulement par
   * adresse. Sans cela, une faculté entière derrière un même NAT partagerait
   * dix connexions par quart d'heure : le onzième contrôleur de la matinée ne
   * pourrait plus ouvrir sa tournée. Compter par (adresse, compte) laisse
   * chacun se tromper de mot de passe sans gêner ses collègues, tandis que le
   * verrouillage de compte, lui, suit le compte où qu'on l'attaque.
   */
  protected generateKey(context: ExecutionContext, suffixe: string, nom: string): string {
    const base = super.generateKey(context, suffixe, nom);
    if (nom !== 'connexion') return base;

    const requete = context.switchToHttp().getRequest();
    const compte = String(requete.body?.email ?? '').toLowerCase().trim();
    return `${base}:${compte}`;
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return Promise.resolve('u:' + userId);
    }
    return Promise.resolve('ip:' + (req.ip ?? req.socket?.remoteAddress ?? 'inconnu'));
  }
}
