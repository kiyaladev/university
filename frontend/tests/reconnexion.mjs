/** Recette avec écritures sur les deux séances QA fournies explicitement. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2];
const api = process.argv[3];
const fixtures = process.argv[4];
const report = process.argv[5] || '/tmp/university-reconnexion.json';
if (
  ![base, api].every((value) => value && ['localhost', '127.0.0.1'].includes(new URL(value).hostname)) ||
  !fixtures?.includes('/university_qa_')
)
  throw Error('API et PWA locales, fixtures QA obligatoires');
const ids = JSON.parse(fs.readFileSync(fixtures, 'utf8'));
assert.equal(ids.length, 2);
const browser = await chromium.launch();
const checks = [];
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
};
try {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => {
    window.__networkEvents = [];
    for (const name of ['online', 'offline'])
      window.addEventListener(name, () => window.__networkEvents.push({ name, online: navigator.onLine }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', async (response) => {
    if (response.url().endsWith('/controles/sync')) console.log('SYNC', response.status(), await response.text());
  });
  page.on('requestfailed', (request) => {
    if (request.url().endsWith('/controles/sync')) console.log('SYNC FAILED', request.failure());
  });
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('controleur1@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL((url) => !url.hash.startsWith('#/connexion'));
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Préparer hors ligne' }).click();
  await page.getByRole('status').filter({ hasText: 'Prête à' }).waitFor();
  const prepared = await page.evaluate(() => {
    const token = localStorage.getItem('university_token');
    const owner = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
    return JSON.parse(localStorage.getItem(`university_tournee_preparee_${owner}`) || 'null');
  });
  assert.equal(prepared?.date, new Date().toLocaleDateString('sv-SE'));
  checks.push('Tournée du jour et heure de préparation affichées');
  await page.goto(base + '/#/controle', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' }); // met aussi /auth/me en cache
  const token = await page.evaluate(() => localStorage.getItem('university_token'));
  const owner = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  const queueKey = `university_file_pointages_${owner}`;
  await context.setOffline(true);
  for (const time of ['22:31', '22:41']) {
    const card = page.locator('article.seance').filter({ hasText: time });
    await card.locator('button.seance__action').click();
    await page.getByRole('button', { name: 'Absent', exact: true }).click();
    await page.getByRole('button', { name: 'Valider le pointage', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  const queue = await page.evaluate(
    () => document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file,
  );
  check('Deux pointages conservés hors ligne', queue.map((row) => row.seanceId).sort(), [...ids].sort());
  check(
    'Aucun PIN conservé',
    queue.some((row) => 'codePinEnseignant' in row),
    false,
  );
  const contenuStocke = await page.evaluate((key) => localStorage.getItem(key), queueKey);
  check('File chiffrée au repos', contenuStocke.startsWith('upf1:'), true);
  check(
    'Identifiants absents du stockage chiffré',
    ids.some((id) => contenuStocke.includes(id)),
    false,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.q-page');
  check('Session et tournée disponibles après rechargement hors ligne', new URL(page.url()).hash, '#/controle');
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file.length === 2,
  );
  check(
    'File déchiffrée après rechargement',
    await page.evaluate(
      () => document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file.length,
    ),
    2,
  );
  // Un autre agent constate la deuxième séance pendant la coupure réseau.
  const authResponse = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@unipresence.gn', password: 'Passer@2026' }),
  });
  const admin = (await authResponse.json()).token;
  assert.ok(admin);
  const conflict = await fetch(api + '/controles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ seanceId: ids[1], statut: 'ABSENT' }),
  });
  check('Conflit créé par un autre agent', conflict.status, 201);
  await context.setOffline(false);
  try {
    await page.waitForFunction(
      () =>
        document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file.length ===
        1,
      null,
      { timeout: 45000 },
    );
  } catch (error) {
    console.log(await page.locator('body').innerText());
    console.log('JS ERRORS', errors);
    console.log(
      'NETWORK STATE',
      await page.evaluate(() => ({
        online: navigator.onLine,
        events: window.__networkEvents,
        state: document.querySelector('#q-app').__vue_app__?.config.globalProperties.$pinia?._s.get('pointages')
          ?.$state,
      })),
    );
    await page.screenshot({ path: report.replace(/\.json$/, '') + '-failure.png' });
    throw error;
  }
  const remaining = await page.evaluate(
    () => document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file,
  );
  check(
    'Pointage accepté retiré, conflit conservé',
    remaining.map((row) => row.seanceId),
    [ids[1]],
  );
  const first = await fetch(api + `/seances/${ids[0]}`, { headers: { Authorization: `Bearer ${admin}` } });
  const saved = await first.json();
  check('Pointage synchronisé avec le bon auteur', saved.controle.controleurId, owner);
  check('Marqueur hors ligne transmis', saved.controle.horsLigne, true);
  check('Aucune erreur JavaScript', errors, []);
  await page.screenshot({ path: report.replace(/\.json$/, '') + '.png', fullPage: true });
  // Les formats précédents pouvaient avoir laissé un code personnel dans
  // localStorage. La reprise conserve les lignes, enlève le secret et ne
  // rattache jamais la file sans propriétaire au compte connecté.
  // Cette file sans propriétaire vit sous la clé
  // « university_file_pointages_ancienne-file-sans-proprietaire ».
  await context.setOffline(true);
  await page.evaluate(
    ({ legacyKey, ownerKey }) => {
      const row = {
        seanceId: 'fixture-ancienne-file',
        statut: 'ABSENT',
        codePinEnseignant: 'PIN-TEMOIN',
        horodatage: new Date().toISOString(),
      };
      localStorage.setItem(legacyKey, JSON.stringify([row]));
      localStorage.setItem(ownerKey, JSON.stringify([row]));
    },
    { legacyKey: 'university_file_pointages_ancienne-file-sans-proprietaire', ownerKey: queueKey },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.q-page');
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').ancienneFile ===
      1,
  );
  const migration = await page.evaluate(
    ({ legacyKey, ownerKey }) => ({
      legacy: localStorage.getItem(legacyKey),
      owner: localStorage.getItem(ownerKey),
      file: document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file,
    }),
    { legacyKey: 'university_file_pointages_ancienne-file-sans-proprietaire', ownerKey: queueKey },
  );
  check(
    'PIN supprimé de la file historique rattachée',
    migration.file.some((row) => 'codePinEnseignant' in row),
    false,
  );
  check(
    'Ancienne file sans propriétaire conservée et chiffrée',
    [
      migration.legacy.startsWith('upf1:'),
      migration.owner.startsWith('upf1:'),
      await page.evaluate(
        () =>
          document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').ancienneFile,
      ),
    ],
    [true, true, 1],
  );
  await page.evaluate(
    ({ legacyKey, ownerKey }) => {
      localStorage.removeItem(legacyKey);
      localStorage.removeItem(ownerKey);
    },
    { legacyKey: 'university_file_pointages_ancienne-file-sans-proprietaire', ownerKey: queueKey },
  );
  const result = { date: new Date().toISOString(), environment: 'QA locale isolée', checks };
  fs.writeFileSync(report, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
