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
import { i18n } from '../boot/i18n';
import { titreRoute } from '../utils/titreRoute';
import { accueilParRole } from '../utils/accueil';
import type { Role } from '../types';
import { useServicesActifsStore } from '../stores/servicesActifs';

/**
 * L'écran d'accueil dépend du rôle : le personnel arrive sur le tableau de
 * bord du contrôle, l'étudiant sur son espace. C'est aussi la porte de sortie
 * quand une adresse est refusée — mieux vaut retomber chez soi que sur un
 * tableau de bord qui ne parle pas de soi.
 */
function accueil(role: Role | null) {
  return accueilParRole(role);
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
    const services = useServicesActifsStore();
    await services.charger();
    if (!services.autorise(to.path)) {
      Notify.create({ type: 'warning', message: i18n.global.t('servicesActifs.unavailable') as string });
      return auth.connecte ? accueil(auth.role) : { name: 'connexion' };
    }

    if (to.meta.public) return true;
    if (!auth.connecte) return { name: 'connexion', query: { suite: to.fullPath } };
    if (!auth.utilisateur) await auth.chargerProfil();
    if (!auth.utilisateur) return { name: 'connexion' };

    // Le tableau de bord est un registre de contrôle : il n'a rien à dire à un
    // étudiant, qui est renvoyé vers son espace.
    if (to.name === 'tableau-de-bord' && accueilParRole(auth.utilisateur.role) !== '/') {
      return accueil(auth.utilisateur.role);
    }

    if (to.meta.roles && !to.meta.roles.includes(auth.utilisateur.role)) {
      // Un renvoi muet donne l'impression d'un lien cassé : on dit pourquoi.
      Notify.create({
        type: 'warning',
        message: i18n.global.t('nav.rubriqueFermee') as unknown as string,
        caption: titreRoute(to.meta.titre),
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
    const titre = titreRoute(to.meta.titre);
    document.title = titre ? `${titre} — UniPrésence` : 'UniPrésence';
  });

  return Router;
});
