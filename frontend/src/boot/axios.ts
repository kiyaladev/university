import { defineBoot } from '#q-app/wrappers';
import axios, { type AxiosInstance } from 'axios';
import { Notify } from 'quasar';
import { getAppLocale } from './i18n';
import { effacerToken, lireToken } from '../services/session';

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: AxiosInstance;
  }
}

/**
 * Option maison lue par l'intercepteur : une requête « silencieuse » n'affiche
 * pas de notification d'erreur, la page se charge de le dire elle-même (code
 * OTP faux, référentiel accessoire absent…). Elle était passée partout avec un
 * `as never` faute d'être déclarée ; elle l'est désormais.
 */
declare module 'axios' {
  interface AxiosRequestConfig {
    silencieux?: boolean;
  }
}

/** URL de l'API : fournie au build via la variable d'environnement API_URL. */
export const API_URL = process.env.API_URL || 'http://localhost:5031/api';

const api = axios.create({ baseURL: API_URL, timeout: 20000 });

export default defineBoot(({ app, router }) => {
  if ('caches' in window) void caches.delete('unipresence-api');
  api.interceptors.request.use((config) => {
    config.headers['Accept-Language'] = getAppLocale();
    const token = lireToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    // `async` : on doit réinitialiser le store avant de naviguer, sinon la
    // garde de routes lit encore `connecte === true` et laisse repasser.
    async (error) => {
      const statut = error.response?.status;
      // Sans message du serveur, `error.message` d'axios est en anglais
      // (« Network Error », « timeout of 20000ms exceeded »…) : on le traduit.
      let message =
        error.response?.data?.message ??
        (!error.response
          ? error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
            ? 'Le serveur met trop de temps à répondre. Réessayez dans un instant.'
            : 'Serveur injoignable : vérifiez votre connexion réseau.'
          : `Erreur inattendue du serveur (code ${statut}).`);

      // Le serveur répond « ThrottlerException: Too many requests » : illisible
      // pour un contrôleur, et en anglais.
      if (statut === 429) {
        message = error.config?.url?.includes('/auth/login')
          ? 'Trop de tentatives de connexion. Patientez un quart d’heure avant de réessayer.'
          : 'Trop de requêtes envoyées. Patientez une minute.';
        error.response.data = { ...error.response.data, message };
      }

      if (statut === 401 && !error.config?.url?.includes('/auth/login')) {
        // Le jeton est refusé : on efface la clé ET le store. Ne faire que le
        // premier laissait `auth.connecte` à `true` et l'utilisateur restait
        // dans une coquille « connecté » où chaque requête repart en 401.
        effacerToken();
        try {
          // Import dynamique : le store importe déjà `api`, un import statique
          // ici fermerait un cycle.
          const { useAuthStore } = await import('../stores/auth');
          useAuthStore().deconnexion();
        } catch {
          // Le store indisponible ne doit pas empêcher la redirection.
        }
        if (router.currentRoute.value.path !== '/connexion') {
          void router.push('/connexion');
        }
      } else if (
        statut !== 401 &&
        // La page de connexion affiche déjà le motif dans son bandeau.
        !error.config?.url?.includes('/auth/login') &&
        !error.config?.silencieux
      ) {
        Notify.create({
          type: 'negative',
          message: Array.isArray(message) ? message.join(' · ') : message,
        });
      }
      return Promise.reject(error);
    },
  );

  app.config.globalProperties.$api = api;
});

export { api };
