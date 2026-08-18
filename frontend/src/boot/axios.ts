import { defineBoot } from '#q-app/wrappers';
import axios, { type AxiosInstance } from 'axios';
import { Notify } from 'quasar';

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
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('unipresence_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const statut = error.response?.status;
      let message =
        error.response?.data?.message ?? error.message ?? 'Erreur réseau inattendue';

      // Le serveur répond « ThrottlerException: Too many requests » : illisible
      // pour un contrôleur, et en anglais.
      if (statut === 429) {
        message = error.config?.url?.includes('/auth/login')
          ? 'Trop de tentatives de connexion. Patientez un quart d’heure avant de réessayer.'
          : 'Trop de requêtes envoyées. Patientez une minute.';
        error.response.data = { ...error.response.data, message };
      }

      if (statut === 401 && !error.config?.url?.includes('/auth/login')) {
        localStorage.removeItem('unipresence_token');
        void router.push('/connexion');
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
