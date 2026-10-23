import { Logger } from '@nestjs/common';

/**
 * Schéma des variables d'environnement, vérifié une fois au démarrage par
 * `ConfigModule.forRoot({ validate })`.
 *
 * Deux niveaux, volontairement :
 * - « bloquant » : uniquement ce qui empêchait déjà l'API de fonctionner
 *   (DATABASE_URL, sans laquelle Prisma ne se connecte pas ; JWT_SECRET en
 *   production, déjà refusé par JwtConfigModule). Le démarrage échoue, avec la
 *   liste complète des problèmes plutôt que le premier rencontré.
 * - « avertissement » : tout le reste. Une variable facultative absente ou mal
 *   formée est signalée dans les journaux, mais ne doit jamais empêcher un
 *   redémarrage de la production ; le code garde ses replis habituels.
 *
 * Les modules continuent de lire `process.env` (ou ConfigService) au moment
 * de l'usage : ce schéma documente et contrôle, il ne remplace pas les replis.
 */

/** Valeur d'exemple publique (`.env.example`) : refusée en production. */
export const JWT_SECRET_EXEMPLE = 'change-me-in-production';
/** Valeur d'exemple publique du secret de la passerelle biométrique. */
export const BIOMETRIE_SECRET_EXEMPLE = 'change-me-biometrie';
/** Valeurs d'exemple des clés d'API dans `.env.example`. */
const CLE_API_EXEMPLE = 'changez-moi';

type Env = Record<string, unknown>;

interface Regle {
  nom: string;
  description: string;
  /** Message bloquant, ou null si la valeur convient. */
  bloquant?: (valeur: string | undefined, enProduction: boolean) => string | null;
  /** Message d'avertissement, ou null si la valeur convient. */
  avertissement?: (valeur: string | undefined, enProduction: boolean) => string | null;
}

const vide = (v: string | undefined) => v === undefined || v.trim() === '';

const entierPositif = (v: string | undefined) =>
  vide(v) || (/^\d+$/.test(v!.trim()) && Number(v) > 0)
    ? null
    : `doit être un entier positif (valeur actuelle : « ${v} ») ; la valeur par défaut ne s'applique pas`;

