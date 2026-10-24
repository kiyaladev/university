import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as enums from '../../src/types/generated/enums';
import type { MethodeVerification, StatutPresence, StatutSuspicionPlagiat } from '../../src/types/generated/enums';

const DOSSIER_TYPES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'types');
const FICHIER_GENERE = join(DOSSIER_TYPES, 'generated', 'enums.ts');

/** Les constantes générées : le module n'exporte que des objets `as const`. */
const constantes = Object.entries(enums).filter(([, valeur]) => typeof valeur === 'object' && valeur !== null);

/** Les fichiers de domaine (hors dossier `generated/`). */
const fichiersDomaines = readdirSync(DOSSIER_TYPES).filter((nom) => nom.endsWith('.ts'));

/** Égalité stricte de deux types, évaluée par le compilateur. */
type Egale<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** L'union des valeurs d'un objet `as const`. */
type ValeursDe<T> = T[keyof T];

describe('énumérations générées depuis le schéma Prisma', () => {
  it('avertit que le fichier ne doit pas être édité', () => {
    const contenu = readFileSync(FICHIER_GENERE, 'utf8');
    expect(contenu).toContain('FICHIER GÉNÉRÉ');
    expect(contenu).toContain('NE PAS MODIFIER');
  });

  it('donne à chaque valeur son propre nom', () => {
    expect(constantes.length).toBeGreaterThanOrEqual(50);
    for (const [nom, valeurs] of constantes) {
      expect(Object.keys(valeurs).length, nom).toBeGreaterThan(0);
      for (const [cle, valeur] of Object.entries(valeurs)) {
        expect(valeur, `${nom}.${cle}`).toBe(cle);
      }
    }
  });

  it('expose un type exactement égal à l’union des valeurs', () => {
    // Ces affectations échouent à la compilation (`bun run typecheck`) si le
    // type exporté dérive de l'union des valeurs de la constante.
    const presence: Egale<StatutPresence, ValeursDe<typeof enums.StatutPresence>> = true;
    const methode: Egale<MethodeVerification, ValeursDe<typeof enums.MethodeVerification>> = true;
    const plagiat: Egale<StatutSuspicionPlagiat, ValeursDe<typeof enums.StatutSuspicionPlagiat>> = true;
    expect([presence, methode, plagiat]).toEqual([true, true, true]);
  });

  it('conserve les valeurs attendues des énumérations citées', () => {
    expect(enums.Role.ADMIN).toBe('ADMIN');
    expect(enums.StatutPresence.ABSENT).toBe('ABSENT');
    expect(enums.MethodeVerification.QR_SALLE).toBe('QR_SALLE');
    expect(enums.StatutSuspicionPlagiat.CONFIRME).toBe('CONFIRME');
    expect(enums.AttestationMode.EMPREINTE).toBe('EMPREINTE');
  });
});

describe('réexports des énumérations par les modules de domaine', () => {
  /** Les enums réexportés par chaque fichier de domaine, avec leur fichier d'origine. */
  const reexports = new Map<string, string[]>();

  for (const nom of fichiersDomaines) {
    const contenu = readFileSync(join(DOSSIER_TYPES, nom), 'utf8');
    for (const bloc of contenu.matchAll(/export type \{([^}]*)\} from '\.\/generated\/enums';/g)) {
      for (const brut of bloc[1].split(',')) {
        const nomEnum = brut.trim();
        if (nomEnum === '') continue;
        reexports.set(nomEnum, [...(reexports.get(nomEnum) ?? []), nom]);
      }
    }
  }

  it('réexporte chaque enum généré exactement une fois', () => {
    for (const [nom] of constantes) {
      expect(reexports.get(nom) ?? [], `enum ${nom}`).toHaveLength(1);
    }
  });

  it('ne réexporte aucun enum inconnu', () => {
    for (const nom of reexports.keys()) {
      expect(
        constantes.map(([cle]) => cle),
        nom,
      ).toContain(nom);
    }
  });
});

describe('types du domaine', () => {
  it('n’écrit plus d’union de valeurs en ligne', () => {
    for (const nom of fichiersDomaines) {
      const contenu = readFileSync(join(DOSSIER_TYPES, nom), 'utf8');
      expect(contenu.match(/:\s*'[A-Z0-9_]+'(\s*\|\s*'[A-Z0-9_]+')+/g) ?? [], nom).toEqual([]);
    }
  });

  it('ne recopie plus les enums du schéma', () => {
    // Les enums viennent tous du schéma Prisma : aucun alias écrit à la main
    // dans les fichiers de domaine. Voir `src/types/README.md`.
    const recopies: string[] = [];
    for (const nom of fichiersDomaines) {
      const contenu = readFileSync(join(DOSSIER_TYPES, nom), 'utf8');
      for (const alias of contenu.matchAll(/export type ([A-Za-z]+)\s*=\s*'([A-Z0-9_]+)'/g)) {
        recopies.push(alias[1]);
      }
    }
    expect(recopies).toEqual([]);
  });
});
