/**
 * Génération des énumérations du frontend depuis le schéma Prisma.
 *
 * Sortie : `frontend/src/types/generated/enums.ts` — un objet `as const` et
 * le type associé par enum Prisma. Ce fichier est versionné : il ne doit
 * jamais être édité à la main.
 *
 * Usage :
 *   bun scripts/generer-types-enums.ts           # écrit le fichier généré
 *   bun scripts/generer-types-enums.ts --check   # échoue si le fichier n'est pas à jour
 *
 * Source de vérité : le schéma Prisma, découpé par domaine dans
 * `backend/prisma/schema/*.prisma`. Le client Prisma généré sert uniquement de
 * recoupement : il ne conserve pas les commentaires `///` et peut être périmé
 * tant que `prisma generate` n'a pas été relancé.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_PRISMA = join(RACINE, 'backend', 'prisma');
const SCHEMA_SIMPLE = join(DOSSIER_PRISMA, 'schema.prisma');
const DOSSIER_SCHEMA = join(DOSSIER_PRISMA, 'schema');
const FICHIER_SORTIE = join(RACINE, 'frontend', 'src', 'types', 'generated', 'enums.ts');

/** Une valeur d'enum Prisma, avec son commentaire de documentation et son commentaire de ligne. */
interface ValeurEnum {
  nom: string;
  /** Commentaire `///` précédant la valeur. */
  doc?: string;
  /** Commentaire `//` placé en fin de ligne. */
  commentaire?: string;
}

/** Un enum Prisma, avec ses valeurs et son commentaire de documentation. */
interface EnumPrisma {
  nom: string;
  /** Commentaire `///` précédant la déclaration de l'enum. */
  doc?: string;
  valeurs: ValeurEnum[];
}

/** Les fichiers de schéma à lire : un seul fichier, ou le dossier découpé. */
function fichiersSchemas(): string[] {
  if (existsSync(DOSSIER_SCHEMA)) {
    const fichiers = readdirSync(DOSSIER_SCHEMA)
      .filter((nom) => nom.endsWith('.prisma'))
      .sort()
      .map((nom) => join(DOSSIER_SCHEMA, nom));
    if (fichiers.length > 0) return fichiers;
  }
  if (!existsSync(SCHEMA_SIMPLE)) {
    throw new Error(`Schéma Prisma introuvable : ni ${SCHEMA_SIMPLE} ni ${DOSSIER_SCHEMA}/*.prisma n'existent.`);
  }
  return [SCHEMA_SIMPLE];
}

/** La source affichée dans l'en-tête du fichier généré. */
function sourceAffichee(): string {
  return existsSync(DOSSIER_SCHEMA) ? 'backend/prisma/schema/*.prisma' : 'backend/prisma/schema.prisma';
}

/** Retire la balise `///` d'une ligne de documentation et son espace de début. */
function nettoyerDoc(ligne: string): string {
  return ligne.replace(/^\s*\/\/\/\s?/, '').trimEnd();
}

/**
 * Analyse les blocs `enum` d'un fichier de schéma Prisma.
 *
 * Le format des enums est stable : un nom, puis des valeurs (avec ou sans
 * commentaire de fin de ligne) jusqu'à l'accolade fermante. Les commentaires
 * `///` précédant une déclaration ou une valeur sont conservés.
 */
function analyserSchema(contenu: string): EnumPrisma[] {
  const lignes = contenu.split(/\r?\n/);
  const enums: EnumPrisma[] = [];

  let docEnAttente: string[] = [];
  let enumsCourant: EnumPrisma | null = null;
  let docValeurEnAttente: string[] = [];

  for (const ligne of lignes) {
    if (enumsCourant) {
      const fin = ligne.trim();
      if (fin === '}' || fin.startsWith('}')) {
        enums.push(enumsCourant);
        enumsCourant = null;
        docValeurEnAttente = [];
        continue;
      }
      if (fin === '' || fin.startsWith('//')) continue;

      const valeur = fin.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/);
      if (!valeur) continue;
      const [, nom, reste] = valeur;
      const commentaire = reste.match(/\/\/(.*)$/)?.[1]?.trim();
      enumsCourant.valeurs.push({
        nom,
        ...(docValeurEnAttente.length > 0 ? { doc: docValeurEnAttente.join('\n') } : {}),
        ...(commentaire ? { commentaire } : {}),
      });
      docValeurEnAttente = [];
      continue;
    }

    const doc = ligne.match(/^\s*\/\/\/\s?(.*)$/);
    if (doc) {
      docEnAttente.push(nettoyerDoc(ligne));
      continue;
    }

    const declaration = ligne.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (declaration) {
      enumsCourant = {
        nom: declaration[1],
        ...(docEnAttente.length > 0 ? { doc: docEnAttente.join('\n') } : {}),
        valeurs: [],
      };
      docEnAttente = [];
      continue;
    }

    // Tout autre commentaire (`//`) ou code : le tampon de documentation est abandoned.
    if (ligne.trim() !== '' && !ligne.trim().startsWith('//')) docEnAttente = [];
  }

  if (enumsCourant) throw new Error(`Enum ${enumsCourant.nom} non terminé (accolade fermante manquante).`);

  return enums;
}

