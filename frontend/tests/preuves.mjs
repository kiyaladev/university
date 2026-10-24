/**
 * Écriture des preuves de recette.
 *
 * Les preuves brutes sont versionnées dans `docs/audits/preuves/<date>/`, la
 * date étant **celle du jour de l'exécution** : une preuve nouvelle ne peut
 * donc pas écraser une preuve déjà versionnée, dont le contenu fait foi à sa
 * date (voir `docs/audits/README.md`).
 *
 * L'ancien dossier `audit/` a été supprimé du dépôt : les scénarios qui y
 * écrivaient encore leurs preuves ont été pointés ici.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt : le dossier `frontend/tests` est deux niveaux plus bas. */
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Dossier des preuves du jour : `docs/audits/preuves/AAAA-MM-JJ`. */
export function dossierPreuves() {
  const date = new Date().toISOString().slice(0, 10);
  const dossier = path.join(RACINE, 'docs', 'audits', 'preuves', date);
  fs.mkdirSync(dossier, { recursive: true });
  return dossier;
}

/**
 * Écrit une preuve dans le dossier du jour et renvoie son chemin.
 * Un objet est sérialisé en JSON ; une chaîne est écrite telle quelle.
 */
export function ecrirePreuve(nom, contenu) {
  const cible = path.join(dossierPreuves(), nom);
  fs.writeFileSync(cible, typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 2) + '\n');
  return cible;
}
