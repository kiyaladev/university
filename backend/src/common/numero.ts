/**
 * Numéros séquentiels lisibles (« 2026-0042 », « INS-2026-00007 »).
 *
 * Une dizaine de modules avaient chacun réécrit la même boucle : charger toutes
 * les lignes du préfixe, prendre le plus grand suffixe, l'incrémenter. Deux
 * problèmes avec dix copies : le comportement divergeait d'un module à l'autre
 * (largeurs, colonnes, préfixes), et toute correction devait être répétée dix
 * fois. La boucle ci-dessous est celle qui était la plus répandue et la plus
 * stricte : maximum **numérique**, en ignorant les lignes qui ne suivent pas
 * le format attendu.
 *
 * Deux décisions structurent ce fichier (voir `docs/architecture.md`,
 * section « Numérotation ») :
 *
 *  1. **Une table unique des séries** (`SERIES_NUMERO`) : chaque préfixe y est
 *     déclaré avec son module, son champ, sa largeur et son millésime. Un
 *     préfixe appartient à un seul module : plus jamais deux portefeuilles
 *     (inscriptions et demandes de documents) ne partagent `PAY-`, donc plus
 *     jamais de collision ni d'ambiguïté d'origine.
 *  2. **Une lecture au lieu d'un chargement** : une seule ligne est lue (la
 *     plus grande référence du préfixe) au lieu de toutes les lignes du préfixe.
 *
 * Contrainte connue, conservée telle quelle : l'ordre lexicographique de la
 * colonne n'est l'ordre numérique que parce que la séquence est à zéros
 * initiaux de largeur fixe. Le vrai correctif au-delà de 99 999 numéros par
 * série reste une séquence SQL par préfixe, pas un raccourci sur cette
 * fonction.
 */
import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { t } from './i18n';

/** Délègue Prisma minimal : un `findMany` avec `where`, `orderBy` et `select`. */
export interface Numerotable {
  findMany(args: unknown): Promise<Array<Record<string, string>>>;
}

/**
 * Modèle Prisma porteur d'une référence numérotée. Le compilateur refuse un
 * nom de modèle inexistant : une faute de frappe ne passe pas en revue.
 */
export type ModeleNumerique = keyof Prisma.TransactionClient & string;

/**
 * Origine du millésime d'une série :
 *
 *  - `fin` : année universitaire de fin (« 2025-2026 » → 2026) ;
 *  - `debut` : année universitaire de début (« 2025-2026 » → 2025) ;
 *  - `civile` : année civile, sans rattachement à une année universitaire.
 */
export type MillesimeSerie = 'fin' | 'debut' | 'civile';

/** Description d'une série numérotée : `<PRÉFIXE>-<MILLÉSIME>-<SÉQUENCE>`. */
export interface SerieNumerique {
  /** Préfixe imprimé devant le millésime (« INS- », « PAY-D- »…). */
  prefixe: string;
  /** Modèle Prisma qui porte la référence. */
  modele: ModeleNumerique;
  /** Champ qui porte la référence dans ce modèle. */
  champ: 'numero' | 'reference' | 'matricule';
  /** Nombre de chiffres de la séquence. */
  largeur: number;
  /** Origine du millésime, figée pour la série. */
  millesime: MillesimeSerie;
}

/**
 * Table unique des séries numérotées.
 *
 * Règles de rédaction :
 *
 *  - **un préfixe = un module**. Les cinq portefeuilles de paiement ont chacun
 *    leur préfixe (`PAY-`, `PAY-D-`, `PAY-F-`, `PAY-R-`, `PAY-X-`) : une
 *    référence dit d'où elle vient ;
 *  - **un préfixe = un millésime**. La divergence historique (année de fin
 *    pour la scolarité, année de début pour les attestations, année civile
 *    ailleurs) est déclarée ici, elle n'est plus décidée au cas par cas dans
 *    les services ;
 *  - **un préfixe = une largeur**. La séquence est à zéros initiaux, ce qui
 *    rend l'ordre lexicographique de la colonne égal à l'ordre numérique.
 *
 * Le préfixe d'un nouveau module est choisi sans recouvrement avec les
 * préfixes voisins (`PAY-` et `PAY-D-` ne se confondent pas : le millésime
 * suit le préfixe, `PAY-2026-` ne commence pas `PAY-D-2026-`).
 */
