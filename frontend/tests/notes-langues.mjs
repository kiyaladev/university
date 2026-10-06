/** Recette en lecture seule de la saisie de notes en français et anglais. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-notes-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  const errors = [];
  const apiFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) apiFailures.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('scolarite@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.hash.startsWith('#/connexion'));
  await page.goto(base + '/#/notes', { waitUntil: 'networkidle' });
  await page.locator('.page-titre').filter({ hasText: 'Saisie des notes' }).waitFor();

  const champ = page.getByRole('combobox', { name: 'Évaluation à noter' });
  const reponsePromise = page.waitForResponse(response => response.url().includes('/api/evaluations?'));
  await champ.focus();
  const reponse = await reponsePromise;
  assert.equal(reponse.status(), 200);
  const payload = await reponse.json();
  const evaluations = Array.isArray(payload) ? payload : payload.data;
  assert.ok(Array.isArray(evaluations) && evaluations.length > 0, 'La recette QA doit proposer une évaluation');
  const evaluation = evaluations.find(item => item.statut === 'OUVERTE') ?? evaluations[0];
  assert.ok(evaluation.id, 'Une évaluation QA doit avoir un identifiant');
  await page.goto(`${base}/#/notes?evaluation=${encodeURIComponent(evaluation.id)}`, { waitUntil: 'networkidle' });
  await page.locator('.saisie-masse').waitFor({ timeout: 12000 });
  await page.getByText('N° inscription', { exact: true }).waitFor();
  await page.getByText('Note /20', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByText('Enrollment no.', { exact: true }).waitFor();
  await page.getByText('Grade /20', { exact: true }).waitFor();
  assert.deepEqual(errors, []);

  const evidence = {
    date: new Date().toISOString(),
    environnement: 'QA locale isolée',
    evaluationsDisponibles: evaluations.length,
    colonnesEtActions: ['FR', 'EN'],
    erreursJavaScript: errors,
    erreursApi: apiFailures,
    aucuneEcriture: true,
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
