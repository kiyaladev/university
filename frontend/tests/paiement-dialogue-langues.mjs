/** Recette en lecture seule du dialogue de paiement dans les deux langues. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-paiement-dialogue-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  const errors = [];
  const apiFailures = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push({ status: response.status(), path: new URL(response.url()).pathname });
    }
  });
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('admin@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  const loginResponse = page.waitForResponse((response) => response.url().includes('/api/auth/login'));
  await page.locator('button[type=submit]').click();
  const login = await loginResponse;
  assert.ok(login.status() >= 200 && login.status() < 300, `Connexion QA refusée (${login.status()})`);
  await page.waitForFunction(() => !location.hash.startsWith('#/connexion'), null, { timeout: 15000 });
  await page.goto(base + '/#/paiements', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Nouveau paiement', exact: true }).click();
  const dialog = page.locator('.q-dialog');
  await dialog.getByText('À partir d’un dossier d’inscription', { exact: true }).waitFor();
  await dialog.getByText('À partir d’un dossier d’inscription', { exact: true }).click();
  const frText = await dialog.innerText();
  for (const text of ['Dossier *', 'Règlement', 'Mode de paiement *', 'Montant (GNF) *'])
    assert.ok(frText.includes(text), `Libellé français absent : ${text}`);
  await dialog.getByPlaceholder('Tapez n° de dossier ou nom d’étudiant…').waitFor();
  await dialog.getByRole('button', { name: 'Simuler une confirmation réussie', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Enregistrer le paiement', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('button', { name: 'New payment', exact: true }).click();
  await dialog.getByText('From an enrollment file', { exact: true }).click();
  const enText = await dialog.innerText();
  for (const text of ['From an enrollment file', 'Enrollment file *', 'Payment', 'Payment method *', 'Amount (GNF) *'])
    assert.ok(enText.includes(text), `English label missing: ${text}`);
  await dialog.getByPlaceholder('Enter file number or student name…').waitFor();
  await dialog.getByRole('button', { name: 'Simulate successful confirmation', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Save payment', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const evidence = {
    date: new Date().toISOString(),
    environnement: 'QA locale isolée',
    dialogue: 'Paiement FR/EN',
    erreursJavaScript: errors,
    erreursApi: apiFailures,
    aucuneEcriture: true,
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
