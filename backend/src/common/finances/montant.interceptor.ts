/**
 * Sortie HTTP : les montants repartent en nombres, jamais en chaînes.
 *
 * Les colonnes monétaires sont `numeric(14,2)` ; Prisma les renvoie comme des
 * objets `Prisma.Decimal`. Laissés tels quels, `JSON.stringify` les
 * sérialiserait en chaîne (`"1234.5"`) et le frontend — qui attend des
 * nombres — afficherait « 1234.5 » sans formatage, casserait les
 * comparaisons et les calculs d'affichage.
 *
 * Ce convertisseur passe en revue la réponse HTTP et remplace chaque
 * `Prisma.Decimal` par son nombre. Il est global : une seule règle, valable
 * pour les treize modèles porteurs de montants, plutôt qu'une conversion
 * répétée sur chaque route — et il rattrape le service qui aurait oublié.
 *
 * Les services, eux, convertissent explicitement (`toMontant()`) là où le
 * montant sert à un calcul ou à un formatage ; voir `common/finances/montant.ts`.
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { montantsEnNombres } from './montant';

@Injectable()
export class MontantInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((valeur) => montantsEnNombres(valeur)));
  }
}
