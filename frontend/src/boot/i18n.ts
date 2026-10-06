/**
 * Initialisation de vue-i18n. On lit la préférence langue depuis LocalStorage
 * (clé « lang »), avec repli sur fr-FR. La langue active est exposée à Quasar
 * pour que la chrome (pagination, dates natives) suive, et l'attribut `lang`
 * du <html> est mis à jour en conséquence.
 */
import { defineBoot } from '#q-app/wrappers';
import { Lang } from 'quasar';
import francais from 'quasar/lang/fr';
import anglais from 'quasar/lang/en-US';
import { createI18n } from 'vue-i18n';
import messages from '../i18n';

export type AppLocale = 'fr-FR' | 'en-US';

const STORAGE_KEY = 'lang';

function detectLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
  messages,
});

function appliquerLangueQuasar(locale: AppLocale): void {
  const langue = (locale === 'en-US' ? anglais : francais) as Parameters<typeof Lang.set>[0];
  Lang.set(langue);
}

export function setAppLocale(locale: AppLocale): void {
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

export default defineBoot(({ app }) => {
  app.use(i18n);
  const active = i18n.global.locale.value as AppLocale;
  appliquerLangueQuasar(active);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = active.split('-')[0];
  }
});
