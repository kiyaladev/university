/** Recette en lecture seule du dialogue de dépôt de document en français et anglais. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-document-dialogue-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  page.setDefaultTimeout(8000);
  const errors = [];
  const apiFailures = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push({ status: response.status(), path: new URL(response.url()).pathname });
    }
  });
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('direction@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  const loginResponse = page.waitForResponse((response) => response.url().includes('/api/auth/login'));
  await page.locator('button[type=submit]').click();
  const login = await loginResponse;
  assert.ok(login.status() >= 200 && login.status() < 300, `Connexion QA refusée (${login.status()})`);
  await page.waitForFunction(() => !location.hash.startsWith('#/connexion'), null, { timeout: 15000 });
  await page.goto(base + '/#/bibliotheque-gestion', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Déposer un document', exact: true }).click();
  const dialog = page.locator('.q-dialog');
  await dialog.getByText('Fiche du document', { exact: true }).waitFor();
  const frText = await dialog.innerText();
  for (const text of [
    'Fiche du document',
    'Titre *',
    'Type *',
    'Auteurs',
    'Résumé',
    'Mots-clés',
    'Fichier (archivage natif)',
    'PDF joint',
  ]) {
    assert.ok(frText.includes(text), `Libellé français absent : ${text}`);
  }
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('button', { name: 'Deposit a document', exact: true }).click();
  await dialog.getByText('Document details', { exact: true }).waitFor();
  const enText = await dialog.innerText();
  for (const text of [
    'Document details',
    'Title *',
    'Type *',
    'Authors',
    'Abstract',
    'Keywords',
    'File (native archiving)',
    'Attached PDF',
  ]) {
    assert.ok(enText.includes(text), `English label missing: ${text}`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const evidence = {
    date: new Date().toISOString(),
    environnement: 'QA locale isolée',
    dialogue: 'Dépôt de document FR/EN',
    erreursJavaScript: errors,
    erreursApi: apiFailures,
    aucuneEcriture: true,
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
