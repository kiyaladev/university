import { creer, modifier } from '@/shared/services/http';
import type { Formation } from '@/types';

/**
 * Catalogue des formations payantes.
 *
 * La lecture, la publication et le suivi des inscriptions restent dans
 * `shared/services/formations` (partagés avec la vitrine publique) ; seule la
 * création et la modification d'une formation, propres à l'écran
 * d'administration, sont ici.
 */

/** Champs acceptés à la création ou à la modification d'une formation. */
export interface CorpsFormation {
  intitule: string;
  description?: string | null;
  categorie?: string | null;
  prix: number;
  devise?: string;
  dureeHeures?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  lieu?: string | null;
  responsableId?: string | null;
  inscriptionOuverte?: boolean;
}

export const formationsAdminService = {
  /** Ouvre une nouvelle formation. */
  creer: (corps: CorpsFormation) => creer<Formation>('/formations', corps),

  /** Corrige une formation existante. */
  modifier: (id: string, corps: Partial<CorpsFormation>) => modifier<Formation>(`/formations/${id}`, corps),
};
