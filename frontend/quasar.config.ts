// Configuration Quasar — UniPrésence
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file
import { defineConfig } from '#q-app/wrappers';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// La config est empaquetée par esbuild : elle peut donc reprendre les
// services de l'application, qui n'ont aucune dépendance au navigateur.
import { CACHE_API } from './src/shared/services/cles-stockage';
import { decoderChargeUtile } from './src/shared/services/session';

export default defineConfig((ctx) => {
  const inclureMediasDemo = ctx.dev || Boolean(process.env.QA_BUILD_DIR && process.env.INCLUDE_DEMO_MEDIA === 'true');
  if (ctx.prod && !process.env.API_URL) throw new Error('API_URL est obligatoire pour une compilation de production. Utilisez QA_BUILD_DIR pour isoler une recette.');
  if (ctx.prod && !process.env.QA_BUILD_DIR && /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(new URL(process.env.API_URL!).hostname)) {
    throw new Error('Une API locale exige QA_BUILD_DIR : le dossier servi en production ne doit pas recevoir un build de recette.');
  }
  return {
    boot: ['stockage', 'axios', 'i18n', 'accessibilite'],

    css: ['app.scss'],

    extras: ['roboto-font', 'material-icons', 'material-icons-outlined'],

    build: {
      // `@/` désigne src/ : vite le résout, et Quasar le recopie dans les `paths`
      // du tsconfig généré (.quasar/tsconfig.json) que lit vue-tsc.
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      afterBuild({ quasarConf }) {
        if (!inclureMediasDemo) rmSync(join(quasarConf.build.distDir, 'media', 'demonstration'), { recursive: true, force: true });
      },
      ...(process.env.QA_BUILD_DIR ? { distDir: process.env.QA_BUILD_DIR } : {}),
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
        SHOW_DEMO_ACCOUNTS: ctx.dev && process.env.SHOW_DEMO_ACCOUNTS === 'true',
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
        // Palette Apple. Ces valeurs surchargent les variables Sass à
        // l'exécution : elles doivent rester identiques à quasar.variables.scss,
        // sans quoi deux palettes se disputent l'interface.
        brand: {
          primary: '#007A4D', // le vert du drapeau — la seule couleur d'action
          secondary: '#1D1D1F', // encre — titres et actions neutres
          accent: '#007A4D', // le vert des liens
          positive: '#007A4D',
          negative: '#CE1126', // rouge du drapeau
          warning: '#8A6300', // l'ocre qui porte le texte : le jaune n'en porte pas
          info: '#6E6E73',
          dark: '#1D1D1F',
          'dark-page': '#000000',
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
        if (!inclureMediasDemo) cfg.globIgnores = [...(cfg.globIgnores ?? []), '**/media/demonstration/**'];
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
              request.method === 'GET' && url.pathname.startsWith('/api/') && !url.searchParams.has('token'),
            handler: 'NetworkFirst',
            options: {
              cacheName: CACHE_API,
              plugins: [{
                // Le cache HTTP ignore Authorization : une clé propre à la
                // session empêche de lire le résultat du compte précédent.
                cacheKeyWillBeUsed: async ({ request }: any) => {
                  const authorization = request.headers.get('Authorization') || 'anonymous';
                  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(authorization));
                  const key = Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
                  const url = new URL(request.url);
                  url.searchParams.set('__session', key);
                  return url.toString();
                },
                cachedResponseWillBeUsed: async ({ request, cachedResponse }: any) => {
                  const authorization = request.headers.get('Authorization');
                  if (authorization) {
                    const charge = decoderChargeUtile(authorization);
                    if (!charge?.exp || charge.exp * 1000 <= Date.now()) return null;
                  }
                  return cachedResponse;
                },
              }],
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
