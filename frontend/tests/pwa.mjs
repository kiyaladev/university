/**
 * Vérifie que l'application est bien installable et qu'elle démarre sans réseau :
 * manifeste complet, icônes servies, service worker actif, coque disponible hors
 * ligne — c'est ce qui permet au contrôleur d'ouvrir sa tournée dans un amphi
 * sans couverture.
 *
 *   PWA_BUILD_DIR=/tmp/build-pwa node tests/pwa.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const dossier = path.resolve(process.env.PWA_BUILD_DIR ?? process.argv[2] ?? 'dist/pwa');
if (!fs.existsSync(path.join(dossier, 'index.html'))) {
  throw new Error(`Build PWA introuvable : ${dossier}. Compilez la PWA ou définissez PWA_BUILD_DIR.`);
}
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};
const serveur = http.createServer((req, res) => {
  const demande = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const cible = path.resolve(dossier, demande === '/' ? 'index.html' : `.${demande}`);
  if (!cible.startsWith(`${dossier}${path.sep}`) && cible !== path.join(dossier, 'index.html')) {
    res.writeHead(403).end();
    return;
  }
  const fichier =
    fs.existsSync(cible) && fs.statSync(cible).isFile()
      ? cible
      : req.headers.accept?.includes('text/html')
        ? path.join(dossier, 'index.html')
        : null;
  if (!fichier) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': types[path.extname(fichier)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(fichier).pipe(res);
});
await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve));
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const echecs = [];
const verifier = (condition, libelle, detail = '') => {
  console.log(`  ${condition ? '✔' : '✘'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!condition) echecs.push(libelle);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
// Cette recette vérifie la coque PWA ; isoler son catalogue public évite
// d'appeler une API d'exploitation depuis l'origine éphémère du serveur.
await context.route('**/api/services-actifs', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(
      ['presence', 'scolarite', 'finances', 'documentsEtudiants'].map((id) => ({
        id,
        actif: true,
        obligatoire: true,
        pilote: false,
      })),
    ),
  }),
);
const page = await context.newPage();
const erreursNavigateur = [];
page.on('pageerror', (erreur) => erreursNavigateur.push(erreur.message));
page.on('console', (message) => {
  if (message.type() === 'error') erreursNavigateur.push(message.text());
});
page.on('requestfailed', (request) => erreursNavigateur.push(`${request.url()} — ${request.failure()?.errorText}`));

try {
  // --- Manifeste
  const manifeste = await (await fetch(`${BASE}/manifest.json`)).json();
  console.log('\nManifeste');
  verifier(!!manifeste.name && !!manifeste.short_name, 'nom et nom court', manifeste.short_name);
  verifier(manifeste.display === 'standalone', 'affichage autonome', manifeste.display);
  verifier(!!manifeste.start_url, 'URL de démarrage', manifeste.start_url);
  verifier(/^#[0-9a-f]{6}$/i.test(manifeste.theme_color ?? ''), 'couleur de thème', manifeste.theme_color);
  verifier(!!manifeste.background_color, 'couleur de fond', manifeste.background_color);
  verifier(manifeste.lang === 'fr', 'langue déclarée', manifeste.lang);

  const tailles = (manifeste.icons ?? []).map((i) => i.sizes);
  verifier(tailles.includes('192x192') && tailles.includes('512x512'), 'icônes 192 et 512');
  verifier(
    (manifeste.icons ?? []).some((i) => i.purpose === 'maskable'),
    'icône « maskable » pour les lanceurs Android',
  );

  console.log('\nIcônes servies');
  for (const icone of manifeste.icons ?? []) {
    const r = await fetch(`${BASE}/${icone.src}`);
    verifier(r.ok, icone.src, `${r.status} · ${r.headers.get('content-type')}`);
  }

  // --- Service worker
  console.log('\nService worker');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const etatSw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 30000)),
    ]);
    if (!reg) return { scope: null, actif: false, etat: 'timeout' };
    return { scope: reg.scope, actif: !!reg.active, etat: reg.active?.state };
  });
  verifier(
    !!etatSw?.actif,
    'enregistré et actif',
    `${etatSw?.etat ?? 'absent'}${erreursNavigateur.length ? ` · ${erreursNavigateur.join(' | ')}` : ''}`,
  );
  verifier(!!etatSw?.scope?.endsWith('/'), 'portée à la racine', etatSw?.scope);

  const lienManifeste = await page.getAttribute('link[rel="manifest"]', 'href');
  verifier(!!lienManifeste, 'balise <link rel="manifest">', lienManifeste ?? '');
  const themeMeta = await page.getAttribute('meta[name="theme-color"]', 'content');
  verifier(themeMeta === manifeste.theme_color, 'meta theme-color cohérente', themeMeta ?? '');

  // --- Démarrage hors ligne : la preuve qui compte sur le terrain
  console.log('\nDémarrage sans réseau');
  await page.waitForTimeout(2500); // laisse le précache se terminer
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1500);
  const texte = await page.locator('body').innerText();
  verifier(texte.toLowerCase().includes('unipr'), 'la coque s’affiche hors ligne');
  await page.screenshot({ path: '/tmp/pwa-hors-ligne.png' });
  await context.setOffline(false);
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await new Promise((resolve) => serveur.close(resolve));
}
console.log(`\n${echecs.length} contrôle(s) en échec`);
echecs.forEach((e) => console.log(' •', e));
process.exit(echecs.length ? 1 : 0);
