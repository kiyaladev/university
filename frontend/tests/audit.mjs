/** Read-only screen audit against an isolated local API with seeded demo users. */
import { chromium } from 'playwright';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ?? 'http://127.0.0.1:15029';
const out = process.argv[3] ?? '/tmp/university-screen-audit';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('This audit uses demo accounts and requires an isolated localhost environment.');
}
fs.mkdirSync(out, { recursive: true });
const module = { exports: {} };
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync(root + '/src/router/routes.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(module.exports);
const routes = [];
function collect(nodes, parent = '') {
  for (const route of nodes) {
    const full = (parent + '/' + route.path).replace(/\/+/g, '/');
    if (route.children) collect(route.children, full === '/' ? '' : full);
    else if (!full.includes(':')) routes.push({ path: full.replace(/\/$/, '') || '/', ...route.meta });
  }
}
collect(module.exports.default);
const roles = {
  ADMIN: 'admin@unipresence.gn',
  DIRECTION: 'direction@unipresence.gn',
  SCOLARITE: 'scolarite@unipresence.gn',
  CHEF_DEPARTEMENT: 'chef.info@unipresence.gn',
  CONTROLEUR: 'controleur1@unipresence.gn',
  ENSEIGNANT: 'enseignant@unipresence.gn',
  ETUDIANT: 'etudiant1@university.gn',
};
const screenshots = new Set([
  '/scolarite',
  '/',
  '/controle',
  '/emploi-du-temps',
  '/seances',
  '/etudiants',
  '/paiements',
  '/portail',
  '/mes-seances',
  '/helpdesk',
]);
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const [role, email] of Object.entries(roles)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await context.newPage();
    let active = null;
    page.on('pageerror', (e) => active?.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) active?.errors.push(m.text());
      if (m.type() === 'warning' && m.text().includes('intlify')) active?.warnings.push(m.text());
    });
    page.on('requestfailed', (request) => {
      const failure = { url: request.url(), error: request.failure()?.errorText };
      if (request.url().includes('/api/')) active?.errors.push(JSON.stringify(failure));
      else if (active) (active.resources ??= []).push(failure);
    });
    page.on('response', async (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        const record = active;
        let body = '';
        try {
          body = await response.text();
        } catch {}
        record?.http.push({ status: response.status(), url: response.url(), body: body.slice(0, 500) });
      }
    });
    await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(role === 'ETUDIANT' ? 'Etu#2026' : 'Passer@2026');
    await page.locator('button[type=submit]').click();
    await page.waitForURL((url) => !url.hash.startsWith('#/connexion'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    for (const route of routes.filter((r) => !r.public && (!r.roles || r.roles.includes(role)))) {
      active = { role, path: route.path, viewport: 1440, errors: [], warnings: [], http: [] };
      try {
        await page.goto(base + '/#' + route.path, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForSelector('.q-page');
        await page.waitForTimeout(500);
        await page.waitForSelector('.q-page');
        active.actual = decodeURIComponent(new URL(page.url()).hash.slice(1));
        active.pageCount = await page.locator('.q-page').count();
        active.headings = await page.locator('h1,h2,.page-titre').allTextContents();
        active.layout = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        if (active.actual !== route.path) active.errors.push('Unexpected redirect: ' + active.actual);
        if (!active.pageCount) active.errors.push('Missing page container');
        if (screenshots.has(route.path))
          await page.screenshot({
            path: out + '/' + role + '-' + (route.path.replace(/\W/g, '-') || 'home') + '-1440.png',
            fullPage: true,
          });
      } catch (e) {
        active.errors.push(e.message);
      }
      results.push(active);
      if (active.errors.length || active.http.length)
        console.log('ISSUE', role, route.path, JSON.stringify({ errors: active.errors, http: active.http }));
    }
    console.log(role + ': ' + results.filter((r) => r.role === role).length + ' desktop screens checked');
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(500);
      for (const route of routes.filter(
        (r) => !r.public && screenshots.has(r.path) && (!r.roles || r.roles.includes(role)),
      )) {
        active = { role, path: route.path, viewport: width, errors: [], warnings: [], http: [] };
        try {
          await page.goto(base + '/#' + route.path, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForSelector('.q-page');
          await page.waitForTimeout(500);
          active.layout = await page.evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          await page.screenshot({
            path: out + '/' + role + '-' + (route.path.replace(/\W/g, '-') || 'home') + '-' + width + '.png',
            fullPage: true,
          });
        } catch (e) {
          active.errors.push(e.message);
        }
        results.push(active);
      }
    }
    await context.close();
    fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 2));
  }
} finally {
  await browser.close();
}
console.log(
  JSON.stringify({
    checks: results.length,
    failed: results.filter((r) => r.errors.length || r.http.length).length,
    overflow: results
      .filter((r) => r.layout?.scrollWidth > r.layout?.width + 1)
      .map((r) => ({ role: r.role, path: r.path, ...r.layout })),
  }),
);
process.exitCode = results.some((r) => r.errors.length || r.http.length) ? 1 : 0;
