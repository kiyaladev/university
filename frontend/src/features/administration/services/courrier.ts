import { creer, lister, lire } from '@/shared/services/http';
import type { Courrier, TypeCourrier } from '@/types';

/**
 * Courrier administratif (`/courrier`).
 *
 * - `GET /courrier` : liste paginée, filtrée par type et par statut.
 * - `GET /courrier/:id` : fiche avec son circuit de validation.
 * - `POST /courrier` : enregistrement d'un courrier et de son circuit.
 * - `POST /courrier/:id/cloturer` : clôture (EN_CIRCUIT → TRAITE → CLASSE → ARCHIVE).
 * - `POST /courrier/:id/parapher/:circuitId` : paraphe de l'étape `circuitId`.
 */

/** Onglets de l'écran courrier : deux types de courrier, plus les archives. */
export type Onglet = 'ENTRANT' | 'SORTANT' | 'ARCHIVE';

/** Les archives ne sont pas un type de courrier mais deux statuts de fin. */
export const STATUTS_ARCHIVE = ['CLASSE', 'ARCHIVE'];

/** Filtres acceptés par `GET /courrier`. */
export interface ParametresCourrier {
  page?: number;
  pageSize?: number;
  /** `all=1` : le back renvoie tout en une page. */
  all?: string;
  type?: TypeCourrier | string;
  statut?: string;
  search?: string;
  dateDebut?: string;
  dateFin?: string;
}

/** Étape de routage saisie à l'enregistrement d'un courrier. */
export interface CircuitSaisie {
  ordre: number;
  roleValideur: string;
}

/** Corps attendu par `POST /courrier`. */
export interface CourrierSaisie {
  numero: string;
  type: TypeCourrier;
  objet: string;
  departementId?: string;
  expediteur?: string;
  destinataire?: string;
  dateReception?: string;
  dateEnvoi?: string;
  numeroReference?: string;
  notes?: string;
  fichier?: string;
  circuit: CircuitSaisie[];
}

/** Corps attendu par `POST /courrier/:id/parapher/:circuitId`. */
export interface ParapheSaisie {
  paraphe: string;
  commentaire?: string;
}

export const courrierService = {
  /** Courriers filtrés par type, statut, recherche et période. */
  liste: (params: ParametresCourrier = {}) => lister<Courrier>('/courrier', params),

  /** Fiche d'un courrier, avec son circuit de validation. */
  lire: (id: string) => lire<Courrier>(`/courrier/${id}`),

  /** Enregistrement d'un courrier et de son circuit de routage. */
  creer: (corps: CourrierSaisie) => creer<Courrier>('/courrier', corps),

  /** Clôture du courrier. */
  cloturer: (id: string) => creer<Courrier>(`/courrier/${id}/cloturer`, {}),

  /** Paraphe de l'étape `etapeId` du circuit de validation. */
  parapher: (id: string, etapeId: string, corps: ParapheSaisie) =>
    creer<Courrier>(`/courrier/${id}/parapher/${etapeId}`, corps),
};

/**
 * Archives : deux statuts de fin (CLASSE, ARCHIVE) que l'API n'accepte pas
 * ensemble — elle ne prend qu'un statut à la fois. On additionne donc les deux
 * appels, comme le fait l'écran.
 *
 * Un statut imposé qui n'est pas une archive ne renvoie rien.
 */
export async function listeCourrierArchive(
  params: ParametresCourrier,
  statut?: string | null,
): Promise<{ data: Courrier[]; total: number }> {
  const statuts = statut ? [statut].filter((s) => STATUTS_ARCHIVE.includes(s)) : STATUTS_ARCHIVE;
  const reponses = await Promise.all(statuts.map((s) => courrierService.liste({ ...params, statut: s })));
  return {
    data: reponses.flatMap((r) => r.data),
    total: reponses.reduce((total, r) => total + (r.total ?? 0), 0),
  };
}
