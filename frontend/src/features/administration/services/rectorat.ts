import { creer, lire } from '@/shared/services/http';
import type {
  FeuillePaie,
  Liste,
  StatistiqueMesrs,
  TableauBordPatrimoine,
  TableauBordRectorat,
} from '@/types';

/**
 * Tableau de bord du rectorat (`/rectorat`) et bilans MESRS.
 *
 * - `GET /rectorat/chiffres` : les indicateurs de l'année (effectif, réussite,
 *   masse salariale, réclamations…).
 * - `GET /patrimoine/dashboard` : les équipements obsolètes affichés à côté.
 *   L'API est interrogeée avec le même `anneeId` que les chiffres.
 * - `GET /rectorat/bilan-mesrs` : les instantanés de bilan déjà produits.
 * - `POST /rectorat/bilan-mesrs/generer` : produit un bilan pour une année.
 */

/** Filtres communs aux tableaux de bord du rectorat. */
export type ParamsRectorat = {
  anneeId?: string | null;
};

/** Filtres des bilans MESRS : l'année, et le type de bilan retenu. */
export type ParamsBilansMesrs = {
  anneeId?: string | null;
  type?: string | null;
};

/** Une ligne de la courbe d'évolution de la masse salariale. */
export interface PointMasseSalariale {
  /** Mois au format `AAAA-MM`. */
  cle: string;
  total: number;
}

/** Nombre de mois de la courbe d'évolution. */
export const MOIS_EVOLUTION_MASSE = 12;

export const rectoratService = {
  /** Indicateurs du rectorat pour une année (ou l'année courante). */
  chiffres: (params: ParamsRectorat = {}) => lire<TableauBordRectorat>('/rectorat/chiffres', params),

  /** Synthèse du patrimoine : obsolètes, en réparation, total. */
  patrimoine: (params: ParamsRectorat = {}) => lire<TableauBordPatrimoine>('/patrimoine/dashboard', params),

  /** Instantanés de bilan MESRS, filtrés par année et par type. */
  bilansMesrs: (params: ParamsBilansMesrs = {}) =>
    lire<StatistiqueMesrs[] | Liste<StatistiqueMesrs>>('/rectorat/bilan-mesrs', params),

  /** Produit un bilan MESRS pour une année. */
  genererBilanMesrs: (anneeId: string) => creer<void>('/rectorat/bilan-mesrs/generer', { anneeId }),

  /** Toutes les feuilles de paie, sans pagination. */
  feuillesPaie: () => lire<FeuillePaie[] | Liste<FeuillePaie>>('/feuilles-paie', { all: '1' }),
};

/** Normalise la réponse des feuilles de paie (tableau nu ou page `{ data }`). */
export function listeFeuillesPaie(reponse: FeuillePaie[] | Liste<FeuillePaie>): FeuillePaie[] {
  return Array.isArray(reponse) ? reponse : (reponse.data ?? []);
}

/** Normalise la réponse des bilans MESRS (tableau nu ou page `{ data }`). */
export function listeBilansMesrs(reponse: StatistiqueMesrs[] | Liste<StatistiqueMesrs>): StatistiqueMesrs[] {
  return Array.isArray(reponse) ? reponse : (reponse.data ?? []);
}

/**
 * L'API n'expose pas l'évolution mensuelle : on l'agrège à partir des feuilles
 * de paie sur les douze derniers mois, plutôt que d'ouvrir une route de plus.
 * Une feuille compte à partir du moment où elle est validée — c'est là que son
 * montant est figé — et se range au mois de sa validation.
 *
 * La fonction est pure : elle ne dépend ni de l'API ni de la langue active
 * (le libellé du mois est ajouté par l'écran).
 */
export function evolutionMasseSalariale(
  feuilles: FeuillePaie[],
  maintenant: Date = new Date(),
): PointMasseSalariale[] {
  const mois: PointMasseSalariale[] = [];
  for (let i = MOIS_EVOLUTION_MASSE - 1; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push({
      cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      total: 0,
    });
  }
  for (const f of feuilles) {
    const reference = f.valideeLe ?? f.payeeLe;
    if (!reference) continue;
    const dateRef = new Date(reference);
    if (Number.isNaN(dateRef.getTime())) continue;
    const cle = `${dateRef.getFullYear()}-${String(dateRef.getMonth() + 1).padStart(2, '0')}`;
    const m = mois.find((x) => x.cle === cle);
    if (m) m.total += f.montantTotal ?? 0;
  }
  return mois;
}
