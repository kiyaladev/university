/**
 * Numéros séquentiels lisibles (« 2026-0042 », « INS-2026-00007 »).
 *
 * Une dizaine de modules avaient chacun réécrit la même boucle : charger toutes
 * les lignes du préfixe, prendre le plus grand suffixe, l'incrémenter. Deux
 * problèmes avec dix copies : le comportement divergeait d'un module à l'autre
 * (largeurs, colonnes, préfixes), et toute correction devait être répétée
 * dix fois. La boucle ci-dessous est celle qui était la plus répandue et la
 * plus stricte : maximum **numérique**, en ignorant les lignes qui ne suivent
 * pas le format attendu.
 *
 * Contrainte connue, conservée telle quelle : le maximum est calculé en
 * ramenant les lignes du préfixe en mémoire. Passer à un tri en base serait plus
 * rapide, mais un tri lexicographique se trompe sur des largeurs inégales
 * (« 999 » > « 1000 » en texte). Le vrai correctif est une séquence SQL par
 * préfixe, pas un raccourci sur cette fonction.
 */
import type { Prisma } from '@prisma/client';

/** Délègue Prisma minimal : un `findMany` avec `select`. */
export interface Numerotable {
  findMany(args: unknown): Promise<Array<Record<string, string>>>;
}

/**
 * Prochain numéro pour `prefixe` + largeur, porté par le champ `champ`.
 * Accepte un delegate comme une transaction (`tx.x`) ou le client direct.
 */
export async function prochainNumero(
  delegate: Numerotable,
  champ: string,
  prefixe: string,
  largeur: number,
): Promise<string> {
  const existantes = await delegate.findMany({
    where: { [champ]: { startsWith: prefixe } },
    select: { [champ]: true },
  });

  const max = existantes.reduce((m: number, ligne: Record<string, string>) => {
    const n = Number(ligne[champ].slice(prefixe.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);

  return `${prefixe}${String(max + 1).padStart(largeur, '0')}`;
}

/**
 * Variante transactionnelle : même calcul, sur le client d'une transaction.
 * `modele` est typé comme une clé du client Prisma, donc l'appel reste vérifié
 * par le compilateur (une faute de frappe sur un nom de modèle ne compile pas).
 */
export function prochainNumeroTx(
  tx: Prisma.TransactionClient,
  modele: keyof Prisma.TransactionClient & string,
  champ: string,
  prefixe: string,
  largeur: number,
): Promise<string> {
  return prochainNumero(tx[modele] as unknown as Numerotable, champ, prefixe, largeur);
}
