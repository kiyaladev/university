import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';

/**
 * Synchronisation entre le schéma Prisma et les énumérations du frontend.
 *
 * Le frontend consomme des énumérations générées depuis le schéma
 * (`frontend/src/types/generated/enums.ts`, produit par
 * `scripts/generer-types-enums.ts`). Ce test vérifie que le fichier
 * versionné correspond bien au client Prisma : un enum ajouté, retiré ou
 * modifié en base est donc repéré ici, même si le fichier généré n'a pas été
 * régénéré.
 *
 * Le test est ignoré si le frontend n'est pas présent dans le dépôt (cas d'un
 * backend seul) : il n'a alors rien à comparer.
 */
const FICHIER_TYPES = join(__dirname, '..', '..', '..', 'frontend', 'src', 'types', 'generated', 'enums.ts');
const FRONTEND_PRESENT = existsSync(FICHIER_TYPES);
const testSync = FRONTEND_PRESENT ? it : it.skip;

/** Les enums du fichier généré, avec leurs valeurs, lus dans le texte du fichier. */
function lireEnumsGeneres(): Map<string, string[]> {
  const contenu = readFileSync(FICHIER_TYPES, 'utf8');
  const enums = new Map<string, string[]>();
  for (const bloc of contenu.matchAll(/export const ([A-Za-z]+) = \{([\s\S]*?)\} as const;/g)) {
    const valeurs = [...bloc[2].matchAll(/'([A-Z0-9_]+)'/g)].map((valeur) => valeur[1]);
    enums.set(bloc[1], valeurs);
  }
  return enums;
}

describe('énumérations du frontend synchronisées avec le schéma Prisma', () => {
  testSync('contient tous les enums du schéma, avec les mêmes valeurs', () => {
    const generes = lireEnumsGeneres();
    const duSchema = new Map(
      Prisma.dmmf.datamodel.enums.map((item) => [item.name, item.values.map((valeur) => valeur.name)]),
    );

    for (const [nom, valeurs] of duSchema) {
      expect(generes.has(nom)).toBe(true);
      expect(generes.get(nom)).toEqual(valeurs);
    }
  });

  testSync('ne contient aucun enum absent du schéma', () => {
    const duSchema = new Set(Prisma.dmmf.datamodel.enums.map((item) => item.name));
    for (const nom of lireEnumsGeneres().keys()) {
      expect(duSchema.has(nom)).toBe(true);
    }
  });
});
