/**
 * Confirmation de paiement — une seule logique pour tous les portefeuilles.
 *
 * La table `Paiement` est partagée par cinq portefeuilles (scolarité,
 * formations, restauration, recettes externes, demandes de documents) et
 * chacun refaisait sa propre confirmation : transaction, écriture du statut,
 * verrou optimiste, idempotence, effet métier, journal d'audit. Ce module
 * regroupe le squelette commun ; chaque source n'apporte plus que son
 * « effet » (dossier soldé, place confirmée, demande passée en traitement,
 * solde crédité) et ses règles propres.
 *
 * Garanties apportées par le moteur :
 *
 *  - une seule transaction : la transition, l'effet et le journal sont
 *    validés ensemble, ou rien ne l'est ;
 *  - un verrou optimiste : la transition n'écrit que si le statut attendu est
 *    toujours le sien (`updateMany where { id, statut }`) ; sinon elle est
 *    refusée et l'effet n'est pas joué ;
 *  - l'idempotence : une confirmation déjà appliquée ne rejoue ni l'effet ni
 *    le journal ;
 *  - l'échec de l'effet annule tout : le paiement n'est jamais confirmé sans
 *    que son effet ait abouti.
 *
 * Choix : des fonctions, pas un module Nest — comme `paiement.ts` et
 * `mobile-money.ts`. Le client Prisma est passé par l'appelant ; aucune
 * dépendance n'est à déclarer dans les modules, qui gardent leurs
 * constructeurs.
 */
import { Prisma, StatutPaiement } from '@prisma/client';
import { journaliser } from '../audit';
import type { AuthUser } from '../decorators';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SourcePaiement } from './paiement';

/** Modèles Prisma qui portent un statut de confirmation de paiement. */
export type ModeleConfirmation = 'paiement' | 'recharge';

/**
 * Transition optimiste : le statut attendu est la condition de l'écriture.
 * `updateMany where { id, statut }` n'écrit que si le statut est resté le
 * sien ; sinon aucune ligne n'est touchée et la confirmation est refusée.
 */
export interface TransitionOptimiste {
  /** Modèle porteur du statut de confirmation. */
  modele: ModeleConfirmation;
  /** Identifiant de l'entité à faire passer au nouveau statut. */
  id: string;
  /** Statut attendu : la condition de l'écriture. */
  statutAttendu: StatutPaiement;
  /** Erreur renvoyée si le statut a changé entre-temps. */
  erreur: () => Error;
}

/** Ce que l'effet a préparé, avant la transition. */
export interface PreparationConfirmation<P = unknown> {
  /**
   * Transition à effectuer : le verrou optimiste de la confirmation.
   * Absente quand la confirmation est déjà appliquée — l'effet n'est alors
   * pas rejoué et rien n'est écrit.
   */
  transition?: TransitionOptimiste;
  /** Objet payé avant l'effet (dossier, place, demande, recharge). */
  objet: P;
  /** La confirmation a déjà été appliquée : l'effet ne doit pas être rejoué. */
  confirme: boolean;
}

/** Champs écrits par la transition. */
export type EcritureTransition = {
  /** Nouveau statut de l'entité. */
  statut: StatutPaiement;
  /** Date de completion : portée par le paiement seul. */
  completeLe?: Date | null;
};

/** Contexte remis à l'effet pendant la préparation. */
export interface ContexteEffetPaiement {
  /** Transaction courante : l'effet s'y inscrit, il n'écrit rien ailleurs. */
  tx: Prisma.TransactionClient;
  /** Acteur inscrit au journal. */
  user: Pick<AuthUser, 'id'> | null;
  /** Statut visé par la confirmation (RÉUSSI pour un encaissement). */
  statut: StatutPaiement;
}

/** Contexte remis à l'effet quand la transition a abouti. */
export interface ContexteApplicationEffet<P = unknown> extends ContexteEffetPaiement {
  /** Ce que l'effet a préparé. */
  preparation: PreparationConfirmation<P>;
  /** Champs réellement écrits par la transition (`statut`, `completeLe`…). */
  ecrit: EcritureTransition;
}

/** Ce que l'effet renvoie : la valeur de l'appelant et son complément d'audit. */
export interface ResultatEffet<T> {
  /** Valeur renvoyée à l'appelant. */
  valeur: T;
  /** Complément du journal d'audit : l'effet y dépose son avant/après. */
  audit?: unknown;
}

/**
 * Effet métier d'une confirmation de paiement, propre à une source.
 *
 * L'effet ne porte que ce qui est spécifique au portefeuille : ses contrôles,
 * sa mutation et son instantané d'audit. Il ne connaît ni la transaction, ni
 * le verrou, ni l'écriture du journal : le moteur s'en charge.
 */
export interface EffetConfirmationPaiement<T, P = unknown> {
  /**
   * Résout la cible de la confirmation et contrôle son état : source du
   * paiement, statut clos, année ouverte, capacité restante…
   * Une exception HTTP levée ici annule la transaction entière.
   */
  preparer(ctx: ContexteEffetPaiement): Promise<PreparationConfirmation<P>>;
  /**
   * Effet métier de la source : dossier soldé, place confirmée, demande
   * passée en traitement, solde crédité. Ne doit jamais être rejoué.
   */
  appliquer(ctx: ContexteApplicationEffet<P>): Promise<ResultatEffet<T>>;
  /**
   * État courant quand la confirmation a déjà été appliquée : l'effet n'est
   * pas rejoué, la confirmation reste idempotente. Une source qui refuse
   * une double confirmation lève son erreur ici.
   */
  dejaConfirme(ctx: ContexteApplicationEffet<P>): Promise<T>;
}

