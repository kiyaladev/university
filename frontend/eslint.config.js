// ESLint (flat config) du frontend Quasar / Vue 3 / TypeScript.
//
// Configuration minimale, introduite sur un code existant : les règles qui
// signalent une dette connue sont en avertissement pour que `bun run lint`
// passe. Ne pas lancer `--fix` en masse pendant que d'autres branches
// modifient les mêmes fichiers ; corriger au fil des changements.
import js from '@eslint/js';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.quasar/**',
      'node_modules/**',
      'public/**',
      'src-capacitor/**',
      'quasar.config.*.temporary.compiled*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
  },
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, process: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      'prefer-const': 'warn',
      'no-unassigned-vars': 'warn',
      'no-useless-assignment': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-mutating-props': 'warn',
      'vue/no-unused-vars': 'warn',
      'vue/valid-v-slot': ['error', { allowModifiers: true }],
    },
  },
  {
    // Texte en dur dans les gabarits : tout libellé visible doit passer par vue-i18n.
    // Sont tolérés la ponctuation, les flèches et signes (→ − ±) et la chaîne
    // vide des ternaires (`x ? … : ''`), qui ne contiennent rien à traduire.
    files: ['src/**/*.vue'],
    plugins: { '@intlify/vue-i18n': vueI18n },
    settings: { 'vue-i18n': { messageSyntaxVersion: '^9.0.0' } },
    rules: { '@intlify/vue-i18n/no-raw-text': ['warn', { ignorePattern: '^[-#:()&—–·/×+%*|.,…→−±]*$' }] },
  },
  {
    // Scénarios navigateur et outils en Node (CommonJS ou ESM).
    files: ['tests/**/*.{js,mjs,cjs}', '*.cjs'],
    languageOptions: { globals: { ...globals.node } },
    // `no-undef` en avertissement : du code y est évalué dans la page (axe…).
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-undef': 'warn' },
  },
  prettier,
);
