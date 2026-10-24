/**
 * Compose le tableau « écran × rôle » de la recette navigateur à partir des
 * preuves JSON écrites par les scénarios.
 *
 *   node tests/navigateur-tableau.mjs [dossier des preuves]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const date = new Date().toISOString().slice(0, 10);
const dossier = process.argv[2] || path.join(RACINE, 'docs', 'audits', 'preuves', date);

const parcours = JSON.parse(fs.readFileSync(path.join(dossier, 'navigateur-parcours.json'), 'utf8'));
const roles = [...new Set(parcours.lignes.map((ligne) => ligne.role))];

/** Écrans réellement ouverts (les lignes « rubrique » ne sont que des repères). */
const ecrans = [...new Set(parcours.lignes.filter((ligne) => ligne.statut !== 'INFO').map((ligne) => ligne.ecran))];

const etat = new Map();
for (const ligne of parcours.lignes) {
  if (ligne.statut === 'INFO') continue;
  etat.set(`${ligne.ecran}|${ligne.role}`, ligne);
}

const lignes = ['| Écran | ' + roles.join(' | ') + ' |', '| --- |' + roles.map(() => ' --- ').join('|') + ' |'];
for (const ecran of ecrans) {
  const cellules = roles.map((role) => {
    const ligne = etat.get(`${ecran}|${role}`);
    if (!ligne) return '—';
    if (ligne.statut === 'OK') return 'OK';
    return 'KO';
  });
  lignes.push(`| ${ecran} | ${cellules.join(' | ')} |`);
}
console.log(lignes.join('\n'));

const ko = parcours.lignes.filter((ligne) => ligne.statut === 'KO');
if (ko.length) {
  console.log('\nÉcrans en échec :');
  for (const ligne of ko) console.log(` • [${ligne.role}] ${ligne.ecran} — ${ligne.erreurs.join(' | ')}`);
}
