import { useAuthStore } from '../stores/auth';
import { ouvrirImpression } from '../services/impression';

export function useImpressionFicheEnseignant() {
  const auth = useAuthStore();

  const ouvrir = (enseignantId: string, dateDebut?: string, dateFin?: string) => {
    void ouvrirImpression(`/impression/fiche-enseignant/${enseignantId}`, { dateDebut, dateFin });
  };

  return { ouvrir };
}
