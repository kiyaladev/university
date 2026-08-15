import { ExecutionContext, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
 * Une session identifiée compte pour elle-même. Sans cela, une faculté entière
 * derrière un même NAT — le cas normal dans une université guinéenne — partage
 * un seul compteur, et le vingtième contrôleur à ouvrir l'application se fait
 * refuser à cause des dix-neuf autres. Le jeton n'est jamais lu ni déchiffré :
 * seule son empreinte sert de clé de comptage.
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
    const jeton = String(req.headers?.authorization ?? '');
    if (jeton.startsWith('Bearer ')) {
      return Promise.resolve(
        's:' + createHash('sha256').update(jeton.slice(7)).digest('base64url').slice(0, 22),
      );
    }
    return Promise.resolve('ip:' + (req.ip ?? req.socket?.remoteAddress ?? 'inconnu'));
  }
}
