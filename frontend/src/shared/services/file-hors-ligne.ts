/**
 * Logique commune des files d'attente hors ligne (pointages et séances) :
 * propriétaire du compte, péremption, identifiant client, lecture et écriture
 * chiffrées.
 *
 * Les deux files se ressemblaient jusqu'ici sans partager leur code : la
 * file des pointages était chiffrée, celle des séances ne l'était pas. Le
 * service réunit ici ce qui leur est commun, pour que les deux soient
 * chiffrées de la même façon et que la péremption soit la même.
 */
import { i18n } from '@/boot/i18n';
import { normaliserJetonsStatuts } from '@/shared/utils/statuts';
import type { Pointage } from '@/types';
import {
  CLE_AFFECTATIONS,
  CLE_FILE_POINTAGES,
  CLE_FILE_SEANCES,
  CLE_SALLES,
  clePour,
} from './cles-stockage';
import { ecrireFileChiffree, lireFileChiffree } from './file-chiffree';

/**
 * Code du conflit « preuve déjà consommée », renvoyé par l'API quand un
 * pointage est refusé parce que sa preuve d'empreinte a déjà été utilisée.
 */
export const CODE_PREUVE_DEJA_UTILISEE = 'PREUVE_DEJA_UTILISEE';

/** Échec d'un envoi hors ligne, tel que l'API le rapporte pour un pointage. */
export interface EchecSynchronisation {
  seanceId: string;
  ok?: boolean;
  /** Message traduit, pour l'affichage. */
  erreur?: string;
  /** Code d'erreur stable, quand l'API en renvoie un. */
  code?: string;
}

/**
 * L'échec est-il définitif ?
 *
 * Un pointage refusé parce que sa preuve a déjà été utilisée ne sera jamais
 * accepté : le renvoyer encore ne/aboutit à rien et la preuve reste consommée.
 * Il faut donc le retirer de la file, pas le réessayer à chaque
 * synchronisation. Les autres échecs (réseau, contrôle déjà fait par un autre
 * agent) restent en file : ils peuvent encore aboutir.
 */
export function echecDefinitif(echec: EchecSynchronisation): boolean {
  return echec.code === CODE_PREUVE_DEJA_UTILISEE;
}

/**
 * Au-delà de ce délai, une entrée n'a plus de chance d'être acceptée et n'a
 * plus à rester sur l'appareil : un téléphone de contrôleur perdu ne doit pas
 * être un stock de preuves d'attestation.
 */
export const PEREMPTION_JOURS = 7;

/** Entrée d'une file de séances (forme minimale, partagée avec le préchargement). */
export interface EntreeSeance {
  idClient?: string;
  enfileeLe?: string;
  [cle: string]: unknown;
}

export interface OptionsFileHorsLigne {
  /** Date d'enfilement d'une entrée (ISO 8601) : elle commande la péremption. */
  dateEnfilement?: (entree: unknown) => string | undefined;
  /** Nettoyage propre au type de file (retrait de secrets…). */
  nettoyer?: (entrees: unknown[]) => unknown[];
  /** Identifiant qui permet de dédoublonner la file : sans lui, l'entrée est écartée. */
  cleIdentifiant?: (entree: unknown) => string | undefined;
}

/** Files déjà déchiffrées : elles sont relues sans repasser par le chiffrement. */
const filesEnMemoire = new Map<string, unknown>();

function clef(prefixe: string, proprietaire: string): string {
  return `${prefixe}::${proprietaire}`;
}

/** File déjà déchiffrée en mémoire, si elle a été lue. */
export function fileEnMemoire<T>(prefixe: string, proprietaire: string): T[] | undefined {
  return filesEnMemoire.get(clef(prefixe, proprietaire)) as T[] | undefined;
}

