import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import messagesFR from '../../src/i18n/fr-FR/index';
import messagesEN from '../../src/i18n/en-US/index';

type Arbre = { [cle: string]: string | Arbre };

/** Chemins de toutes les feuilles d'un catalogue (`espace.groupe.cle`). */
function feuilles(arbre: Arbre, prefixe = ''): string[] {
  return Object.entries(arbre).flatMap(([cle, valeur]) => {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    return typeof valeur === 'string' ? [chemin] : feuilles(valeur, chemin);
  });
}

const SRC = join(__dirname, '../../src');

/** Fichiers .ts / .vue de src, catalogues exclus. */
function sources(dossier = SRC): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return chemin === join(SRC, 'i18n') ? [] : sources(chemin);
    return /\.(ts|vue)$/.test(entree.name) ? [chemin] : [];
  });
}

/**
 * Clés littérales passées à t / $t / te / $te / i18n.global.t(e), ou à
 * `<i18n-t keypath="…">`. Les clés construites (`statuts.${s}`) sont ignorées.
 */
const APPEL = /(?:\$t|\$te|\bte|\bt|i18n\.global\.te?)\(\s*(['"`])([\w.-]+)\1|keypath="([\w.-]+)"/g;

describe('catalogues de traduction', () => {
  const fr = feuilles(messagesFR as unknown as Arbre);
  const en = feuilles(messagesEN as unknown as Arbre);

  it('le français et l’anglais ont exactement les mêmes clés', () => {
    expect(fr.filter((cle) => !en.includes(cle))).toEqual([]);
    expect(en.filter((cle) => !fr.includes(cle))).toEqual([]);
  });

  it('chaque clé littérale utilisée dans src existe en fr-FR', () => {
    const connues = new Set(fr);
    const manquantes: string[] = [];
    for (const fichier of sources()) {
      for (const m of readFileSync(fichier, 'utf8').matchAll(APPEL)) {
        const cle = m[2] ?? m[3];
        if (!connues.has(cle)) manquantes.push(`${relative(SRC, fichier)} : ${cle}`);
      }
    }
    expect(manquantes).toEqual([]);
  });
});
