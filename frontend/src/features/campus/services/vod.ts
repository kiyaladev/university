import { creer, lire, lister, modifier } from '@/shared/services/http';
import type { CoursVOD } from '@/types';
import type { RessourceCatalogue } from '../types';

/**
 * Médiathèque vidéo : le catalogue des ressources, la mise en ligne et la
 * position de lecture d'un étudiant.
 */

/** Filtres acceptés par la liste des ressources. */
export interface ParametresVod {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  statut?: string;
}

/** Champs acceptés à la création ou à la modification d'une ressource. */
export interface CorpsVod {
  titre: string;
  description?: string | null;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  matiereId?: string | null;
  enseignantId?: string | null;
  dureeSecondes?: number | null;
  public?: boolean;
  inscriptionId?: string | null;
}

/** Position de lecture rapportée par le lecteur. */
export interface VueVod {
  positionSecondes: number;
  dureeSecondes: number;
  termine: boolean;
}

export const vodService = {
  /** Catalogue des ressources, filtré et paginé par le serveur. */
  liste: (params: ParametresVod = {}) => lister<RessourceCatalogue>('/vod', params),

  /** Collecte de l'étudiant : arrive d'un bloc, filtrée ensuite côté client. */
  maCollecte: () => lire<RessourceCatalogue[]>('/vod/ma-collecte'),

  /** Ressource détaillée (lecteur). */
  detail: (id: string) => lire<CoursVOD>(`/vod/${id}`),

  creer: (corps: CorpsVod) => creer<RessourceCatalogue>('/vod', corps),

  modifier: (id: string, corps: Partial<CorpsVod>) => modifier<RessourceCatalogue>(`/vod/${id}`, corps),

  /** Met la ressource en ligne. */
  publier: (id: string) => creer<void>(`/vod/${id}/publier`),

  /** Archive la ressource (elle disparaît du catalogue). */
  archiver: (id: string) => creer<void>(`/vod/${id}/archiver`, {}),

  /** Rapporte la position de lecture d'un étudiant. */
  signalerVue: (id: string, corps: VueVod) => creer<void>(`/vod/${id}/vue`, corps),
};