export const SERIES_NUMERO = {
  /** Matricule d'étudiant : « 2026-0001 » (pas de préfixe, l'année ouvre). */
  MATRICULE: { prefixe: '', modele: 'etudiant', champ: 'matricule', largeur: 4, millesime: 'fin' },
  /** Dossier d'inscription : « INS-2026-00001 ». */
  INSCRIPTION: { prefixe: 'INS-', modele: 'inscription', champ: 'numero', largeur: 5, millesime: 'fin' },
  /** Paiement de scolarité : « PAY-2026-00001 ». */
  PAIEMENT_INSCRIPTION: {
    prefixe: 'PAY-',
    modele: 'paiement',
    champ: 'reference',
    largeur: 5,
    millesime: 'fin',
  },
  /** Paiement d'une demande de document : « PAY-D-2026-00001 ». */
  PAIEMENT_DOCUMENT_DEMANDE: {
    prefixe: 'PAY-D-',
    modele: 'paiement',
    champ: 'reference',
    largeur: 5,
    millesime: 'civile',
  },
  /** Paiement d'une formation continue : « PAY-F-2026-00001 ». */
  PAIEMENT_FORMATION: {
    prefixe: 'PAY-F-',
    modele: 'paiement',
    champ: 'reference',
    largeur: 5,
    millesime: 'civile',
  },
  /** Recharge de restaurant : « PAY-R-2026-00001 ». */
  PAIEMENT_RESTAURATION: {
    prefixe: 'PAY-R-',
    modele: 'paiement',
    champ: 'reference',
    largeur: 5,
    millesime: 'fin',
  },
  /** Encaissement d'une recette externe : « PAY-X-2026-00001 ». */
  PAIEMENT_RECETTE: {
    prefixe: 'PAY-X-',
    modele: 'paiement',
    champ: 'reference',
    largeur: 5,
    millesime: 'civile',
  },
  /** Demande de document : « DOC-2026-00001 ». */
  DOCUMENT_DEMANDE: {
    prefixe: 'DOC-',
    modele: 'demandeDocument',
    champ: 'numero',
    largeur: 5,
    millesime: 'civile',
  },
  /** Attestation : « ATT-2025-00001 » (millésime = année de début). */
  ATTESTATION: {
    prefixe: 'ATT-',
    modele: 'attestation',
    champ: 'numero',
    largeur: 5,
    millesime: 'debut',
  },
  /** Inscription à une formation continue : « FOR-2026-00001 ». */
  FORMATION: {
    prefixe: 'FOR-',
    modele: 'inscriptionFormation',
    champ: 'numero',
    largeur: 5,
    millesime: 'civile',
  },
  /** Ticket de support : « TKT-2026-0001 » (largeur 4). */
  TICKET_SUPPORT: {
    prefixe: 'TKT-',
    modele: 'ticketSupport',
    champ: 'numero',
    largeur: 4,
    millesime: 'civile',
  },
  /** Réclamation : « REC-2026-00001 ». */
  RECLAMATION: {
    prefixe: 'REC-',
    modele: 'reclamation',
    champ: 'numero',
    largeur: 5,
    millesime: 'civile',
  },
  /** Badge d'accès : « BADGE-2026-00001 ». */
  BADGE_ACCES: {
    prefixe: 'BADGE-',
    modele: 'badgeAcces',
    champ: 'numero',
    largeur: 5,
    millesime: 'civile',
  },
} as const satisfies Record<string, SerieNumerique>;

/** Préfixe complet d'une série : préfixe + millésime + tiret. */
export function prefixeSerie(serie: SerieNumerique, annee: string): string {
  return `${serie.prefixe}${annee}-`;
}

/**
 * Millésime d'une série : l'**année de rattachement** du document.
 *
 *  - série rattachée à une année universitaire : l'année de fin (« fin »,
 *    scolarité) ou de début (« debut », attestations) du libellé
 *    « 2025-2026 » ;
 *  - série sans rattachement : l'année civile de l'émission.
 *
 * Le libellé est facultatif : sans libellé exploitable, on retombe sur
 * l'année civile, comme toujours.
 */
export function millesimeSerie(serie: SerieNumerique, libelleAnnee?: string | null): string {
  return serie.millesime === 'civile' ? anneeNumero() : anneeNumero(libelleAnnee, serie.millesime);
}

