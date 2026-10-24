/** Recette en lecture seule du formulaire de formation FR/EN. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-formation-dialogue-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  page.setDefaultTimeout(10000);
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
  await page.goto(base + '/#/formations-admin', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Nouvelle formation', exact: true }).click();
  const dialog = page.locator('.q-dialog');
  const frText = await dialog.innerText();
  for (const text of [
    'Nouvelle formation',
    'Présentation',
    'Titre de la formation *',
    'Tarif',
    'Prix (GNF) *',
    'Déroulement',
    'Capacité (places)',
  ]) {
    assert.ok(frText.includes(text), `Libellé français absent : ${text}`);
  }
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('button', { name: 'New course', exact: true }).click();
  const enText = await dialog.innerText();
  for (const text of [
    'New course',
    'Overview',
    'Course title *',
    'Price',
    'Price (GNF) *',
    'Schedule',
    'Capacity (seats)',
  ]) {
    assert.ok(enText.includes(text), `English label missing: ${text}`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const evidence = {
    date: new Date().toISOString(),
    environnement: 'QA locale isolée',
    dialogue: 'Création de formation FR/EN',
    erreursJavaScript: errors,
    erreursApi: apiFailures,
    aucuneEcriture: true,
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
