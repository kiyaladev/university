/**
 * Montants : conversion entre le stockage exact et le domaine applicatif.
 *
 * Les colonnes monétaires sont des `numeric(14,2)` : le serveur les stocke et
 * les additionne exactement (un `sum()` sur `numeric` est exact, sur
 * `double precision` il ne l'est pas). Côté TypeScript, Prisma renvoie ces
 * colonnes sous forme d'objets `Prisma.Decimal` — qui ne sont PAS des nombres
 * et qui se sérialisent en chaîne si on les laisse passer.
 *
 * La règle du projet est donc la suivante, appliquée partout :
 *
 *   • dans le domaine applicatif, un montant est un `number` (GNF, deux
 *     décimales) — `toMontant()` fait le passage ;
 *   • à la sortie HTTP, un montant repart en `number` — jamais en chaîne, le
 *     frontend attend des nombres ;
 *   • à l'écriture, on laisse Prisma convertir le nombre (ou `toDecimal()` si
 *     l'on veut expliciter le type).
 *
 * Deux faut-il se souvenir des deux décimales de la colonne `numeric(14,2)` :
 * `toMontant()` ne arrondit pas, il convertit. La colonne a déjà arrondi à
 * l'enregistrement ; arrondir une seconde fois en JavaScript pourrait
 * déplacer un montant d'un centime sur les valeurs hautes.
 */
import { Prisma } from '@prisma/client';

/** Un montant dans le domaine applicatif : nombre en GNF, deux décimales. */
export type Montant = number;

/** Décimales conservées par les colonnes monétaires `numeric(14,2)`. */
export const DECIMALES_MONTANT = 2;

/**
 * Vrai si la valeur est un `Prisma.Decimal` (objet decimal.js).
 *
 * La double détection — `instanceof` puis contrôle de forme — protège contre
 * une seconde copie de decimal.js dans l'arbre de dépendances : le cas est
 * rare, mais le symptôme (un montant sérialisé en chaîne) serait silencieux.
 */
export function estDecimal(valeur: unknown): valeur is Prisma.Decimal {
  if (valeur instanceof Prisma.Decimal) return true;
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return false;
  const candidat = valeur as { toFixed?: unknown; toNumber?: unknown };
  return typeof candidat.toFixed === 'function' && typeof candidat.toNumber === 'function';
}

/**
 * Convertit un montant stocké (`Prisma.Decimal`) ou déjà numérique en nombre
 * du domaine. `null`/`undefined` valent zéro.
 */
export function toMontant(valeur: Prisma.Decimal | number | string | null | undefined): Montant {
  if (valeur === null || valeur === undefined) return 0;
  if (typeof valeur === 'number') return valeur;
  if (typeof valeur === 'string') return Number(valeur);
  return valeur.toNumber();
}

/**
 * Convertit un montant du domaine en `Prisma.Decimal` pour l'écriture.
 * L'écriture accepte déjà un nombre ; cette fonction sert aux endroits où
 * le type doit être explicite (agrégats, SQL brut).
 */
export function toDecimal(valeur: Montant | Prisma.Decimal | string | null | undefined): Prisma.Decimal {
  if (valeur === null || valeur === undefined) return new Prisma.Decimal(0);
  if (valeur instanceof Prisma.Decimal) return valeur;
  return new Prisma.Decimal(valeur);
}

/**
 * Convertit récursivement les `Prisma.Decimal` d'une charge utile en nombres.
 *
 * C'est la filet de sécurité de la sortie HTTP : un service peut renvoyer
 * une entité Prisma telle quelle, et le montant part alors en `number`
 * (`1234.5`) au lieu de la chaîne (`"1234.5"`) que `JSON.stringify` produirait
 * sur un `Decimal`. Les objets sans montant sont renvoyés tels quels : rien
 * n'est recopié, rien n'est réécrit.
 */
export function montantsEnNombres(valeur: unknown): unknown {
  if (estDecimal(valeur)) return valeur.toNumber();
  if (Array.isArray(valeur)) {
    let modifie = false;
    const sortie = valeur.map((item) => {
      const converti = montantsEnNombres(item);
      if (converti !== item) modifie = true;
      return converti;
    });
    return modifie ? sortie : valeur;
  }
  if (!valeur || typeof valeur !== 'object') return valeur;
  if (valeur instanceof Date || Buffer.isBuffer(valeur)) return valeur;
  let modifie = false;
  const sortie: Record<string, unknown> = {};
  for (const [cle, item] of Object.entries(valeur as Record<string, unknown>)) {
    const converti = montantsEnNombres(item);
    if (converti !== item) modifie = true;
    sortie[cle] = converti;
  }
  return modifie ? sortie : valeur;
}
