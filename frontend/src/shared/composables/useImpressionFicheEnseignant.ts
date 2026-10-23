import { ouvrirImpression } from '@/shared/services/impression';

export function useImpressionFicheEnseignant() {
  const ouvrir = (enseignantId: string, dateDebut?: string, dateFin?: string) => {
    void ouvrirImpression(`/impression/fiche-enseignant/${enseignantId}`, { dateDebut, dateFin });
  };

  return { ouvrir };
}
