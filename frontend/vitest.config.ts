import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires (Vitest) : fonctions pures, composables et services, sans
 * navigateur ni API. Les modules qui dépendent de l'application Quasar
 * (`boot/axios`, `boot/i18n`, `quasar`) sont simulés dans chaque test.
 *
 * Les scénarios navigateur restent dans `tests/*.mjs` (Playwright) et
 * demandent une application lancée : ils ne sont pas exécutés ici.
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