/** Journal de la confirmation : action, entité et détail avant/après. */
export interface JournalConfirmation<P = unknown, T = unknown> {
  /** Action journalisée, ou fonction du statut visé (confirmée / échouée). */
  action: string | ((statut: StatutPaiement) => string);
  /** Entité journalisée (`Paiement`, `Recharge`…). */
  entite: string;
  /** Entité concernée : identifiant connu ou dérivé de la préparation. */
  entiteId: string | ((preparation: PreparationConfirmation<P>) => string);
  /** Détail de l'audit : avant/après, champs modifiés… */
  details: (ctx: {
    preparation: PreparationConfirmation<P>;
    resultat: ResultatEffet<T>;
    statut: StatutPaiement;
    ecrit: EcritureTransition;
  }) => unknown;
}

export interface OptionsConfirmationPaiement<T, P = unknown> {
  /** Client Prisma : la transaction est ouverte et validée par le moteur. */
  prisma: Pick<PrismaService, '$transaction'>;
  /** Acteur inscrit au journal. */
  user: Pick<AuthUser, 'id'> | null;
  /** Effet métier de la source. */
  effet: EffetConfirmationPaiement<T, P>;
  /** Statut visé par la confirmation (RÉUSSI par défaut). */
  statut?: StatutPaiement;
  /** Journal de la confirmation. */
  journal: JournalConfirmation<P, T>;
  /** Options de la transaction (niveau d'isolation). */
  transaction?: OptionsTransactionConfirmation;
}

/** Options de la transaction de confirmation (niveau d'isolation, délais). */
export interface OptionsTransactionConfirmation {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Champs écrits par la transition : un paiement porte la date de
 * completion, une recharge non.
 */
function donneesTransition(modele: ModeleConfirmation, statut: StatutPaiement): EcritureTransition {
  if (modele === 'paiement') {
    return { statut, completeLe: statut === StatutPaiement.REUSSI ? new Date() : null };
  }
  return { statut };
}

/**
 * Écrit la transition sous verrou optimiste. La ligne n'est touchée que si
 * son statut est encore celui attendu ; sinon l'erreur de la source est
 * levée et l'effet n'est pas joué.
 */
async function appliquerTransition(
  tx: Prisma.TransactionClient,
  transition: TransitionOptimiste,
  statut: StatutPaiement,
): Promise<EcritureTransition> {
  const modele = (transition.modele === 'paiement' ? tx.paiement : tx.recharge) as unknown as {
    updateMany: (args: {
      where: { id: string; statut: StatutPaiement };
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  const ecrit = donneesTransition(transition.modele, statut);
  const change = await modele.updateMany({
    where: { id: transition.id, statut: transition.statutAttendu },
    data: ecrit,
  });
  if (change.count !== 1) throw transition.erreur();
  return ecrit;
}

/**
 * Confirme un paiement : transition verrouillée, effet métier de la source,
 * journal — le tout dans une seule transaction.
 *
 * Une confirmation déjà appliquée ne rejoue ni l'effet ni le journal
 * (idempotence). L'échec de l'effet annule la transaction entière : le
 * paiement reste dans son statut d'origine.
 */
export async function confirmerPaiement<T, P = unknown>(options: OptionsConfirmationPaiement<T, P>): Promise<T> {
  const { prisma, effet, user, journal } = options;
  const statut = options.statut ?? StatutPaiement.REUSSI;

  return prisma.$transaction(async (tx) => {
    const preparation = await effet.preparer({ tx, user, statut });

    // Confirmation déjà appliquée : ni transition, ni journal, effet rejoué
    // jamais. La source décide si elle renvoie l'état courant ou refuse.
    if (preparation.confirme) {
      return effet.dejaConfirme({ tx, user, statut, preparation, ecrit: { statut } });
    }

    const transition = preparation.transition;
    if (!transition) throw new Error('Confirmation de paiement : transition manquante.');

    const ecrit = await appliquerTransition(tx, transition, statut);
    const resultat = await effet.appliquer({ tx, user, statut, preparation, ecrit });

    await journaliser(
      tx,
      user,
      typeof journal.action === 'function' ? journal.action(statut) : journal.action,
      journal.entite,
      typeof journal.entiteId === 'function' ? journal.entiteId(preparation) : journal.entiteId,
      journal.details({ preparation, resultat, statut, ecrit }),
    );

    return resultat.valeur;
  }, options.transaction);
}

/**
 * Effets de confirmation par source : ce que la confirmation change dans
 * l'application. Chaque source implémente le contrat
 * `EffetConfirmationPaiement` dans son module ; cette table en tient la
 * description, pour qu'on lise d'un seul endroit ce que la confirmation
 * touche.
 */
export const EFFETS_CONFIRMATION_PAIEMENT: Record<SourcePaiement, string> = {
  INSCRIPTION:
    'Le dossier de scolarité est soldé (PAYÉ) quand le cumul des paiements réussis de sa devise atteint les frais.',
  FORMATION: "La place est confirmée : le paiement passe RÉUSSI, l'inscription à la formation passe CONFIRMÉ.",
  RESTO: 'Le solde du portefeuille restaurant est crédité du montant de la recharge.',
  DOCUMENT: 'La demande passe en traitement et part à la scolarité.',
  RECETTE: "Sans confirmation : la recette est encaissée à la création d'un paiement déjà RÉUSSI.",
};
