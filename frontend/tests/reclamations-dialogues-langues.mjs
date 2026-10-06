/** Recette en lecture seule des dialogues de réclamation FR/EN. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-reclamations-dialogues-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  page.setDefaultTimeout(10000);
  const errors = [];
  const apiFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push({ status: response.status(), path: new URL(response.url()).pathname });
    }
  });
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('direction@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  const loginResponse = page.waitForResponse(response => response.url().includes('/api/auth/login'));
  await page.locator('button[type=submit]').click();
  const login = await loginResponse;
  assert.ok(login.status() >= 200 && login.status() < 300, `Connexion QA refusée (${login.status()})`);
  await page.waitForFunction(() => !location.hash.startsWith('#/connexion'), null, { timeout: 15000 });
  await page.goto(base + '/#/reclamations', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Nouvelle réclamation', exact: true }).click();
  const dialog = page.locator('.q-dialog');
  await dialog.getByText('Sujet *', { exact: true }).waitFor();
  const frCreate = await dialog.innerText();
  for (const text of ['Nature *', 'Sujet *', 'Description *', 'Département concerné', 'Déposer de façon anonyme']) {
    assert.ok(frCreate.includes(text), `Libellé français absent : ${text}`);
  }
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });

  const rows = page.locator('.q-table tbody tr');
  assert.ok(await rows.count(), 'La recette QA doit proposer une réclamation existante');
  await rows.first().click();
  await dialog.getByText(/Fil \(/).waitFor();
  const frDetail = await dialog.innerText();
  for (const text of ['Fil (', 'Description', 'Répondre']) {
    assert.ok(frDetail.includes(text), `Libellé français de détail absent : ${text}`);
  }
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('button', { name: 'New complaint', exact: true }).click();
  const enCreate = await dialog.innerText();
  for (const text of ['Category *', 'Subject *', 'Description *', 'Department concerned', 'Submit anonymously']) {
    assert.ok(enCreate.includes(text), `English label missing: ${text}`);
  }
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await rows.first().click();
  const enDetail = await dialog.innerText();
  for (const text of ['Thread (', 'Description', 'Reply']) {
    assert.ok(enDetail.includes(text), `English detail label missing: ${text}`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const evidence = {
    date: new Date().toISOString(),
    environnement: 'QA locale isolée',
    dialogues: 'Création et détail de réclamation FR/EN',
    erreursJavaScript: errors,
    erreursApi: apiFailures,
    aucuneEcriture: true,
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
