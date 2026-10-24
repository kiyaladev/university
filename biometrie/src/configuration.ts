/**
 * Configuration de la passerelle.
 *
 * Deux sources, avec des rôles distincts :
 *   • un fichier local, hors dépôt, qui porte l'identité de l'appareil
 *     (identifiant + clé de signature) et les réglages de poste ;
 *   • les variables d'environnement, qui portent le secret partagé de l'ancien
 *     chemin et les réglages d'exploitation (port, origines, seuil).
 *
 * Le fichier d'appareil est un secret : il doit appartenir à son seul
 * propriétaire (permissions 600). La passerelle refuse de démarrer sinon —
 * une clé lisible par un autre compte de la machine n'est plus une clé.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

/** Valeur d'exemple du secret partagé : l'API la refuse en production. */
export const SECRET_EXEMPLE = 'change-me-biometrie';

/** Port d'écoute par défaut. 5044 est déjà pris sur le serveur de production. */
export const PORT_DEFAUT = 5044;

/** Origines autorisées par défaut : l'application de production, et rien d'autre. */
export const ORIGINES_DEFAUT = ['https://university.naimba.com'];

/** Seuil de correspondance par défaut (aligné sur `EMPREINTE_SCORE_MIN`). */
export const SCORE_MIN_DEFAUT = 60;

/** Identifiant d'appareil enrôlé : UUID, comme l'en impose l'API. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clé d'appareil : 32 octets en hexadécimal, comme l'en produit l'API. */
const SECRET_HEX = /^[0-9a-f]{64}$/i;

export type ModeSignature = 'appareil' | 'secret-partage';

export interface ConfigurationAppareil {
  /** Identifiant de l'appareil enrôlé (`POST /attestation/appareils`). */
  appareilId: string;
  /** Clé de signature propre à l'appareil. */
  secret: string;
}

export interface ConfigurationPasserelle {
  port: number;
  /** Origines autorisées à appeler la passerelle depuis un navigateur. */
  origines: string[];
  scoreMin: number;
  langue: 'fr' | 'en';
  /** Pilote de lecture à utiliser. */
  pilote: string;
  /** Identité de l'appareil ; absente en mode secret partagé. */
  appareil: ConfigurationAppareil | null;
  mode: ModeSignature;
  /** Clé de signature effective : celle de l'appareil, ou le secret partagé. */
  secret: string;
  /** Fichier de configuration d'appareil lu, s'il existe. */
  fichierConfig: string | null;
  /** Avertissements à afficher au démarrage. */
  avertissements: string[];
}

export interface OptionsChargement {
  env?: Record<string, string | undefined>;
  /** Racine du dépôt : un fichier de configuration ne doit pas s'y trouver. */
  racineDepot?: string;
  /** Surcharge du chemin du fichier de configuration (tests). */
  cheminConfig?: string | null;
}

/** Erreur de configuration : la passerelle ne doit pas démarrer. */
export class ErreurConfiguration extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurConfiguration';
  }
}

/** Chemin du fichier de configuration d'appareil, par défaut. */
export function cheminConfigParDefaut(env: Record<string, string | undefined> = process.env): string {
  if (env.BIOMETRIE_CONFIG) return resolve(env.BIOMETRIE_CONFIG);
  const base = env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config');
  return join(base, 'university', 'biometrie.json');
}

/** Le fichier de configuration est-il dans le dépôt ? Il ne doit pas l'être. */
export function cheminDansDepot(chemin: string, racineDepot: string): boolean {
  const cheminNormalise = resolve(chemin);
  const racineNormalisee = resolve(racineDepot);
  return (
    cheminNormalise === racineNormalisee ||
    cheminNormalise.startsWith(racineNormalisee.endsWith(sep) ? racineNormalisee : racineNormalisee + sep)
  );
}

interface FichierAppareil {
  appareilId?: unknown;
  secret?: unknown;
  port?: unknown;
  origines?: unknown;
  scoreMin?: unknown;
  langue?: unknown;
}