/** Identifiant d'une entrée de file, unique et opaque. */
export function idClient(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const octets = new Uint8Array(16);
  globalThis.crypto.getRandomValues(octets);
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const h = [...octets].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Le code personnel est un secret réutilisable : il ne doit jamais être
 * écrit sur l'appareil, où il survivrait à la séance.
 */
export function retirerCodePin(entrees: Pointage[]): Pointage[] {
  return entrees
    .filter((pointage): pointage is Pointage => Boolean(pointage) && typeof pointage === 'object')
    .map((pointage) => {
      if (!('codePinEnseignant' in pointage)) return pointage;
      const { codePinEnseignant: _pin, ...sansSecret } = pointage as Pointage & { codePinEnseignant?: string };
      return sansSecret as Pointage;
    });
}

/** Options de lecture de la file des pointages. */
export const OPTIONS_POINTAGES: OptionsFileHorsLigne = {
  dateEnfilement: (entree) => (entree as Pointage | undefined)?.horodatage,
  nettoyer: (entrees) => retirerCodePin(entrees as Pointage[]),
};

/** Options de lecture de la file des séances. */
export const OPTIONS_SEANCES: OptionsFileHorsLigne = {
  dateEnfilement: (entree) => (entree as EntreeSeance | undefined)?.enfileeLe,
  // L'identifiant client est ce qui permet de savoir ce que le serveur a
  // accepté : une entrée qui n'en a pas ne peut pas être dédoublonnée.
  cleIdentifiant: (entree) => (entree as EntreeSeance | undefined)?.idClient,
};

/**
 * Lit une file hors ligne : elle est déchiffrée, purgée des entrées
 * expirées, nettoyée de ses secrets et harmonisée. Une file en clair
 * (ancienne écriture) est reprise et chiffrée à la lecture : la version en
 * clair disparaît alors du stockage.
 */
export async function lireFileHorsLigne<T>(
  prefixe: string,
  proprietaire: string,
  valeurVide: T[],
  options: OptionsFileHorsLigne = {},
): Promise<T[]> {
  if (!proprietaire) return valeurVide;
  const enMemoire = fileEnMemoire<T>(prefixe, proprietaire);
  const source = enMemoire ?? (await lireFileChiffree<T[]>(clePour(prefixe, proprietaire), proprietaire, valeurVide));
  if (!Array.isArray(source)) throw new Error(i18n.global.t('filePointages.chiffrement.invalidFormat'));

  const nettoyes = (options.nettoyer ? options.nettoyer(source) : source) as T[];
  const limite = Date.now() - PEREMPTION_JOURS * 24 * 3600 * 1000;
  const retenus = nettoyes.filter((entree) => {
    const date = options.dateEnfilement?.(entree);
    const instant = date ? new Date(date).getTime() : Date.now();
    if (!Number.isFinite(instant) || instant < limite) return false;
    if (!options.cleIdentifiant) return true;
    const identifiant = options.cleIdentifiant(entree);
    return typeof identifiant === 'string' && identifiant.length > 0;
  });
  // Jetons d'état : la file peut dater d'avant l'harmonisation des statuts.
  // On convertit à la lecture et on réécrit le fichier (migration de la
  // file), faute de quoi le serveur refuserait la valeur.
  const convertis = normaliserJetonsStatuts(retenus) as T[];
  filesEnMemoire.set(clef(prefixe, proprietaire), convertis);
  if (JSON.stringify(convertis) !== JSON.stringify(source))
    await ecrireFileChiffree(clePour(prefixe, proprietaire), proprietaire, convertis);
  return convertis;
}

/** Écrit une file hors ligne : elle est chiffrée avant d'atteindre le stockage. */
export async function ecrireFileHorsLigne<T>(prefixe: string, proprietaire: string, valeur: T[]): Promise<void> {
  filesEnMemoire.set(clef(prefixe, proprietaire), valeur);
  await ecrireFileChiffree(clePour(prefixe, proprietaire), proprietaire, valeur);
}

/**
 * Cache de données de référence (tournée préparée : affectations, salles).
 * Il est stocké comme une file : chiffré, avec sa date d'enregistrement.
 */
export interface CacheDonnees<T> {
  /** Date d'enregistrement du cache (ISO 8601). */
  enregistreesLe: string;
  /** Données mises en cache. */
  data: T[];
}

/** Caches déjà déchiffrés : ils sont relus sans repasser par le chiffrement. */
const cachesEnMemoire = new Map<string, unknown>();

/** Cache déjà déchiffré en mémoire, s'il a été lu. */
export function cacheEnMemoire<T>(prefixe: string, proprietaire: string): CacheDonnees<T> | undefined {
  return cachesEnMemoire.get(clef(prefixe, proprietaire)) as CacheDonnees<T> | undefined;
}

/**
 * Lit un cache chiffré : il est déchiffré, puis gardé en mémoire pour les
 * lecteurs synchrones (les écrans lisent la tournée sans attendre). Un cache
 * écrit en clair (version antérieure) est repris et chiffré : la version en
 * clair disparaît alors du stockage.
 */
export async function lireCacheHorsLigne<T>(
  prefixe: string,
  proprietaire: string,
): Promise<CacheDonnees<T> | undefined> {
  if (!proprietaire) return undefined;
  const enMemoire = cacheEnMemoire<T>(prefixe, proprietaire);
  if (enMemoire) return enMemoire;
  const lu = await lireFileChiffree<CacheDonnees<T> | null>(
    clePour(prefixe, proprietaire),
    proprietaire,
    null,
  );
  if (!lu || !Array.isArray(lu.data)) return undefined;
  cachesEnMemoire.set(clef(prefixe, proprietaire), lu);
  return lu;
}

/**
 * Écrit un cache chiffré : la copie déchiffrée reste en mémoire, pour que
 * les écrans le lisent sans attendre le chiffrement.
 */
export async function ecrireCacheHorsLigne<T>(
  prefixe: string,
  proprietaire: string,
  valeur: CacheDonnees<T>,
): Promise<void> {
  cachesEnMemoire.set(clef(prefixe, proprietaire), valeur);
  await ecrireFileChiffree(clePour(prefixe, proprietaire), proprietaire, valeur);
}

/**
 * Déchiffre les files hors ligne du compte courant avant le démarrage de
 * l'interface : la tournée doit s'ouvrir avec ses séances en attente même
 * sans réseau.
 */
export async function prechargerFilesHorsLigne(proprietaire: string): Promise<void> {
  if (!proprietaire) return;
  await lireFileHorsLigne<Pointage>(CLE_FILE_POINTAGES, proprietaire, [], OPTIONS_POINTAGES);
  await lireFileHorsLigne<EntreeSeance>(CLE_FILE_SEANCES, proprietaire, [], OPTIONS_SEANCES);
}

/**
 * Déchiffre les caches de tournée (affectations, salles) du compte courant :
 * ils sont lus de façon synchrone par les écrans, la copie déchiffrée doit
 * donc être prête avant l'affichage.
 */
export async function prechargerCachesHorsLigne(proprietaire: string): Promise<void> {
  if (!proprietaire) return;
  await lireCacheHorsLigne(CLE_AFFECTATIONS, proprietaire);
  await lireCacheHorsLigne(CLE_SALLES, proprietaire);
}
