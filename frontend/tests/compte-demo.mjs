/** Vérifie que l'écran de connexion ne révèle aucun accès partagé de démonstration. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-demo-ui.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Contrôle réservé à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  const body = await page.locator('body').innerText();
  assert.match(body, /Connexion/);
  assert.doesNotMatch(body, /Comptes de démonstration|Passer@2026|controleur1@unipresence\.gn/);
  assert.deepEqual(errors, []);
  const evidence = {
    date: new Date().toISOString(),
    environnement: 'PWA QA locale isolée',
    formulaireConnexion: true,
    identifiantsDemoAffiches: false,
    erreursJavaScript: errors,
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
