import { defineBoot } from '#q-app/wrappers';
import axios from 'axios';
import { Notify } from 'quasar';
import { getAppLocale, i18n } from './i18n';
import { effacerToken, lireToken } from '@/shared/services/session';
import { normaliserJetonsStatuts } from '@/shared/utils/statuts';

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

export default defineBoot(({ router }) => {
  if ('caches' in window) void caches.delete('unipresence-api');
  api.interceptors.request.use((config) => {
    config.headers['Accept-Language'] = getAppLocale();
    const token = lireToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      // Jetons d'état : une API pas encore migrée répond avec l'ancienne
      // écriture (`ANNULEE`). On convertit à la réception pour que
      // l'interface reste juste pendant un déploiement partiel ou un retour
      // arrière (voir docs/decisions/statuts.md).
      if (response.data) response.data = normaliserJetonsStatuts(response.data);
      return response;
    },
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
            ? i18n.global.t('common.http.timeout')
            : i18n.global.t('common.http.unreachable')
          : i18n.global.t('common.http.unexpected', { statut }));

      // Le serveur répond « ThrottlerException: Too many requests » : illisible
      // pour un contrôleur, et en anglais.
      if (statut === 429) {
        message = error.config?.url?.includes('/auth/login')
          ? i18n.global.t('common.http.tooManyLogins')
          : i18n.global.t('common.http.tooManyRequests');
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
});

export { api };
