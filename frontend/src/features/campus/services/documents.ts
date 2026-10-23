import { creer } from '@/shared/services/http';
import { bibliothequeService } from '@/shared/services/bibliotheque';
import type { DocumentDepot } from '@/types';

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
}

export const documentsService = {
  /** Dépose un document (fichier compris). */
  creer: (corps: CorpsDocument) => creer<DocumentDepot>('/documents', corps),

  /** Complète ou corrige une fiche de document. */
  modifier: (id: string, corps: Partial<CorpsDocument>) => bibliothequeService.modifier(id, corps),
};
