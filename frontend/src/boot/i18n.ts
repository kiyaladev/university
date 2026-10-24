/**
 * Initialisation de vue-i18n. On lit la préférence langue depuis LocalStorage
 * (clé CLE_LANGUE, ancienne clé « lang » en repli), avec repli sur fr-FR. La langue active est exposée à Quasar
 * pour que la chrome (pagination, dates natives) suive, et l'attribut `lang`
 * du <html> est mis à jour en conséquence.
 *
 * Les messages ne sont pas importés : la langue active est chargée à la
 * demande (voir `src/i18n/index.ts`), l'autre quand l'on change de langue.
 */
import { defineBoot } from '#q-app/wrappers';
import { Lang } from 'quasar';
import francais from 'quasar/lang/fr';
import anglais from 'quasar/lang/en-US';
import { createI18n } from 'vue-i18n';
import { chargerMessages, type AppLocale } from '../i18n';
import { CLE_LANGUE, CLE_LANGUE_LEGACY } from '@/shared/services/cles-stockage';

export type { AppLocale };

const STORAGE_KEY = CLE_LANGUE;

function detectLocale(): AppLocale {
  try {
    // La langue est lue dès l'import du module, donc avant la reprise des
    // clés de stockage (voir boot/stockage.ts) : l'ancien nom de la clé est
    // encore consulté par défaut.
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(CLE_LANGUE_LEGACY);
    if (stored === 'fr-FR' || stored === 'en-US') return stored;
  } catch {
    /* localStorage indisponible : on consulte le navigateur */
  }
  // Aucun choix enregistré : on écoute la langue du navigateur plutôt que de
  // imposer le français à un poste anglophone.
  const langue = typeof navigator !== 'undefined' ? navigator.language : '';
  if (/^en/i.test(langue)) return 'en-US';
  return 'fr-FR';
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'fr-FR',
  // Les messages arrivent par `setLocaleMessage` : la langue active est
  // chargée avant le démarrage, l'autre à la demande.
  messages: {},
});

function appliquerLangueQuasar(locale: AppLocale): void {
  const langue = (locale === 'en-US' ? anglais : francais) as Parameters<typeof Lang.set>[0];
  Lang.set(langue);
}

/** Charge les messages d'une langue s'ils ne le sont pas déjà. */
async function chargerSiBesoin(locale: AppLocale): Promise<void> {
  // `getLocaleMessage` rend le catalogue de la langue, ou un objet vide si
  // elle n'est pas encore chargée : même comportement que la lecture directe
  // de `messages.value[locale]`.
  if (Object.keys(i18n.global.getLocaleMessage(locale)).length) return;
  i18n.global.setLocaleMessage(locale, await chargerMessages(locale));
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  // On charge d'abord : changer de langue avant le chargement laisserait
  // l'écran afficher des clés brutes.
  await chargerSiBesoin(locale);
  i18n.global.locale.value = locale;
  appliquerLangueQuasar(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* silencieux */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale.split('-')[0];
  }
}

export function getAppLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}

export default defineBoot(async ({ app }) => {
  const active = i18n.global.locale.value as AppLocale;
  await chargerSiBesoin(active);
  app.use(i18n);
  appliquerLangueQuasar(active);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = active.split('-')[0];
  }
});
