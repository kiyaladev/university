import { I18nContext } from 'nestjs-i18n';
import * as fs from 'node:fs';
import * as path from 'node:path';

const francais = new Map<string, Record<string, unknown>>();

/**
 * Récupère le service de traduction i18n du contexte courant, ou `null` si
 * aucun n'est disponible (hors requête HTTP, par exemple). On évite ainsi
 * un crash dans un service utilisé depuis un cron, un boot, ou un test.
 */
export function i18n(): I18nContext | null {
  return I18nContext.current() ?? null;
}

/**
 * Traduit dans la langue courante. Hors requête, utilise le catalogue français
 * : les crons et les tests gardent ainsi des messages métier lisibles au lieu
 * d'exposer une clé technique ou de lever une erreur secondaire.
 */
export function t(key: string, args?: Record<string, unknown>): string {
  const ctx = I18nContext.current();
  // nestjs-i18n attend les variables sous `args`, mais le remplacement manuel
  // du repli ci-dessous les lit à plat. On accepte donc les deux formes et on
  // ne transmet que la première : sans cette conversion, un message comme
  // « {champ} » partait littéralement dans la réponse 400.
  if (ctx) return ctx.t(key, args ? { args } : undefined) as unknown as string;

  const [namespace, ...segments] = key.split('.');
  if (!namespace || !segments.length) return key;

  let catalogue = francais.get(namespace);
  if (!catalogue) {
    try {
      const fichier = path.join(__dirname, '../i18n/fr', `${namespace}.json`);
      catalogue = JSON.parse(fs.readFileSync(fichier, 'utf8')) as Record<string, unknown>;
      francais.set(namespace, catalogue);
    } catch {
      francais.set(namespace, {});
      return key;
    }
  }

  let valeur: unknown = catalogue;
  for (const segment of segments) {
    valeur = valeur && typeof valeur === 'object' ? (valeur as Record<string, unknown>)[segment] : undefined;
  }
  if (typeof valeur !== 'string') return key;

  return valeur.replace(/\{([^}]+)\}/g, (correspondance, nom: string) =>
    args?.[nom] === undefined ? correspondance : String(args[nom]),
  );
}
