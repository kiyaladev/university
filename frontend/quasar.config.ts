// Configuration Quasar — UniPrésence
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file
import { defineConfig } from '#q-app/wrappers';

export default defineConfig(() => {
  return {
    boot: ['axios'],

    css: ['app.scss'],

    extras: ['roboto-font', 'material-icons', 'material-icons-outlined'],

    build: {
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20',
      },
      typescript: {
        strict: false,
        vueShim: true,
      },
      vueRouterMode: 'hash',

      // Le contrat de direction vit dans index.html : il doit survivre au build
      // pour rester auditable dans le livrable.
      htmlMinifyOptions: { removeComments: false },
      // L'URL de l'API doit être fournie comme variable d'environnement au
      // moment du build : API_URL=https://… quasar build
      env: {
        API_URL: process.env.API_URL || 'http://localhost:5031/api',
      },
    },

    devServer: {
      open: false,
      port: 5029,
      host: '0.0.0.0',
    },

    framework: {
      // Interface en français (pagination des tableaux, dialogues, dates…)
      lang: 'fr',

      config: {
        // Peintures du panneau. Ces valeurs surchargent les variables Sass à
        // l'exécution : elles doivent rester identiques à quasar.variables.scss,
        // sans quoi deux palettes se disputent l'interface.
        brand: {
          primary: '#10251E', // encre — l'action ; les trois peintures disent l'état
          secondary: '#0F7A45', // vert — séance assurée
          accent: '#EFB700', // jaune — retard
          positive: '#0F7A45',
          negative: '#C4122E', // rouge — absence
          warning: '#EFB700',
          info: '#33463F',
          dark: '#12291F',
          'dark-page': '#0D1F18',
        },
        notify: { position: 'top-right', timeout: 3000 },
      },
      plugins: ['Notify', 'Dialog', 'Loading', 'LocalStorage', 'Dark'],
    },

    animations: ['fadeIn', 'fadeOut'],

    // Application installable sur le téléphone du contrôleur : il l'ouvre depuis
    // son écran d'accueil, en plein écran, et elle démarre sans réseau.
    pwa: {
      workboxMode: 'GenerateSW',
      injectPwaMetaTags: true,
      manifestFilename: 'manifest.json',
      swFilename: 'sw.js',

      extendGenerateSWOptions(cfg) {
        // La coque (HTML, JS, CSS, fontes, icônes) est précachée : c'est elle
        // qui permet d'ouvrir la tournée dans un amphi sans couverture.
        cfg.skipWaiting = false;
        cfg.clientsClaim = true;
        cfg.cleanupOutdatedCaches = true;
        cfg.navigateFallback = 'index.html';

        cfg.runtimeCaching = [
          {
            // Les lectures de l'API : le réseau d'abord, le cache en secours.
            // Une réponse en cache vaut mieux qu'un écran vide en salle, mais
            // elle ne doit jamais primer sur la donnée fraîche.
            urlPattern: ({ url, request }: any) =>
              request.method === 'GET' && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'unipresence-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ];
      },
    },
  };
});
