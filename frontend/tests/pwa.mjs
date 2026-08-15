/**
 * Vérifie que l'application est bien installable et qu'elle démarre sans réseau :
 * manifeste complet, icônes servies, service worker actif, coque disponible hors
 * ligne — c'est ce qui permet au contrôleur d'ouvrir sa tournée dans un amphi
 * sans couverture.
 *
 *   node tests/pwa.mjs [url]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://presence.naimba.com';
const echecs = [];
const verifier = (condition, libelle, detail = '') => {
  console.log(`  ${condition ? '✔' : '✘'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!condition) echecs.push(libelle);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

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
await page.goto(BASE, { waitUntil: 'networkidle' });
const etatSw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return { scope: reg.scope, actif: !!reg.active, etat: reg.active?.state };
});
verifier(!!etatSw?.actif, 'enregistré et actif', etatSw?.etat);
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

await browser.close();
console.log(`\n${echecs.length} contrôle(s) en échec`);
echecs.forEach((e) => console.log(' •', e));
process.exit(echecs.length ? 1 : 0);
