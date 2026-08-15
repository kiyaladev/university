import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { useAuthStore } from '../stores/auth';

export default defineRouter(function () {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Garde d'accès : jeton obligatoire, puis contrôle du rôle.
  Router.beforeEach(async (to) => {
    const auth = useAuthStore();

    if (to.meta.public) return true;
    if (!auth.connecte) return { name: 'connexion', query: { suite: to.fullPath } };
    if (!auth.utilisateur) await auth.chargerProfil();
    if (!auth.utilisateur) return { name: 'connexion' };

    if (to.meta.roles && !to.meta.roles.includes(auth.utilisateur.role)) {
      return { name: 'tableau-de-bord' };
    }
    return true;
  });

  return Router;
});
