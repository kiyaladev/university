import { creer, lire } from '@/shared/services/http';
import { elements, type Collection } from '@/shared/utils/collections';
import type { AnneeAcademique } from '@/types';

/**
 * Inscription publique : le dossier déposé par un candidat, sans compte.
 *
 * - `GET /inscription-publique/annees` : les années ouvertes à l'inscription ;
 * - `GET /inscription-publique/annees/:anneeId/promotions` : les promotions de
 *   l'année (route appelée par le sélecteur de recherche) ;
 * - `GET /frais` : le tarif public de la promotion retenue ;
 * - `POST /inscription-publique` : le dépôt du dossier.
 */

/** Promotion ouverte à l'inscription, avec sa filière et son tarif éventuel. */
export interface PromotionOuverte {
  id: string;
  nom: string;
  niveau: string;
  filiere: { code: string; nom: string } | null;
  frais: { montant: number; devise: string } | null;
}

/** Tarif public : le montant et sa devise. */
export interface FraisPublic {
  id?: string;
  montant: number;
  devise: string;
}

/** Récépissé du dépôt : le numéro de dossier et le montant à régler. */
export interface ResultatDepot {
  etudiantId: string;
  inscriptionId: string;
  numero: string;
  montantFrais: number;
  devise: string;
  message: string;
  avertissement?: string | null;
}

/** Formulaire du candidat, y compris l'année et la promotion retenues. */
export interface FormulaireInscription {
  nom: string;
  prenom: string;
  sexe: string | null;
  dateNaissance: string;
  lieuNaissance: string;
  telephone: string;
  email: string;
  adresse: string;
  anneeId: string;
  promotionId: string;
}

/** Corps envoyé au dépôt du dossier. */
export interface DepotInscriptionPublique {
  nom: string;
  prenom: string;
  sexe?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  telephone: string;
  email?: string;
  adresse?: string;
  anneeId?: string;
  promotionId: string;
}

/** Route des années ouvertes à l'inscription. */
export const CHEMIN_ANNEES = '/inscription-publique/annees';

export const inscriptionPubliqueService = {
  /** Années ouvertes à l'inscription : la route rend un tableau nu. */
  annees: async (): Promise<AnneeAcademique[]> => {
    const reponse = await lire<Collection<AnneeAcademique>>(CHEMIN_ANNEES, {});
    return Array.isArray(reponse) ? reponse : [];
  },

  /** Tarif de la promotion retenue pour l'année retenue. */
  frais: async (anneeId: string, promotionId: string): Promise<FraisPublic[]> => {
    const reponse = await lire<Collection<FraisPublic>>('/frais', { anneeId, promotionId });
    return elements(reponse);
  },

  /** Dépose le dossier du candidat. */
  deposer: (corps: DepotInscriptionPublique) =>
    creer<ResultatDepot>('/inscription-publique', corps, { silencieux: true }),
};

/**
 * Route des promotions d'une année. La liste des promotions dérive de l'année
 * : sans année retenue, le sélecteur retombe sur la route des années.
 */
export function cheminPromotions(anneeId: string): string {
  return anneeId ? `${CHEMIN_ANNEES}/${anneeId}/promotions` : CHEMIN_ANNEES;
}

/** Tarif affiché sous le sélecteur de promotion : le premier de la liste. */
export function tarifCourant(frais: FraisPublic[]): { montant: number; devise: string } | null {
  const premier = frais[0];
  return premier ? { montant: premier.montant, devise: premier.devise } : null;
}
