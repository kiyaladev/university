import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dossier = path.resolve(process.argv[2] || '/tmp/university_qa_file_crypto');
if (!fs.existsSync(path.join(dossier, 'index.html'))) throw Error(`Build PWA introuvable : ${dossier}`);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
const serveur = http.createServer((req, res) => {
  const demande = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const cible = demande === '/' ? path.join(dossier, 'index.html') : path.resolve(dossier, `.${demande}`);
  if (!cible.startsWith(dossier + path.sep) && cible !== path.join(dossier, 'index.html')) {
    res.writeHead(403).end();
    return;
  }
  const fichier = fs.existsSync(cible) && fs.statSync(cible).isFile() ? cible : path.join(dossier, 'index.html');
  res.writeHead(200, {
    'content-type': types[path.extname(fichier)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(fichier).pipe(res);
});
await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${serveur.address().port}`;
const browser = await chromium.launch();
let bloquerSync = false;
let libererSync;
const attenteSync = new Promise((resolve) => {
  libererSync = resolve;
});

try {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  const charge = Buffer.from(JSON.stringify({ sub: 'agent-test', role: 'ADMIN' })).toString('base64url');
  await context.addInitScript(
    (token) => localStorage.setItem('university_token', token),
    `e30.${charge}.signature-de-recette`,
  );
  const erreurs = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => erreurs.push(`requête: ${request.url()} — ${request.failure()?.errorText}`));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'agent-test', role: 'ADMIN', nom: 'Test', prenom: 'Agent', actif: true }),
      });
    } else if (url.pathname.endsWith('/controles/sync')) {
      if (bloquerSync) await attenteSync;
      const corps = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ recus: corps.pointages.length, synchronises: corps.pointages.length, echecs: [] }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 50 }),
      });
    }
  });
  await page.goto(`${base}/#/controle`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  try {
    await page.waitForFunction(
      () => document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('pointages'),
      null,
      { timeout: 8000 },
    );
  } catch (error) {
    console.error(
      'PWA integration diagnostics',
      JSON.stringify({
        url: page.url(),
        body: await page.locator('body').innerText(),
        html: (await page.content()).slice(0, 1200),
        erreurs,
      }),
    );
    throw error;
  }

  const cle = 'university_file_pointages_agent-test';
  const stocke = await page.evaluate(async (cle) => {
    const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
    const store = pinia._s.get('pointages');
    await store.chargerProprietaire();
    await store.mettreEnFile({
      seanceId: 'fixture-chiffrement',
      statut: 'PRESENT',
      signatureBase64: 'SIGNATURE_DE_RECETTE_CONFIDENTIELLE',
      codePinEnseignant: 'PIN_NE_DOIT_PAS_ETRE_MIS_EN_FILE',
      horodatage: new Date().toISOString(),
    });
    const brut = localStorage.getItem(cle);
    return {
      brut,
      file: store.file,
      owner: store.proprietaire,
      fileChargee: store.fileChargee,
      token: localStorage.getItem('university_token'),
      profil: pinia._s.get('auth').utilisateur,
    };
  }, cle);
  assert.ok(
    stocke.brut?.startsWith('upf1:'),
    `la file doit être chiffrée avant son écriture: ${JSON.stringify(stocke)}`,
  );
  assert.equal(stocke.brut.includes('SIGNATURE_DE_RECETTE_CONFIDENTIELLE'), false);
  assert.equal(stocke.brut.includes('PIN_NE_DOIT_PAS_ETRE_MIS_EN_FILE'), false);
  assert.equal(stocke.file[0].signatureBase64, 'SIGNATURE_DE_RECETTE_CONFIDENTIELLE');
  assert.equal('codePinEnseignant' in stocke.file[0], false, 'le PIN doit être retiré avant la mise en file');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('pointages')?.file
        ?.length === 1,
    null,
    { timeout: 15000 },
  );
  await page.evaluate(async () => {
    const store = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages');
    await store.synchroniser();
  });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('pointages')?.file
        ?.length === 0,
    null,
    { timeout: 10000 },
  );
  const relu = await page.evaluate(() => {
    const store = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages');
    return { file: store.file, chargee: store.fileChargee };
  });
  assert.equal(relu.chargee, true);
  assert.deepEqual(relu.file, [], 'la file est retirée après acceptation serveur');
  assert.deepEqual(erreurs, [], 'aucune erreur JavaScript');

  bloquerSync = true;
  await page.evaluate(
    (cle) =>
      localStorage.setItem(
        cle,
        JSON.stringify([
          {
            seanceId: 'fixture-ancienne-file',
            statut: 'PRESENT',
            signatureBase64: 'SIGNATURE_ANTERIEURE',
            codePinEnseignant: 'PIN_HISTORIQUE',
            horodatage: new Date().toISOString(),
          },
        ]),
      ),
    cle,
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('pointages')?.file
        ?.length === 1,
    null,
    { timeout: 15000 },
  );
  const migration = await page.evaluate(
    (cle) => ({
      file: document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file,
      brut: localStorage.getItem(cle),
    }),
    cle,
  );
  assert.equal(migration.file[0].codePinEnseignant, undefined, 'le PIN des anciennes files est supprimé');
  assert.ok(
    migration.brut.startsWith('upf1:') && !migration.brut.includes('PIN_HISTORIQUE'),
    'les anciennes preuves passent au chiffrement',
  );
  console.log(
    JSON.stringify({
      date: new Date().toISOString(),
      checks: [
        'chiffrement avant persistance',
        'PIN absent',
        'décryptage après rechargement',
        'retrait après synchronisation',
        'migration des anciennes files avec suppression du PIN',
      ],
    }),
  );
  await context.close();
} finally {
  libererSync?.();
  await browser.close();
  await new Promise((resolve) => serveur.close(resolve));
}
