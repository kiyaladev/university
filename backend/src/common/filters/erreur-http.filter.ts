import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { PrismaExceptionFilter } from '../prisma-exception.filter';

/**
 * Format d'erreur unique de l'API.
 *
 * Toutes les erreurs partent désormais sous la même forme, celle de Nest :
 *
 *     { "statusCode": 400, "message": "…", "error": "Bad Request" }
 *
 * `message` est une chaîne, ou un tableau de chaînes lorsque plusieurs
 * fautes sont accumulées (validation de formulaire). `error` est le libellé
 * HTTP du statut, utile aux clients qui affichent un titre d'erreur.
 *
 * Auparavant, trois écritures cohabitaient : la validation renvoyait
 * `{ statutCode, erreur, messages }`, la garde Swagger `{ statutCode, message }`
 * et tout le reste le format Nest. Un client devait donc deviner le format
 * de la réponse avant d'en extraire le message.
 *
 * Les champs hors erreur (`status`, `service`… dans la sonde de santé, par
 * exemple) sont conservés : ils portent un contexte que le client sait lire et
 * que le format unique ne remplace pas.
 */
export interface ErreurApi {
  statusCode: number;
  message: string | string[];
  error: string;
  [champ: string]: unknown;
}

/** Libellé HTTP associé à un statut, pour le champ `error`. */
const LIBELLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/** Libellé de repli quand le statut n'est pas connu. */
const LIBELLE_INCONNU = 'Error';

/**
 * Clés que le format unique consomme : elles sont remplacées par
 * `statusCode`, `message` et `error`, et ne sont donc pas recopiées.
 */
const CLES_FORMAT = ['statusCode', 'statutCode', 'message', 'messages', 'erreur', 'error'];

/** Libellé HTTP d'un statut. */
export function libelleStatut(status: number): string {
  return LIBELLES[status] ?? LIBELLE_INCONNU;
}

/**
 * Normalise une exception HTTP en corps `{ statusCode, message, error }`.
 *
 * Les anciennes écritures sont comprises : `messages` (tableau de l'ancien
 * format de validation) et `erreur` (code de l'ancien format) deviennent le
 * `message` du format unique. Un `message` absent reste absent : le client
 * distingue alors « erreur sans message » de « erreur avec message ».
 */
export function normaliserErreur(exception: HttpException): ErreurApi {
  const statusCode = exception.getStatus();
  const reponse = exception.getResponse();

  let message: string | string[] | undefined;
  let error: string | undefined;
  const extras: Record<string, unknown> = {};

  if (typeof reponse === 'string') {
    message = reponse;
  } else if (Array.isArray(reponse)) {
    message = reponse.map((element) => String(element));
  } else if (reponse && typeof reponse === 'object') {
    const corps = reponse as Record<string, unknown>;
    if (Array.isArray(corps.message)) message = corps.message.map((element) => String(element));
    else if (typeof corps.message === 'string') message = corps.message;
    else if (Array.isArray(corps.messages)) message = corps.messages.map((element) => String(element));
    else if (typeof corps.messages === 'string') message = corps.messages;
    else if (typeof corps.erreur === 'string') message = corps.erreur;
    if (typeof corps.error === 'string') error = corps.error;
    for (const [cle, valeur] of Object.entries(corps)) {
      if (!CLES_FORMAT.includes(cle)) extras[cle] = valeur;
    }
  }

  const libelle = error ?? libelleStatut(statusCode);
  const corps: ErreurApi = {
    ...extras,
    statusCode,
    // Sans message propre (sonde de santé, exception sans libellé), on
    // retombe sur le libellé HTTP : le client a toujours quelque chose à
    // afficher plutôt qu'un champ vide.
    message: message ?? libelle,
    error: libelle,
  };
  return corps;
}

/**
 * Filtre global : normalise en un seul format toutes les erreurs renvoyées
 * par l'API, quelle que soit leur origine (validation, métier, base de
 * données, erreur inattendue).
 *
 * Il hérite de `PrismaExceptionFilter` pour conserver la traduction des
 * erreurs Prisma en 404/409 lisibles ; seule l'écriture de la réponse
 * change.
 */
@Catch()
export class ErreurHttpFilter extends PrismaExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const traduite = this.verserException(exception);
    const corps = normaliserErreur(traduite);
    // `super.catch` réécrit la réponse avec le corps normalisé : la
    // traduction Prisma est conservée, le format est unique.
    return super.catch(new HttpException(corps, corps.statusCode), host);
  }
}
