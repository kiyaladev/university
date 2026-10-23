import { describe, expect, it } from 'vitest';
import messages from '../../src/i18n';

type Arbre = { [cle: string]: string | Arbre };

/** Chemins de toutes les feuilles d'un catalogue (`espace.groupe.cle`). */
function feuilles(arbre: Arbre, prefixe = ''): string[] {
  return Object.entries(arbre).flatMap(([cle, valeur]) => {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    return typeof valeur === 'string' ? [chemin] : feuilles(valeur, chemin);
  });
}

describe('catalogues de traduction', () => {
  const fr = feuilles(messages['fr-FR'] as unknown as Arbre);
  const en = feuilles(messages['en-US'] as unknown as Arbre);

  it('le français et l’anglais ont exactement les mêmes clés', () => {
    expect(fr.filter((cle) => !en.includes(cle))).toEqual([]);
    expect(en.filter((cle) => !fr.includes(cle))).toEqual([]);
  });
});
