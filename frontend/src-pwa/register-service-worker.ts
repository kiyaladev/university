import { register } from 'register-service-worker';
import { Notify } from 'quasar';

/**
 * Enregistrement du service worker.
 *
 * La coque de l'application est mise en cache : le contrôleur ouvre sa tournée
 * même sans réseau dans l'amphi, et les pointages partent de la file d'attente
 * au retour de la connexion (voir stores/pointages.ts).
 */
register(process.env.SERVICE_WORKER_FILE, {
  cached() {
    Notify.create({
      message: 'Application disponible hors ligne',
      caption: 'La tournée s’ouvre désormais même sans réseau.',
      icon: 'cloud_done',
      color: 'positive',
      timeout: 4000,
    });
  },

  updated() {
    // Une version plus récente est en place : le contrôleur doit la prendre,
    // sinon il pointe avec un écran périmé pour le reste de sa tournée.
    Notify.create({
      message: 'Nouvelle version disponible',
      caption: 'Rechargez pour l’appliquer.',
      icon: 'system_update_alt',
      color: 'primary',
      timeout: 0,
      actions: [
        {
          label: 'Recharger',
          color: 'white',
          handler: () => window.location.reload(),
        },
        { label: 'Plus tard', color: 'white' },
      ],
    });
  },

  offline() {
    // Le bandeau hors ligne de l'écran de contrôle porte déjà l'information.
  },

  error(err) {
    console.error('Service worker : enregistrement impossible', err);
  },
});