/** Lit et contrôle le fichier de configuration d'appareil. */
export function lireFichierAppareil(
  chemin: string,
  racineDepot: string,
): { appareil: ConfigurationAppareil; port?: number; origines?: string[]; scoreMin?: number; langue?: 'fr' | 'en' } | null {
  if (!existsSync(chemin)) return null;

  if (cheminDansDepot(chemin, racineDepot)) {
    throw new ErreurConfiguration(
      `Le fichier de configuration ${chemin} se trouve dans le dépôt : il contient une clé de signature et ne doit jamais y être versionné. Placez-le hors du dépôt.`,
    );
  }

  const infos = statSync(chemin);
  if (!infos.isFile()) {
    throw new ErreurConfiguration(`Le fichier de configuration ${chemin} n'est pas un fichier.`);
  }

  // Un secret lisible par un autre compte de la machine n'est plus un secret.
  if ((infos.mode & 0o077) !== 0) {
    throw new ErreurConfiguration(
      `Le fichier de configuration ${chemin} est trop permissif (mode ${(infos.mode & 0o777).toString(8)}). `
        + `Attendez-vous à 600 : chmod 600 ${chemin}`,
    );
  }

  let brut: string;
  try {
    brut = readFileSync(chemin, 'utf8');
  } catch (e: any) {
    throw new ErreurConfiguration(`Le fichier de configuration ${chemin} est illisible : ${e?.message ?? 'erreur inconnue'}`);
  }

  let contenu: FichierAppareil;
  try {
    contenu = JSON.parse(brut) as FichierAppareil;
  } catch {
    throw new ErreurConfiguration(`Le fichier de configuration ${chemin} n'est pas un JSON valide.`);
  }

  const appareilId = String(contenu.appareilId ?? '');
  const secret = String(contenu.secret ?? '');
  if (!UUID.test(appareilId)) {
    throw new ErreurConfiguration(
      `L'identifiant d'appareil de ${chemin} est absent ou n'est pas un UUID : l'appareil doit d'abord être enrôlé (POST /attestation/appareils).`,
    );
  }
  if (!SECRET_HEX.test(secret)) {
    throw new ErreurConfiguration(
      `La clé de l'appareil de ${chemin} est absente ou mal formée : 64 caractères hexadécimaux sont attendus.`,
    );
  }

  return {
    appareil: { appareilId, secret },
    port: typeof contenu.port === 'number' ? contenu.port : undefined,
    origines: Array.isArray(contenu.origines) ? contenu.origines.map(String) : undefined,
    scoreMin: typeof contenu.scoreMin === 'number' ? contenu.scoreMin : undefined,
    langue: contenu.langue === 'en' ? 'en' : contenu.langue === 'fr' ? 'fr' : undefined,
  };
}

function nombre(valeur: string | undefined, defaut: number): number {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? n : defaut;
}

/**
 * Assemble la configuration effective. En mode secret partagé (aucun appareil
 * configuré), la passerelle continue de fonctionner comme avant, mais elle
 * prévient : ce chemin est refusé par l'API en production tant que le secret
 * est la valeur d'exemple.
 */
export function chargerConfiguration(options: OptionsChargement = {}): ConfigurationPasserelle {
  const env = options.env ?? process.env;
  const racineDepot = options.racineDepot ?? dirname(dirname(resolve(import.meta.dir)));

  const avertissements: string[] = [];
  let appareil: ConfigurationAppareil | null = null;
  let fichierConfig: string | null = null;
  let portFichier: number | undefined;
  let originesFichier: string[] | undefined;
  let scoreMinFichier: number | undefined;
  let langueFichier: 'fr' | 'en' | undefined;

  // `cheminConfig` : undefined → chemin par défaut (absent, ce n'est pas une
  // erreur) ; null → aucun fichier ; un chemin → demandé explicitement, il
  // doit exister.
  if (options.cheminConfig !== null) {
    const chemin = options.cheminConfig ?? cheminConfigParDefaut(env);
    const lu = lireFichierAppareil(chemin, racineDepot);
    if (lu) {
      appareil = lu.appareil;
      fichierConfig = chemin;
      portFichier = lu.port;
      originesFichier = lu.origines;
      scoreMinFichier = lu.scoreMin;
      langueFichier = lu.langue;
    } else if (options.cheminConfig !== undefined) {
      throw new ErreurConfiguration(`Le fichier de configuration ${chemin} est introuvable.`);
    }
  }

  const secretPartage = env.BIOMETRIE_SECRET?.trim() || SECRET_EXEMPLE;

  if (appareil) {
    if (env.BIOMETRIE_SECRET?.trim() && env.BIOMETRIE_SECRET.trim() !== SECRET_EXEMPLE) {
      avertissements.push(
        "Un appareil est configuré : le secret partagé BIOMETRIE_SECRET est ignoré, seule la clé propre à l'appareil signe les résultats.",
      );
    }
  } else if (secretPartage === SECRET_EXEMPLE) {
    avertissements.push(
      "Aucun appareil configuré et BIOMETRIE_SECRET absent : la passerelle signe avec la valeur d'exemple, que l'API refuse en production. Enrôlez un appareil pour un fonctionnement réel.",
    );
  } else {
    avertissements.push(
      "Aucun appareil configuré : la passerelle signe avec le secret partagé BIOMETRIE_SECRET, commun à tous les postes. Ce chemin ne permet ni révocation individuelle ni traçabilité du poste ; préférez un appareil enrôlé.",
    );
  }

  const originesEnv = env.ORIGINES?.trim();
  const origines = originesEnv
    ? originesEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : (originesFichier ?? ORIGINES_DEFAUT);

  return {
    port: nombre(env.PORT, portFichier ?? PORT_DEFAUT),
    origines,
    scoreMin: nombre(env.SCORE_MIN, scoreMinFichier ?? SCORE_MIN_DEFAUT),
    langue: langueFichier ?? (env.BIOMETRIE_LANGUE === 'en' ? 'en' : 'fr'),
    pilote: env.BIOMETRIE_PILOTE?.trim() || 'simulateur',
    appareil,
    mode: appareil ? 'appareil' : 'secret-partage',
    secret: appareil ? appareil.secret : secretPartage,
    fichierConfig,
    avertissements,
  };
}

/** Chemin absolu du fichier de configuration, pour l'écriture (scripts). */
export function cheminConfigEcriture(env: Record<string, string | undefined> = process.env): string {
  const chemin = env.BIOMETRIE_CONFIG?.trim();
  return chemin ? resolve(chemin) : cheminConfigParDefaut(env);
}
