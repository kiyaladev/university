import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const api = process.argv[3] || 'http://127.0.0.1:15031/api';
const report = process.argv[4] || '/tmp/university-changement-compte-file.json';
if (![base, api].every(value => ['localhost', '127.0.0.1'].includes(new URL(value).hostname))) throw Error('Serveur PWA et API locaux obligatoires');

const browser = await chromium.launch();
const results = [];
let libererSync;
let syncLancee;
const syncBloquee = new Promise(resolve => { libererSync = resolve; });
const syncObservee = new Promise(resolve => { syncLancee = resolve; });
try {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route('**/controles/sync', async route => {
    syncLancee();
    await syncBloquee;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ recus: 1, synchronises: 1, echecs: [] }) });
  });
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('controleur1@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => url.hash === '#/controle');
  const sessionAvant = await page.evaluate(() => localStorage.getItem('unipresence_token'));
  const ownerBefore = await page.evaluate(() => JSON.parse(atob(localStorage.getItem('unipresence_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub);
  const ownerKey = `unipresence_file_pointages_${ownerBefore}`;
  await page.evaluate(async () => {
    const maintenant = new Date().toISOString();
    const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
    const store = pinia._s.get('pointages');
    await store.chargerProprietaire();
    store.file = [{ seanceId: 'sync-in-flight', statut: 'ABSENT', horodatage: maintenant }];
    await store.persister();
    window.__syncPromise = store.synchroniser();
  });
  await Promise.race([syncObservee, new Promise((_, reject) => setTimeout(() => reject(new Error('La requête de synchronisation n’a pas démarré')), 15000))]);
  const adminKey = await page.evaluate(async () => {
    const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
    await pinia._s.get('auth').connexion('admin@unipresence.gn', 'Passer@2026');
    const sub = JSON.parse(atob(localStorage.getItem('unipresence_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
    const key = `unipresence_file_pointages_${sub}`;
    await pinia._s.get('pointages').mettreEnFile({ seanceId: 'admin-file-untouched', statut: 'ABSENT', horodatage: new Date().toISOString() });
    return key;
  });
  const ownerAfter = await page.evaluate(() => JSON.parse(atob(localStorage.getItem('unipresence_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub);
  assert.notEqual(ownerAfter, ownerBefore, 'la session a changé pendant la requête');
  libererSync();
  await page.evaluate(() => window.__syncPromise);
  const files = await page.evaluate(async ({ ownerKey, adminKey, sessionAvant }) => {
    const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
    const store = pinia._s.get('pointages');
    const admin = [...store.file];
    localStorage.setItem('unipresence_token', sessionAvant);
    await store.chargerProprietaire();
    return { owner: [...store.file], admin, ownerStock: localStorage.getItem(ownerKey), adminStock: localStorage.getItem(adminKey) };
  }, { ownerKey, adminKey, sessionAvant });
  assert.deepEqual(files.owner, [], 'le pointage accepté est retiré de la file de son auteur');
  assert.deepEqual(files.admin.map(pointage => pointage.seanceId), ['admin-file-untouched'], 'la file de la nouvelle session reste intacte');
  assert.ok(files.ownerStock.startsWith('upf1:') && files.adminStock.startsWith('upf1:'), 'les deux files restent chiffrées au repos');
  results.push('réponse en vol appliquée à la file de son propriétaire', 'aucun pointage déplacé vers le nouveau compte');
  await page.evaluate(({ ownerKey, adminKey }) => { localStorage.removeItem(ownerKey); localStorage.removeItem(adminKey); }, { ownerKey, adminKey });
  fs.writeFileSync(report, JSON.stringify({ date: new Date().toISOString(), environnement: 'QA locale isolée', controles: results }, null, 2));
  console.log(JSON.stringify(results));
  await context.close();
} finally {
  libererSync?.();
  await browser.close();
}
