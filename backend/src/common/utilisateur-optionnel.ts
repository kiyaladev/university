import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './decorators';

/**
 * Authentification optionnelle : la route reste publique, mais l'utilisateur
 * est résolu si la requête porte un jeton valide.
 *
 * Deux routes en avaient besoin :
 * - la vitrine de la bibliothèque, où un visiteur sans jeton voit le fonds
 *   public et un membre du staff voit le fonds complet ;
 * - le poste de guichet du restaurant, dont l'appareil de scan porte un jeton
 *   mais ne peut pas être authentifié par la garde globale.
 *
 * La résolution est faite par `JwtAuthGuard` (Passport), qui contrôle la
 * signature, l'activité du compte et la révocation des sessions. Elle est
 * stockée dans `request.utilisateurOptionnel` et **pas** dans `request.user` :
 * la route reste publique, donc les gardes qui lisent `request.user`
 * (lecture seule du registre enseignant, limitation de débit par compte)
 * doivent voir exactement ce qu'elles voyaient avant.
 */
export const UTILISATEUR_OPTIONNEL_KEY = 'utilisateurOptionnel';

/** Marque une route publique dont l'utilisateur est résolu s'il y a un jeton. */
export const AuthentificationOptionnelle = () => SetMetadata(UTILISATEUR_OPTIONNEL_KEY, true);

/**
 * Paramètre de handler : l'utilisateur résolu sur une route
 * `@AuthentificationOptionnelle()`, sinon `undefined`.
 *
 * Un jeton absent, invalide ou expiré ne fait jamais échouer la requête :
 * la route est publique, un visiteur reste un visiteur.
 */
export const UtilisateurOptionnel = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const utilisateur = request.utilisateurOptionnel as AuthUser | undefined;
  return data ? utilisateur?.[data] : utilisateur;
});
