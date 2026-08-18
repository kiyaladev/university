import { API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';

export function useImpressionFicheEnseignant() {
  const ouvrir = (enseignantId: string, dateDebut?: string, dateFin?: string) => {
    const auth = useAuthStore();
    const params = new URLSearchParams();
    if (dateDebut) params.set('dateDebut', dateDebut);
    if (dateFin) params.set('dateFin', dateFin);
    params.set('token', auth.token ?? '');
    const url = `${API_URL}/impression/fiche-enseignant/${enseignantId}?${params}`;
    window.open(url, '_blank');
  };

  return { ouvrir };
}
