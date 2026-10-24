/**
 * Emplacement des preuves de recette.
 *
 * Les preuves brutes sont versionnées dans `docs/audits/preuves/<date>/`, la
 * date étant **celle du jour de l'exécution** : une preuve nouvelle ne peut
 * donc pas réécrire une preuve déjà versionnée, dont le contenu fait foi à sa
 * date (voir `docs/audits/README.md`).
 *
 * Les scripts qui écrivaient encore dans `audit/` — dossier supprimé du dépôt
 * — ou dans un dossier de date figée pointent ici.
 */
const fs = require('node:fs');
const path = require('node:path');

/** Racine du dépôt : le dossier `backend/scripts` est deux niveaux plus bas. */
const RACINE = path.resolve(__dirname, '..', '..');

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
function dateDuJour() {
  const maintenant = new Date();
  return new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Dossier des preuves du jour, créé s'il n'existe pas encore. */
function dossierPreuves(date = dateDuJour()) {
  const dossier = path.join(RACINE, 'docs', 'audits', 'preuves', date);
  fs.mkdirSync(dossier, { recursive: true });
  return dossier;
}

/** Écrit une preuve dans le dossier du jour et renvoie son chemin. */
function ecrirePreuve(nom, contenu, date) {
  const cible = path.join(dossierPreuves(date), nom);
  fs.writeFileSync(cible, typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 2) + '\n');
  return cible;
}

module.exports = { dateDuJour, dossierPreuves, ecrirePreuve };