/**
 * Bornes de la plage des références d'une série : la séquence attendue, à
 * zéros initiaux de largeur fixe. Toute référence comprise entre ces bornes a
 * la forme `préfixe + suite de chiffres` ; l'ordre lexicographique de la
 * colonne y est donc l'ordre numérique.
 */
function bornesSerie(prefixe: string, largeur: number): { gte: string; lte: string } {
  return { gte: `${prefixe}${'0'.repeat(largeur)}`, lte: `${prefixe}${'9'.repeat(largeur)}` };
}

/**
 * Maximum numérique des suffixes lisibles d'un lot de références. Renvoie
 * `null` quand aucune ligne du lot n'est une référence de la série : les
 * lignes saisies à la main ou venues d'une ancienne numérotation sont
 * ignorées, elles ne font pas dévier la série.
 */
function maxNumerique(lignes: Array<Record<string, string>>, champ: string, prefixe: string): number | null {
  let max: number | null = null;
  for (const ligne of lignes) {
    const suffixe = typeof ligne?.[champ] === 'string' ? String(ligne[champ]).slice(prefixe.length) : '';
    if (!suffixe) continue;
    const n = Number(suffixe);
    if (!Number.isFinite(n)) continue;
    max = max === null ? n : Math.max(max, n);
  }
  return max;
}

/**
 * Prochain numéro pour `prefixe` + largeur, porté par le champ `champ`.
 * Accepte un delegate comme une transaction (`tx.x`) ou le client direct.
 *
 * Une seule ligne est lue : la plus grande référence de la série
 * (`orderBy` décroissant + `take: 1`, bornes de la plage de largeur fixe).
 * L'ordre lexicographique de la colonne est l'ordre numérique parce que la
 * séquence est à zéros initiaux de largeur fixe.
 *
 * La lecture est bornée : la base ne renvoie plus toutes les lignes du
 * préfixe, seulement la plus grande. Si cette ligne n'est pas une référence de
 * la série (saisie manuelle, ancienne numérotation), la lecture est élargie à
 * un lot limité pour rester tolérant et ne pas repartir de zéro.
 */
export async function prochainNumero(
  delegate: Numerotable,
  champ: string,
  prefixe: string,
  largeur: number,
): Promise<string> {
  const lignes = await delegate.findMany({
    where: { [champ]: { startsWith: prefixe, ...bornesSerie(prefixe, largeur) } },
    orderBy: { [champ]: 'desc' },
    take: 1,
    select: { [champ]: true },
  });

  let max = lignes.length > 0 ? maxNumerique(lignes, champ, prefixe) : 0;
  if (max === null) {
    const lot = await delegate.findMany({
      where: { [champ]: { startsWith: prefixe } },
      orderBy: { [champ]: 'desc' },
      take: 32,
      select: { [champ]: true },
    });
    max = maxNumerique(lot, champ, prefixe) ?? 0;
  }

  return `${prefixe}${String(max + 1).padStart(largeur, '0')}`;
}

/**
 * Variante transactionnelle : même calcul, sur le client d'une transaction.
 * `modele` est typé comme une clé du client Prisma, donc l'appel reste vérifié
 * par le compilateur (une faute de frappe sur un nom de modèle ne compile pas).
 */
export function prochainNumeroTx(
  tx: Prisma.TransactionClient,
  modele: ModeleNumerique,
  champ: string,
  prefixe: string,
  largeur: number,
): Promise<string> {
  return prochainNumero(tx[modele] as unknown as Numerotable, champ, prefixe, largeur);
}

/**
 * Prochain numéro d'une série déclarée dans `SERIES_NUMERO` : le préfixe, le
 * champ et la largeur viennent de la table, l'appelant ne fournit que le
 * millésime.
 */
