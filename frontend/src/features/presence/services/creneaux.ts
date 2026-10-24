import { creer, lire, modifier } from '@/shared/services/http';
import type { Creneau } from '@/types';

/**
 * Créneaux d'emploi du temps (`/creneaux`).
 *
 * Un créneau est la ligne hebdomadaire d'un cours : jour, heures, salle et
 * période de validité. Les séances d'un jour donné en découlent.
 */

/** Filtres acceptés par l'emploi du temps et par la liste des créneaux. */
export interface ParametresCreneaux {
  promotionId?: string;
  enseignantId?: string;
  salleId?: string;
  matiereId?: string;
  anneeId?: string;
  /** Jour de référence (lundi de la semaine) : `YYYY-MM-DD`. */
  semaineDu?: string;
  page?: number;
  pageSize?: number;
}

/** Une journée de l'emploi du temps, avec ses créneaux. */
export interface JourEmploiDuTemps {
  /** 1 (lundi) à 7 (dimanche). */
  jour: number;
  libelle: string;
  creneaux: Creneau[];
}

/** Corps d'un créneau, à la création comme à la modification. */
export interface CreneauSaisi {
  affectationId: string;
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
  type: string;
  salleId?: string | null;
  actif?: boolean;
  /** Période de validité ; vide ou `null` : toute l'année. */
  dateDebut?: string | null;
  dateFin?: string | null;
}

export const creneauxService = {
  /** Emploi du temps d'une semaine, jour par jour. */
  emploiDuTemps: (params: ParametresCreneaux = {}) => lire<JourEmploiDuTemps[]>('/creneaux/emploi-du-temps', params),

  /** Crée un créneau. */
  creer: (corps: CreneauSaisi) => creer<Creneau>('/creneaux', corps, { silencieux: true }),

  /** Modifie un créneau. */
  modifier: (id: string, corps: CreneauSaisi) => modifier<Creneau>(`/creneaux/${id}`, corps, { silencieux: true }),
};
