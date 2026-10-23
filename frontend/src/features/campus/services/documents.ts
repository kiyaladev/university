import { creer } from '@/shared/services/http';
import { bibliothequeService } from '@/shared/services/bibliotheque';
import type { DocumentDepot, SuspicionPlagiat } from '@/types';

/**
 * Fonds documentaire : la page publique et l'écran de gestion passent par
 * `shared/services/bibliotheque`. Il manque seulement la création, que la
 * bibliothèque partagée n'expose pas : elle vit ici, dans le domaine.
 */

/** Champs acceptés à la création ou à la modification d'un document. */
export interface CorpsDocument {
  titre: string;
  type: string;
  auteurs?: string | null;
  anneeEdition?: number | null;
  resume?: string | null;
  fichier?: string | null;
  typeMime?: string | null;
  public?: boolean;
  departementId?: string | null;
  enseignantId?: string | null;
  etudiantId?: string | null;
  [cle: string]: unknown;
}

/**
 * Le dépôt peut renvoyer les suspicions de plagiat qu'il vient de créer :
 * le dialogue les affiche avant publication.
 */
export type ReponseDocument = DocumentDepot & {
  suspicionsPlagiat?: SuspicionPlagiat[];
  data?: { suspicionsPlagiat?: SuspicionPlagiat[] };
};

/**
 * Corps envoyé : le formulaire de dépôt assemble ses clés au fil de l'eau,
 * on accepte donc aussi un objet libre.
 */
export type CorpsDocumentEnvoi = CorpsDocument | Record<string, unknown>;

export const documentsService = {
  /** Dépose un document (fichier compris). */
  creer: (corps: CorpsDocumentEnvoi) => creer<ReponseDocument>('/documents', corps),

  /**
   * Complète ou corrige une fiche de document.
   *
   * On réutilise le service partagé, qui rend l'enveloppe axios : on en
   * garde le corps, comme `creer`, pour que l'appelant ait toujours le
   * document et non la réponse HTTP.
   */
  modifier: async (id: string, corps: CorpsDocumentEnvoi) =>
    (await bibliothequeService.modifier(id, corps as Record<string, unknown>)).data as ReponseDocument,
};
