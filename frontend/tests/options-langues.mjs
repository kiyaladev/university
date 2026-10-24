/** Vérifie les options de filtres traduites après un changement de langue. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15029';
const report = process.argv[3] || '/tmp/university-options-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw Error('Recette réservée à localhost');
}

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.text().includes('intlify')) errors.push(message.text());
});

try {
  await page.addInitScript(() => {
    localStorage.setItem('university_token', 'options-langues-test-token');
    localStorage.setItem('university_lang', 'fr-FR');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { data: [], total: 0 };
    if (url.pathname.endsWith('/auth/me')) {
      body = { id: 'user-test', email: 'qa@example.test', nom: 'QA', prenom: 'Test', role: 'ADMIN' };
    } else if (url.pathname.endsWith('/promotions')) {
      body = { data: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(base + '/#/etudiants', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Étudiants', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Recherche avancée', exact: true }).click();

  async function verifierOptions(label, attendues) {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    const options = page.locator('.q-menu [role="option"]');
    await options.first().waitFor();
    const textes = (await options.allTextContents()).map((t) => t.trim()).filter(Boolean);
    for (const valeur of attendues)
      assert.ok(textes.includes(valeur), `${label}: option ${valeur}, reçues: ${textes.join(', ')}`);
    await page.keyboard.press('Escape');
  }

  await verifierOptions('Statut', ['Actifs', 'Inactifs']);
  await verifierOptions('Genre', ['Masculin', 'Féminin']);

  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('heading', { name: 'Students', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Hide filters', exact: true }).waitFor();
  await verifierOptions('Status', ['Active', 'Inactive']);
  await verifierOptions('Gender', ['Male', 'Female']);
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await page.getByText('Français', { exact: true }).click();
  await page.getByRole('heading', { name: 'Étudiants', exact: true }).waitFor();
  await verifierOptions('Statut', ['Actifs', 'Inactifs']);
  await verifierOptions('Genre', ['Masculin', 'Féminin']);
  assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
  assert.deepEqual(errors, []);

  const result = {
    date: new Date().toISOString(),
    page: '/etudiants',
    api: 'simulée',
    checks: ['statut FR→EN→FR', 'genre FR→EN→FR', 'libellé des filtres FR/EN', 'aucune erreur navigateur'],
  };
  fs.writeFileSync(report, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await context.close();
  await browser.close();
}