export function prochainNumeroSerie(
  tx: Prisma.TransactionClient,
  serie: SerieNumerique,
  annee: string,
): Promise<string> {
  return prochainNumeroTx(tx, serie.modele, serie.champ, prefixeSerie(serie, annee), serie.largeur);
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
 *  - sans libellé : année civile. Demandes de documents DOC- (et leur PAY-D-),
 *    réclamations, tickets helpdesk, badges, paiements de formation PAY-F-.
 *
 * Les recettes externes (PAY-X-) prennent l'année civile UTC de la date de la
 * recette, pas celle du jour : elles n'utilisent pas cette fonction.
 *
 * Quelle moitié du libellé s'applique est une propriété de la série, pas du
 * module qui émet le numéro : c'est `SERIES_NUMERO` qui le déclare.
 */
export function anneeNumero(libelleAnnee?: string | null, borne: 'debut' | 'fin' = 'fin'): string {
  const partie = libelleAnnee?.split('-')[borne === 'debut' ? 0 : 1]?.trim();
  if (partie && /^\d{4}$/.test(partie)) return partie;
  return String(new Date().getFullYear());
}

/**
 * Options de {@link avecNumeroUnique}.
 */
export interface OptionsNumeroUnique {
  /**
   * Nombre total de tentatives : la première création, plus les relances.
   * Défaut : 3.
   */
  tentatives?: number;
  /**
   * Colonnes dont la collision doit être relancée — le champ porté par la
   * série (`numero`, `reference`, `matricule`).
   *
   * Une collision sur une autre contrainte (un e-mail en double, par exemple)
   * n'est pas une course sur le compteur : elle doit remonter telle quelle.
   * Sans cette précision, la relance masquait le vrai doublon derrière un
   * « numéro temporairement indisponible ».
   */
  colonnes?: string[];
  /**
   * Erreur levée quand toutes les tentatives ont échoué. Défaut : un conflit
   * (« Cette valeur existe déjà »).
   */
  erreur?: (cause: unknown) => Error;
}

/**
 * Colonnes en cause dans une violation d'unicité Prisma (P2002).
 *
 * Renvoie `null` si l'erreur n'est pas une P2002, et un tableau **vide** si la
 * contrainte visée n'est pas nommée : dans ce cas on ne peut pas distinguer
 * une course sur le compteur d'un vrai doublon.
 */
function cibleViolationUnique(reur: unknown): string[] | null {
  if (!reur || typeof reur !== 'object') return null;
  if ((reur as { code?: unknown }).code !== 'P2002') return null;
  const cible = (reur as { meta?: { target?: unknown } }).meta?.target;
  if (typeof cible === 'string') return [cible];
  if (Array.isArray(cible)) return cible.filter((colonne): colonne is string => typeof colonne === 'string');
  return [];
}

/**
 * L'erreur est-elle une collision de numéro, c'est-à-dire une course entre
 * deux créations qui ont lu le même « maximum + 1 » ?
 *
 * La course se reconnaît à sa signature : violation d'unicité (P2002) portant
 * sur une colonne de numéro. Tout le reste — un e-mail déjà pris, une
 * contrainte étrangère — est un vrai conflit métier et doit remonter.
 */
export function estCollisionNumero(reur: unknown, colonnes?: string[]): boolean {
  const cible = cibleViolationUnique(reur);
  if (cible === null) return false;
  // La contrainte visée n'est pas nommée : impossible de trancher, on relance
  // (comportement historique des modules qui rattrapaient P2002).
  if (!cible.length) return true;
  if (!colonnes?.length) return true;
  return cible.some((colonne) => colonnes.includes(colonne));
}

/**
 * Crée une ligne numérotée en enkasant les collisions de numéro.
 *
 * Le numéro est calculé par « maximum + 1 » : deux créations simultanées
 * lisent le même maximum et la seconde se heurte à la contrainte d'unicité.
 * Plutôt que de laisser l'erreur remonter, on recommence : le numéro est
 * recalculé, la transaction est rouverte, et la ligne est créée.
 *
 * `creer` doit recalculer le numéro à chaque appel (il encapsule la
 * transaction) : c'est la condition pour que la relance produise un numéro
 * différent.
 *
 * ```ts
 * return avecNumeroUnique(
 *   () => this.prisma.$transaction(async (tx) => {
 *     await tx.demandeDocument.create({ data: { numero: await prochainNumeroSerie(tx, serie, annee) } });
 *   }),
 *   { colonnes: ['numero'] },
 * );
 * ```
 */
export async function avecNumeroUnique<T>(creer: () => Promise<T>, options: OptionsNumeroUnique = {}): Promise<T> {
  const tentatives = Math.max(1, options.tentatives ?? 3);
  let cause: unknown;
  for (let tentative = 1; tentative <= tentatives; tentative++) {
    try {
      return await creer();
    } catch (reur) {
      if (!estCollisionNumero(reur, options.colonnes)) throw reur;
      cause = reur;
    }
  }
  throw options.erreur ? options.erreur(cause) : new ConflictException(t('common.duplicateRecord'));
}
