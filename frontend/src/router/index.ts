import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import { Notify } from 'quasar';
import routes from './routes';
import { useAuthStore } from '../stores/auth';
import type { Role } from '../types';

/**
 * L'écran d'accueil dépend du rôle : le personnel arrive sur le tableau de
 * bord du contrôle, l'étudiant sur son espace. C'est aussi la porte de sortie
 * quand une adresse est refusée — mieux vaut retomber chez soi que sur un
 * tableau de bord qui ne parle pas de soi.
 */
function accueil(role: Role | null) {
  return role === 'ETUDIANT' ? { name: 'portail' } : { name: 'tableau-de-bord' };
}

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

    // Le tableau de bord est un registre de contrôle : il n'a rien à dire à un
    // étudiant, qui est renvoyé vers son espace.
    if (to.name === 'tableau-de-bord' && auth.utilisateur.role === 'ETUDIANT') {
      return { name: 'portail' };
    }

    if (to.meta.roles && !to.meta.roles.includes(auth.utilisateur.role)) {
      // Un renvoi muet donne l'impression d'un lien cassé : on dit pourquoi.
      Notify.create({
        type: 'warning',
        message: 'Cette rubrique n’est pas ouverte à votre profil',
        caption: to.meta.titre,
      });
      return accueil(auth.utilisateur.role);
    }
    return true;
  });

  /**
   * `meta.titre` nomme déjà la rubrique dans le bandeau : il nomme désormais
   * aussi l'onglet du navigateur. Sans cela, un agent qui garde le registre,
   * les paiements et les délibérations ouverts côte à côte lit trois fois
   * « UniPrésence » et ne retrouve rien.
   */
  Router.afterEach((to) => {
    document.title = to.meta.titre ? `${to.meta.titre} — UniPrésence` : 'UniPrésence';
  });

  return Router;
});
