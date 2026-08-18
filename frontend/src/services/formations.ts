import { api } from '../boot/axios';
import type { Formation } from '../types';

export interface FormationDashboardLigne {
  id: string;
  intitule: string;
  statut: string;
  prix: number;
  devise: string;
  nbInscrits: number;
  nbPayes: number;
  recette: number;
}

export interface FormationDashboardTotaux {
  inscrits: number;
  payes: number;
  recette: number;
}

export interface FormationDashboard {
  total: number;
  parFormation: FormationDashboardLigne[];
  totaux: FormationDashboardTotaux;
}

export interface PaginatedFormations {
  data: Formation[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Fiche telle que la vitrine publique la présente : le serveur n'expose que
 * les formations PUBLIEE et y ajoute les places restantes.
 */
export interface FormationVitrine {
  id: string;
  titre: string;
  description?: string | null;
  categorie?: string | null;
  prix: number;
  devise: string;
  dureeHeures?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  lieu?: string | null;
  placesRestantes?: number | null;
}

/** Demande d'inscription déposée sans compte. */
export interface DemandeInscriptionPublique {
  nomComplet: string;
  telephone: string;
  email?: string | undefined;
  matricule?: string | undefined;
}

export interface ResultatDepotInscription {
  inscriptionId: string;
  numero: string;
  montant: number;
  devise: string;
  message: string;
}

export const formationsService = {
  /** Vitrine publique : aucune authentification requise. */
  publiques: () => api.get<FormationVitrine[]>('/formations/publiques'),

  inscriptionPublique: (formationId: string, corps: DemandeInscriptionPublique) =>
    api.post<ResultatDepotInscription>(`/formations/${formationId}/inscription`, corps),

  liste: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedFormations>('/formations', { params }),
  dashboard: () =>
    api.get<FormationDashboard>('/formations/dashboard'),
  publier: (id: string) =>
    api.post<void>(`/formations/${id}/publier`),
  cloturer: (id: string) =>
    api.post<void>(`/formations/${id}/cloturer`),
  supprimer: (id: string) =>
    api.delete<void>(`/formations/${id}`),
  inscriptions: (formationId: string) =>
    api.get(`/formations/${formationId}/inscriptions`),
  confirmerInscription: (id: string) =>
    api.post<void>(`/formations/inscriptions/${id}/confirmer`),
  annulerInscription: (id: string) =>
    api.post<void>(`/formations/inscriptions/${id}/annuler`),
};