/** Lit tous les fichiers de schéma et renvoie la liste des enums, dans l'ordre du schéma. */
function lireEnums(): EnumPrisma[] {
  const fichiers = fichiersSchemas();
  const enums: EnumPrisma[] = [];
  for (const fichier of fichiers) {
    enums.push(...analyserSchema(readFileSync(fichier, 'utf8')));
  }
  const doublons = enums.map((e) => e.nom).filter((nom, index, noms) => noms.indexOf(nom) !== index);
  if (doublons.length > 0) throw new Error(`Enums dupliqués dans le schéma : ${doublons.join(', ')}.`);
  return enums;
}

/**
 * Recoupe les enums du schéma avec le client Prisma généré, quand il est
 * disponible. Un écart n'est pas bloquant : il signale un client périmé
 * (`prisma generate` à relancer), pas un fichier généré faux.
 */
async function recouperAvecClientPrisma(enums: EnumPrisma[]): Promise<void> {
  try {
    const client = (await import(join(DOSSIER_PRISMA, '..', 'node_modules', '@prisma', 'client'))).default;
    const enumsClient = client?.Prisma?.dmmf?.datamodel?.enums;
    if (!Array.isArray(enumsClient)) return;
    const duClient = new Map<string, string[]>(
      enumsClient.map((e: { name: string; values: { name: string }[] }) => [e.name, e.values.map((v) => v.name)]),
    );
    const ecarts: string[] = [];
    for (const item of enums) {
      const valeurs = duClient.get(item.nom);
      if (!valeurs) ecarts.push(`${item.nom} absent du client Prisma`);
      else if (valeurs.join('|') !== item.valeurs.map((v) => v.nom).join('|'))
        ecarts.push(`${item.nom} : valeurs différentes`);
    }
    if (ecarts.length > 0) {
      console.warn(
        `⚠ Client Prisma périmé (${ecarts.length} écart(s)) : ${ecarts.slice(0, 5).join(', ')}. ` +
          'Lancez `prisma generate` dans backend/ pour recaler.',
      );
    }
  } catch {
    // Client Prisma absent ou non généré : le schéma seul fait foi.
  }
}

/** Rend un bloc de documentation TypeScript, ou rien si le texte est vide. */
function blocDoc(texte: string | undefined, indent = ''): string[] {
  if (!texte) return [];
  const lignes = texte.split('\n');
  if (lignes.length === 1) return [`${indent}/** ${lignes[0]} */`];
  return [`${indent}/**`, ...lignes.map((l) => `${indent} * ${l}`.trimEnd()), `${indent} */`];
}

/** Rend le contenu du fichier TypeScript généré. */
function rendre(enums: EnumPrisma[], source: string): string {
  const entete = [
    '/**',
    ' * FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.',
    ' *',
    ` * Source : ${source} (enums Prisma)`,
    ' * Régénération : bun run types:generer',
    ' * Vérification : bun run types:verifier',
    ' *',
    " * Les interfaces de données ne sont pas générées : une réponse de l'API n'est",
    ' * pas un modèle Prisma (champs inclus, champs omis, Decimal converti).',
    ' */',
    '',
  ];

  const blocs = enums.map((item) => {
    const lignes: string[] = [];
    lignes.push(...blocDoc(item.doc));
    lignes.push(`export const ${item.nom} = {`);
    for (const valeur of item.valeurs) {
      lignes.push(...blocDoc(valeur.doc, '  '));
      if (valeur.commentaire) lignes.push(`  // ${valeur.commentaire}`);
      lignes.push(`  ${valeur.nom}: '${valeur.nom}',`);
    }
    lignes.push('} as const;');
    lignes.push('');
    lignes.push(
      `/** Union des valeurs de l'enum \`${item.nom}\`. */`,
      `export type ${item.nom} = (typeof ${item.nom})[keyof typeof ${item.nom}];`,
      '',
    );
    return lignes.join('\n');
  });

  return [...entete, ...blocs].join('\n');
}

/** Point d'entrée : génération ou vérification. */
async function principal(): Promise<void> {
  const verification = process.argv.includes('--check');
  const enums = lireEnums();
  await recouperAvecClientPrisma(enums);

  const source = sourceAffichee();
  const contenu = rendre(enums, source);

  if (verification) {
    const actuel = existsSync(FICHIER_SORTIE) ? readFileSync(FICHIER_SORTIE, 'utf8') : null;
    if (actuel === contenu) {
      console.log(`✔ ${enums.length} enums à jour (${source}).`);
      return;
    }
    console.error(
      `✖ ${FICHIER_SORTIE.slice(RACINE.length + 1)} n'est pas à jour.\n` +
        '  Lancez `bun run types:generer` puis versionnez le fichier généré.',
    );
    if (actuel === null) console.error('  Le fichier généré est absent.');
    process.exit(1);
  }

  mkdirSync(dirname(FICHIER_SORTIE), { recursive: true });
  writeFileSync(FICHIER_SORTIE, contenu, 'utf8');
  console.log(`✔ ${enums.length} enums écrits dans ${FICHIER_SORTIE.slice(RACINE.length + 1)} (${source}).`);
}

await principal();
