import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires (Vitest) : fonctions pures, composables et services, sans
 * navigateur ni API. Les modules qui dépendent de l'application Quasar
 * (`boot/axios`, `boot/i18n`, `quasar`) sont simulés dans chaque test.
 *
 * Les composants sont eux montés dans un DOM (happy-dom), sur demande : le
 * plugin Vue les compile comme le fait la construction de l'application.
 *
 * Les scénarios navigateur restent dans `tests/*.mjs` (Playwright) et
 * demandent une application lancée : ils ne sont pas exécutés ici.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // Même alias que quasar.config.ts : `@/` désigne src/.
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Le build serveur de Quasar suppose un contexte SSR : les tests
      // montent les composants dans un DOM, il faut donc le build client.
      {
        find: /^quasar$/,
        replacement: fileURLToPath(new URL('./node_modules/quasar/dist/quasar.client.js', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