const url = (v: string | undefined) => {
  if (vide(v)) return null;
  try {
    const u = new URL(v!.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? null : 'doit commencer par http:// ou https://';
  } catch {
    return "n'est pas une URL valide";
  }
};

export const SCHEMA_CONFIGURATION: Regle[] = [
  {
    nom: 'DATABASE_URL',
    description: 'Connexion PostgreSQL (Prisma)',
    bloquant: (v) => (vide(v) ? 'est obligatoire (connexion PostgreSQL)' : null),
  },
  {
    nom: 'JWT_SECRET',
    description: 'Secret de signature des jetons',
    bloquant: (v, prod) =>
      prod && (vide(v) || v === JWT_SECRET_EXEMPLE)
        ? "est obligatoire en production et ne peut pas valoir l'exemple public. Générez-en une : openssl rand -hex 32"
        : null,
    avertissement: (v, prod) =>
      !prod && (vide(v) || v === JWT_SECRET_EXEMPLE)
        ? "absent ou valeur d'exemple : acceptable en développement seulement"
        : null,
  },
  {
    nom: 'JWT_EXPIRES_IN',
    description: 'Durée de vie des jetons (défaut 12h)',
    avertissement: (v) =>
      vide(v) || /^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)?$/i.test(v!.trim())
        ? null
        : `format de durée inattendu (« ${v} », ex. 12h)`,
  },
  {
    nom: 'NODE_ENV',
    description: 'Environnement (production active les garde-fous)',
    avertissement: (v) =>
      vide(v) || ['production', 'development', 'test'].includes(v!) ? null : `valeur inattendue « ${v} »`,
  },
  { nom: 'PORT', description: "Port d'écoute (défaut 5031)", avertissement: entierPositif },
  { nom: 'HOST', description: "Interface d'écoute (défaut 0.0.0.0)" },
  {
    nom: 'CORS_ORIGINS',
    description: 'Origines autorisées, séparées par des virgules',
    avertissement: (v, prod) =>
      prod && vide(v) ? 'absente en production : toutes les origines croisées sont refusées' : null,
  },
  {
    nom: 'BIOMETRIE_SECRET',
    description: 'Secret partagé avec la passerelle biométrique',
    avertissement: (v, prod) =>
      prod && (vide(v) || v === BIOMETRIE_SECRET_EXEMPLE)
        ? "absent ou valeur d'exemple : les preuves de la passerelle biométrique seront refusées"
        : null,
  },
  {
    nom: 'BIOMETRIE_CHIFFREMENT_CLE',
    description: "Clé de chiffrement des gabarits d'empreinte",
    avertissement: (v, prod) => (prod && vide(v) ? "absente : l'enrôlement d'empreintes échouera" : null),
  },
  {
    nom: 'BIOMETRIE_CONSERVATION_JOURS',
    description: 'Conservation des gabarits (défaut 90 j)',
    avertissement: entierPositif,
  },
  { nom: 'AUTH_ECHECS_MAX', description: 'Échecs avant verrouillage (défaut 10)', avertissement: entierPositif },
  { nom: 'AUTH_VERROU_MINUTES', description: 'Durée du verrouillage (défaut 15 min)', avertissement: entierPositif },
  { nom: 'URL_APPLICATION', description: 'URL publique des liens et QR imprimés', avertissement: url },
  { nom: 'OTP_GATEWAY_URL', description: 'Passerelle SMS (défaut http://127.0.0.1:5027)', avertissement: url },
  {
    nom: 'OTP_API_KEY',
    description: 'Clé de la passerelle SMS',
    avertissement: (v, prod) =>
      prod && (vide(v) || v === CLE_API_EXEMPLE)
        ? "absente ou valeur d'exemple : la passerelle SMS risque de refuser les envois"
        : null,
  },
  { nom: 'OTP_MESSAGE_TEMPLATE', description: 'Gabarit facultatif du SMS OTP' },
  { nom: 'MOBILE_MONEY_URL', description: 'Opérateur Mobile Money (vide : simulation)', avertissement: url },
  { nom: 'MOBILE_MONEY_API_KEY', description: "Clé de l'opérateur Mobile Money" },
];

export interface BilanConfiguration {
  erreurs: string[];
  avertissements: string[];
}

/** Applique le schéma sans effet de bord : utile aux tests. */
export function bilanConfiguration(env: Env): BilanConfiguration {
  const enProduction = env.NODE_ENV === 'production';
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  for (const regle of SCHEMA_CONFIGURATION) {
    const brut = env[regle.nom];
    const valeur = brut === undefined || brut === null ? undefined : String(brut);
    const bloquant = regle.bloquant?.(valeur, enProduction);
    if (bloquant) {
      erreurs.push(`${regle.nom} ${bloquant}`);
      continue;
    }
    const avertissement = regle.avertissement?.(valeur, enProduction);
    if (avertissement) avertissements.push(`${regle.nom} ${avertissement}`);
  }
  // Mobile Money réel sans clé : l'opérateur refusera vraisemblablement.
  if (!vide(env.MOBILE_MONEY_URL as string | undefined) && vide(env.MOBILE_MONEY_API_KEY as string | undefined)) {
    avertissements.push('MOBILE_MONEY_API_KEY absente alors que MOBILE_MONEY_URL est renseignée');
  }
  return { erreurs, avertissements };
}

/**
 * Fonction `validate` de ConfigModule. Renvoie l'environnement tel quel : les
 * valeurs ne sont ni converties ni complétées, pour que le comportement des
 * modules reste exactement celui d'avant.
 */
export function validerConfiguration(env: Env, journal: Pick<Logger, 'warn'> = new Logger('Configuration')): Env {
  const { erreurs, avertissements } = bilanConfiguration(env);
  for (const message of avertissements) journal.warn(message);
  if (erreurs.length) {
    throw new Error(`Configuration invalide :\n- ${erreurs.join('\n- ')}`);
  }
  return env;
}
