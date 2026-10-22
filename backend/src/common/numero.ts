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

/**
 * Année portée par un numéro (« INS-2026-… », « ATT-2025-… », « DOC-2026-… »).
 *
 * Règle : l'année est lue dans le libellé de l'année scolaire (« 2025-2026 »)
 * quand il est fourni et bien formé, sinon c'est l'année civile courante
 * (heure du serveur). `borne` choisit la moitié du libellé :
 *
 *  - `fin` (défaut) : 2025-2026 → 2026. Matricules, dossiers INS-, paiements
 *    de scolarité PAY-, recharges resto PAY-R- ;
 *  - `debut` : 2025-2026 → 2025. Attestations ATT- ;
 *  - sans libellé : année civile. Demandes de documents DOC- (et leur PAY-),
 *    réclamations, tickets helpdesk, badges, paiements de formation PAY-F-.
 *
 * Les recettes externes (PAY-X-) prennent l'année civile UTC de la date de la
 * recette, pas celle du jour : elles n'utilisent pas cette fonction.
 *
 * Ces règles divergentes sont historiques et chaque module garde la sienne :
 * en changer romprait la séquence des numéros déjà émis sous l'ancienne
 * année. Les harmoniser relève d'une décision métier.
 */
export function anneeNumero(libelleAnnee?: string | null, borne: 'debut' | 'fin' = 'fin'): string {
  const partie = libelleAnnee?.split('-')[borne === 'debut' ? 0 : 1]?.trim();
  if (partie && /^\d{4}$/.test(partie)) return partie;
  return String(new Date().getFullYear());
}
