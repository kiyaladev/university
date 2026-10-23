import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dossier = path.resolve(process.argv[2] || process.env.PWA_BUILD_DIR || 'dist/pwa');
if (!fs.existsSync(path.join(dossier, 'index.html'))) throw Error(`Build PWA introuvable : ${dossier}`);
const portApi = Number(process.env.TEST_API_PORT ?? 15032);
const urlApiAttendue = `http://127.0.0.1:${portApi}/api`;
const assets = path.join(dossier, 'assets');
const bundleLocal =
  fs.existsSync(assets) &&
  fs
    .readdirSync(assets)
    .some(
      (fichier) =>
        fichier.endsWith('.js') && fs.readFileSync(path.join(assets, fichier), 'utf8').includes(urlApiAttendue),
    );
if (!bundleLocal) throw Error(`Build refusé : recompilation requise avec API_URL=${urlApiAttendue}`);
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
const appelsSync = [];
const apiServeur = http.createServer((req, res) => {
  const origin = req.headers.origin ?? '*';
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Authorization, Content-Type');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('vary', 'Origin');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET' && req.url?.startsWith('/api/auth/me')) {
    return res.end(JSON.stringify({ id: 'agent-test', role: 'CONTROLEUR', nom: 'Test', prenom: 'Agent', actif: true }));
  }
  if (req.method === 'POST' && req.url === '/api/seances/sync') {
    let corps = '';
    req.setEncoding('utf8');
    req.on('data', (fragment) => {
      corps += fragment;
    });
    req.on('end', () => {
      const donnees = JSON.parse(corps);
      appelsSync.push(donnees);
      res.writeHead(201).end(
        JSON.stringify({
          resultats: donnees.seances.map((seance, index) => ({
            idClient: seance.idClient,
            id: `seance-serveur-${index + 1}`,
            ok: index === 0,
            ...(index === 0 ? {} : { erreur: 'Référence de recette refusée' }),
          })),
        }),
      );
    });
    return;
  }
  return res.end(JSON.stringify({ data: [], total: 0, page: 1, pageSize: 50 }));
});
await new Promise((resolve, reject) => {
  apiServeur.once('error', reject);
  apiServeur.listen(portApi, '127.0.0.1', resolve);
});
const browser = await chromium.launch();

try {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  const charge = Buffer.from(
    JSON.stringify({ sub: 'agent-test', role: 'CONTROLEUR', exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  await context.addInitScript(
    (token) => localStorage.setItem('university_token', token),
    `e30.${charge}.signature-de-recette`,
  );
  const erreurs = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await page.goto(`${base}/#/controle`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne'),
    null,
    { timeout: 10000 },
  );
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 10000 });
  await page.waitForFunction(
    () => document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne'),
    null,
    { timeout: 10000 },
  );
  await context.setOffline(true);

  const affectation = { id: 'affectation-1', anneeId: 'annee-1', matiereId: 'matiere-1' };
  const salle = { id: 'salle-1', code: 'A101', nom: 'Salle A101' };
  const queued = await page.evaluate(
    async ({ affectation, salle }) => {
      const store = document
        .querySelector('#q-app')
        .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
      store.enregistrerAffectations([affectation]);
      store.enregistrerSalles([salle]);
      const result = await store.creer(
        {
          affectationId: affectation.id,
          date: '2026-10-03T00:00:00.000Z',
          heureDebut: '18:00',
          heureFin: '19:00',
          type: 'CM',
          salleId: salle.id,
          thematique: 'Séance de recette',
        },
        affectation,
        salle,
      );
      return {
        result,
        file: store.file,
        affectations: store.affectationsCache,
        salles: store.sallesCache,
        visible: store.pourDate('2026-10-03'),
        storage: localStorage.getItem('university_file_seances_agent-test'),
      };
    },
    { affectation, salle },
  );
  assert.equal(queued.result.enFile, true, 'la séance doit être mise en file hors ligne');
  assert.match(queued.result.id, /^[0-9a-f-]{36}$/i, 'la file reçoit un UUID client stable');
  assert.equal(queued.file.length, 1);
  assert.equal(queued.affectations.length, 1);
  assert.equal(queued.salles.length, 1);
  assert.equal(queued.visible[0].id, queued.result.id, 'la tournée affiche la séance locale par sa clé cliente');
  assert.equal(JSON.parse(queued.storage)[0].idClient, queued.result.id);
  assert.equal(appelsSync.length, 0, 'aucune demande de synchronisation ne part pendant la coupure réseau');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne')?.file
        ?.length === 1,
    null,
    { timeout: 10000 },
  );
  const restored = await page.evaluate(() => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    return {
      id: store.file[0].idClient,
      affectations: store.affectationsCache.length,
      salles: store.sallesCache.length,
    };
  });
  assert.deepEqual(
    restored,
    { id: queued.result.id, affectations: 1, salles: 1 },
    'séance, affectations et salles persistent après rechargement hors ligne',
  );

  await context.setOffline(false);
  await page.evaluate(async () => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    await store.synchroniser();
  });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne')?.file
        ?.length === 0,
    null,
    { timeout: 10000 },
  );
  assert.equal(appelsSync.length, 1, 'une seule synchronisation est envoyée');
  const envoyee = appelsSync[0].seances[0];
  assert.equal(envoyee.idClient, queued.result.id);
  assert.equal(envoyee.affectation, undefined, 'les relations locales ne sont pas envoyées au serveur');
  assert.equal(envoyee.salle, undefined);
  assert.equal(envoyee.enfileeLe, undefined);

  await page.evaluate(async () => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    await store.synchroniser();
  });
  assert.equal(appelsSync.length, 1, 'un nouvel appel ne rejoue pas une file déjà acceptée');
  assert.deepEqual(erreurs, [], 'aucune erreur JavaScript pendant le parcours');
  console.log(
    JSON.stringify({
      date: new Date().toISOString(),
      checks: [
        'création UUID hors ligne',
        'affectations et salles mises en cache',
        'persistance après rechargement',
        'synchronisation unique au retour réseau',
        'relations locales exclues de la charge utile',
      ],
    }),
  );
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => serveur.close(resolve));
  await new Promise((resolve) => apiServeur.close(resolve));
}
