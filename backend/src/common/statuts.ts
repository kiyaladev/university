import { ArgumentMetadata, Injectable, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Jetons d'état : compatibilité avec l'écriture antérieure des enums.
 *
 * Depuis l'harmonisation des statuts (docs/decisions/statuts.md), une valeur
 * d'état est écrite sans marqueur de genre : `ANNULE`, `VALIDE`, `CLOTURE`…
 * Pendant la transition, l'API doit encore accepter les anciennes écritures :
 * un navigateur qui n'a pas rechargé le front (bundle en cache) continue
 * d'envoyer `ANNULEE` pendant quelques jours.
 *
 * La conversion se fait à l'entrée, avant la validation : le jeton reçu
 * devient le jeton courant, la base ne connaît que le nouveau, et le code
 * applicatif n'a qu'une seule écriture à connaître.
 *
 * La table est une bijection : chaque ancien jeton a un seul successeur, et
 * aucun jeton courant n'y figure (les valeurs actuelles traversent la table
 * sans être modifiées).
 */
export const JETONS_STATUT_LEGACY: Readonly<Record<string, string>> = Object.freeze({
  ACCORDEE: 'ACCORDE',
  ANNULEE: 'ANNULE',
  CLOSE: 'CLOS',
  CLOTUREE: 'CLOTURE',
  COMPLETE: 'COMPLET',
  CONFIRMEE: 'CONFIRME',
  CONTROLEE: 'CONTROLE',
  EMISE: 'EMIS',
  ENCAISSEE: 'ENCAISSE',
  ENVOYEE: 'ENVOYE',
  FERMEE: 'FERME',
  OCCUPEE: 'OCCUPE',
  OUVERTE: 'OUVERT',
  PAYEE: 'PAYE',
  PLANIFIEE: 'PLANIFIE',
  PRETE: 'PRET',
  PROCLAMEE: 'PROCLAME',
  PUBLIEE: 'PUBLIE',
  REFUSEE: 'REFUSE',
  REJETEE: 'REJETE',
  RESERVEE: 'RESERVE',
  RESOLUE: 'RESOLU',
  RETIREE: 'RETIRE',
  REVOQUEE: 'REVOQUE',
  VALIDEE: 'VALIDE',
});

/** Le jeton courant correspondant à une valeur reçue (identique si elle est déjà courante). */
export function jetonStatutActuel(valeur: string): string {
  return JETONS_STATUT_LEGACY[valeur] ?? valeur;
}

/**
 * Convertit les jetons d'état d'une charge utile (corps de requête, requête,
 * réponse). Seules les chaînes exactement égales à un ancien jeton sont
 * touchées : un texte libre qui contiendrait ces mots n'est pas réécrit.
 */
export function normaliserJetonsStatuts(valeur: unknown): unknown {
  if (typeof valeur === 'string') return jetonStatutActuel(valeur);
  if (Array.isArray(valeur)) return valeur.map((element) => normaliserJetonsStatuts(element));
  if (valeur !== null && typeof valeur === 'object') {
    const prototype = Object.getPrototypeOf(valeur);
    // Un objet métier (Date, Buffer…) n'est pas une charge utile JSON : on le
    // laisse intact.
    if (prototype !== Object.prototype && prototype !== null) return valeur;
    const sortie: Record<string, unknown> = {};
    for (const [cle, contenu] of Object.entries(valeur as Record<string, unknown>)) {
      sortie[cle] = normaliserJetonsStatuts(contenu);
    }
    return sortie;
  }
  return valeur;
}

/**
 * `ValidationPipe` qui convertit les jetons d'état reçus avant de les
 * valider. Sans cela, un client ancien verrait ses requêtes rejetées en 400
 * alors que la valeur demandée est parfaitement valide après conversion.
 */
@Injectable()
export class ValidationPipeCompatStatuts extends ValidationPipe {
  constructor(options: ValidationPipeOptions) {
    super(options);
  }

  async transform(valeur: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return super.transform(normaliserJetonsStatuts(valeur), metadata);
  }
}
