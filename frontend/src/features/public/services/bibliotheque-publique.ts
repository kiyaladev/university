import { lire } from '@/shared/services/http';
import type { Departement } from '@/types';

/**
 * Référentiels de la vitrine publique de la bibliothèque.
 *
 * Le dépôt des documents est un référentiel accessoire : s'il manque, la
 * recherche reste possible, seule la liste des départements est vide. L'appel
 * est donc silencieux et la page se contente de vider la liste.
 */

/** Option de liste simple : libellé affiché et valeur retenue. */
export interface OptionSimple {
  label: string;
  value: string;
}

/** Le backend peut répondre `{ data: [...] }` comme un tableau nu. */
type ReponseListe<T> = T[] | { data?: T[] };

export const bibliothequePubliqueService = {
  /** Départements proposés par le filtre de la vitrine. */
  departements: async (): Promise<Departement[]> => {
    const reponse = await lire<ReponseListe<Departement>>('/departements/public', {}, { silencieux: true });
    return Array.isArray(reponse) ? reponse : (reponse.data ?? []);
  },
};

/** Options du filtre « département », pour le sélecteur. */
export function optionsDepartements(departements: Departement[]): OptionSimple[] {
  return departements.map((d) => ({ label: d.nom, value: d.id }));
}
