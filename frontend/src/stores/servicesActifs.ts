import { defineStore } from 'pinia';
import { api } from '../boot/axios';

export interface ServiceActif { id: string; actif: boolean; obligatoire: boolean; pilote: boolean }
const ROUTES: Record<string, string> = {
  bibliotheque: 'bibliotheque', 'bibliotheque-gestion': 'bibliotheque', plagiat: 'bibliotheque',
  cites: 'logements', resto: 'restauration', stages: 'stages', helpdesk: 'helpdesk',
  formations: 'formations', 'formations-admin': 'formations', patrimoine: 'patrimoine',
  courrier: 'courrier', examens: 'examens', tirage: 'examens', elections: 'elections',
  'cartes-etudiantes': 'cartes', 'ma-carte': 'cartes', 'verification-carte': 'cartes',
  badges: 'badges', 'verification-badge': 'badges', vod: 'vod', notifications: 'notifications',
  rectorat: 'rectorat', 'statistiques-mesrs': 'rectorat', reservations: 'reservations', reclamations: 'reclamations',
};
export function serviceDeRoute(path: string) { return ROUTES[path.split('?')[0].split('/')[1]]; }

export const useServicesActifsStore = defineStore('services-actifs', {
  state: () => ({ services: [] as ServiceActif[], derniereLecture: 0, erreur: false }),
  getters: {
    autorise: state => (path: string) => {
      const id = serviceDeRoute(path);
      return !id || state.services.find(s => s.id === id)?.actif !== false;
    },
    pilote: state => (path: string) => state.services.find(s => s.id === serviceDeRoute(path))?.pilote === true,
  },
  actions: {
    async charger(force = false) {
      if (!force && Date.now() - this.derniereLecture < 60_000) return;
      try {
        const { data } = await api.get('/services-actifs', { silencieux: true });
        if (!Array.isArray(data) || !data.length || data.some(s => typeof s.id !== 'string' || typeof s.actif !== 'boolean' || typeof s.pilote !== 'boolean' || typeof s.obligatoire !== 'boolean')) throw new Error('Invalid services configuration');
        this.services = data;
        this.erreur = false;
      } catch { this.erreur = true; }
      finally { this.derniereLecture = Date.now(); }
    },
    async enregistrer(services: Array<{ id: string; actif: boolean }>) {
      const { data } = await api.put('/services-actifs', { services });
      this.services = data;
      this.derniereLecture = Date.now();
      this.erreur = false;
    },
  },
});
