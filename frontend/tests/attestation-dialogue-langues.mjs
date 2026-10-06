/** Recette en lecture seule du formulaire d'émission d'attestation FR/EN. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-attestation-dialogue-langues.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR' });
  page.setDefaultTimeout(Number(process.env.QA_BROWSER_TIMEOUT_MS || 10000));
  const errors = [];
  const apiFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push({ status: response.status(), path: new URL(response.url()).pathname });
    }
  });
  if (process.env.QA_SESSION_FILE) {
    const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE, 'utf8'));
    assert.equal(session.api, 'http://127.0.0.1:15041/api');
    assert.equal(session.database, '/university_recommandations_20261006');
    const me = await fetch(session.api + '/auth/me', { headers: { Authorization: `Bearer ${session.token}` } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).role, 'ADMIN');
    await page.addInitScript(token => { localStorage.setItem('unipresence_token', token); localStorage.setItem('lang', 'fr-FR'); }, session.token);
  } else {
    await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill('admin@unipresence.gn');
    await page.locator('input[type=password]').fill('Passer@2026');
    const loginResponse = page.waitForResponse(response => response.url().includes('/api/auth/login'));
    await page.locator('button[type=submit]').click();
    const login = await loginResponse;
    assert.ok(login.status() >= 200 && login.status() < 300, `Connexion QA refusée (${login.status()})`);
    await page.waitForFunction(() => !location.hash.startsWith('#/connexion'), null, { timeout: 15000 });
  }
  await page.goto(base + '/#/attestations', { waitUntil: 'networkidle' });

  const ouvrir = page.getByRole('button', { name: 'Émettre une attestation', exact: true });
  await ouvrir.first().click();
  const dialog = page.locator('.q-dialog');
  const frText = await dialog.innerText();
  for (const text of ['Étudiant *', "Type d'attestation *", 'Motif (bourse, banque, passeport…)', 'Rattachement', 'Émettre']) {
    assert.ok(frText.includes(text), `Libellé français absent : ${text}`);
  }
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('button', { name: 'Issue an attestation', exact: true }).first().click();
  const enText = await dialog.innerText();
  for (const text of ['Student *', 'Attestation type *', 'Reason (scholarship, bank, passport…)', 'Academic track', 'Issue']) {
    assert.ok(enText.includes(text), `English label missing: ${text}`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const evidence = {
    date: new Date().toISOString(),
    environnement: 'QA locale isolée',
    dialogue: 'Émission d’attestation FR/EN',
    erreursJavaScript: errors,
    erreursApi: apiFailures,
    aucuneEcriture: true,
    sessionQaReutilisee: Boolean(process.env.QA_SESSION_FILE),
    sourceSession: process.env.QA_SESSION_FILE ? JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE, 'utf8')).fixtureSource : 'POST /auth/login',
  };
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
