import { creer, lire } from '@/shared/services/http';
import type { DocumentDepot, SuspicionPlagiat } from '@/types';

/**
 * Détection de plagiat (`/documents/plagiat`).
 *
 * - `GET /documents/plagiat` : le tableau de bord complet — file d'attente,
 *   compteurs globaux et top des documents. L'API ne filtre ni ne pagine :
 *   le tri, la recherche et la pagination sont faits à l'écran.
 * - `GET /documents/plagiat/:id` : le détail d'une suspicion.
 * - `POST /documents/plagiat/:id/acquitter` : la décision (acquittée ou confirmée).
 * - `POST /documents/recalculer-plagiat` : relance la détection sur les documents.
 */

/** Compteurs globaux de la file d'attente de plagiat. */
export interface KpisPlagiat {
  total: number;
  scoreMoyen: number;
  enAttente: number;
  acquittees: number;
  confirmees: number;
}

/** Un document du « top » : combien de fois il a été impliqué dans une suspicion. */
export interface DocumentTop {
  id: string;
  titre: string;
  compte: number;
}

/** Le tableau de bord de plagiat, une fois normalisé. */
export interface TableauDeBordPlagiat {
  kpis: KpisPlagiat;
  suspicions: SuspicionPlagiat[];
  topDocuments: DocumentTop[];
}

/** Décision prise sur une suspicion. */
export type DecisionPlagiat = 'ACQUITTE' | 'CONFIRME';

/** Corps de la décision : le motif n'est obligatoire que pour une confirmation. */
export interface DecisionSuspicion {
  decision: DecisionPlagiat;
  commentaire?: string;
}

/** Récapitulatif d'un recalcul de détection. */
export interface RecapitulatifRecalcul {
  creees: number;
  misesAJour: number;
  ignorees: number;
}

export const plagiatService = {
  /** File d'attente, compteurs et top des documents. */
  tableauDeBord: () => lire<unknown>('/documents/plagiat'),

  /** Détail d'une suspicion. */
  suspicion: (id: string) => lire<SuspicionPlagiat>(`/documents/plagiat/${id}`),

  /** Accepte une suspicion (acquittée ou confirmée). */
  acquitter: (id: string, corps: DecisionSuspicion) =>
    creer<Partial<SuspicionPlagiat>>(`/documents/plagiat/${id}/acquitter`, corps),

  /** Relance la détection sur les documents déposés. */
  recalculer: () => creer<RecapitulatifRecalcul>('/documents/recalculer-plagiat', {}),

  /** Un document déposé, avec son texte plein. */
  document: (id: string) => lire<DocumentDepot>(`/documents/${id}`),
};

/**
 * Normalise le tableau de bord renvoyé par l'API : les compteurs sont mis à
 * zéro quand la clé manque, et le « top » est agrégé par document — l'API le
 * renvoie sous forme de suspicions, pas de documents.
 */
export function lireTableauDeBordPlagiat(data: unknown): TableauDeBordPlagiat {
  const brut = (data ?? {}) as {
    kpis?: Partial<KpisPlagiat>;
    suspicions?: SuspicionPlagiat[];
    topDix?: SuspicionPlagiat[];
  };
  const kpis: KpisPlagiat = {
    total: brut.kpis?.total ?? 0,
    scoreMoyen: brut.kpis?.scoreMoyen ?? 0,
    enAttente: brut.kpis?.enAttente ?? 0,
    acquittees: brut.kpis?.acquittees ?? 0,
    confirmees: brut.kpis?.confirmees ?? 0,
  };

  const compteur = new Map<string, DocumentTop>();
  for (const s of brut.topDix ?? []) {
    for (const d of [s.documentA, s.documentB]) {
      if (!d) continue;
      const ex = compteur.get(d.id);
      if (ex) ex.compte += 1;
      else compteur.set(d.id, { id: d.id, titre: d.titre, compte: 1 });
    }
  }
  const topDocuments = Array.from(compteur.values())
    .sort((a, b) => b.compte - a.compte)
    .slice(0, 5);

  return { kpis, suspicions: brut.suspicions ?? [], topDocuments };
}

/** Normalise le récapitulatif d'un recalcul de détection. */
export function lireRecapitulatifRecalcul(data: unknown): RecapitulatifRecalcul {
  const brut = (data ?? {}) as Partial<RecapitulatifRecalcul>;
  return {
    creees: brut.creees ?? 0,
    misesAJour: brut.misesAJour ?? 0,
    ignorees: brut.ignorees ?? 0,
  };
}

/**
 * Texte plein d'un document : celui du soupçon s'il est déjà là, sinon celui
 * que l'API rend. Un document illisible ne fait pas échouer la comparaison.
 */
export async function texteDocument(doc: DocumentDepot | null | undefined): Promise<string> {
  if (!doc) return '';
  if (doc.contenuTexte) return doc.contenuTexte;
  try {
    const detail = await plagiatService.document(doc.id);
    return (detail?.contenuTexte ?? '').toString();
  } catch {
    return '';
  }
}
