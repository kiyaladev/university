import { creer } from '@/shared/services/http';

/**
 * Imports de référentiels (`/imports/referentiels`).
 *
 * Le fichier est converti en CSV côté écran puis envoyé en clair : l'API
 * analyse le contenu, elle ne reçoit pas de pièce jointe.
 */

/** Référentiels importables. */
export type TypeImport = 'enseignants' | 'matieres' | 'salles' | 'creneaux';

/** Ligne rejetée, avec le motif de chaque erreur. */
export interface LigneErreur {
  numero: number;
  erreurs: string[];
}

/** Aperçu renvoyé par la prévisualisation, avant toute écriture. */
export interface Apercu {
  type: TypeImport;
  colonnesIgnorees?: string[];
  lignesLues: number;
  valides: number;
  rejetees: number;
  apercu: Array<{ numero: number; donnees: Record<string, unknown>; erreurs: string[] }>;
  erreurs: LigneErreur[];
}

/** Bilan de l'import appliqué. */
export interface Rapport {
  importees: number;
  rejetees: number;
  erreurs: LigneErreur[];
  colonnesIgnorees?: string[];
}

/** Corps envoyé à l'API : le type de référentiel et le contenu du fichier. */
export interface ContenuImport {
  type: TypeImport;
  contenu: string;
}

/** Taille maximale d'un fichier XLSX (5 Mo). */
export const TAILLE_MAX_XLSX = 5_000_000;
/** Taille maximale d'un fichier CSV (1 Mo). */
export const TAILLE_MAX_CSV = 1_000_000;
/** Taille maximale du contenu texte transmis à l'API. */
export const CONTENU_MAX = 1_000_000;

/** Le fichier est-il un classeur Excel ? */
export function estFichierXlsx(nom: string): boolean {
  return nom.toLocaleLowerCase('fr').endsWith('.xlsx');
}

/** Le fichier est-il un CSV ? */
export function estFichierCsv(nom: string): boolean {
  return nom.toLocaleLowerCase('fr').endsWith('.csv');
}

/** Le fichier tient-il dans la taille admise pour son format ? */
export function tailleFichierAutorisee(taille: number, xlsx: boolean): boolean {
  return taille <= (xlsx ? TAILLE_MAX_XLSX : TAILLE_MAX_CSV);
}

export const importsService = {
  /** Analyse le fichier sans rien écrire : renvoie l'aperçu et les erreurs. */
  previsualiser: (corps: ContenuImport) =>
    creer<Apercu>('/imports/referentiels/previsualiser', corps, { timeout: 60_000 }),

  /** Écrit les lignes valides du fichier. */
  appliquer: (corps: ContenuImport) =>
    creer<Rapport>('/imports/referentiels/appliquer', corps, { timeout: 120_000 }),
};
