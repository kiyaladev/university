/** Recette de simplification sur une API locale et une base QA isolée. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:15044';
const api = process.env.API_URL || 'http://127.0.0.1:15043/api';
const out = process.argv[3] || '/tmp/university-simplification-qa';
assert.equal(process.env.QA_DATABASE, 'university_simplification_20261013', 'Base QA explicite requise');
for (const url of [base, api]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const module = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(root + '/src/router/routes.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('exports', 'require', compiled)(module.exports, () => ({ useAuthStore: () => ({ role: null }) }));
const routes = [];
function collect(nodes, parent = '') {
  for (const route of nodes) {
    const full = (parent + '/' + route.path).replace(/\/+/g, '/');
    if (route.children) collect(route.children, full === '/' ? '' : full);
    else if (!route.redirect && !full.includes(':') && !route.meta?.public) {
      routes.push({ path: full.replace(/\/$/, '') || '/', ...route.meta });
    }
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
const sessionFile = process.env.QA_SESSION_FILE || '/tmp/university-simplification-sessions.json';
let sessions = {};
try {
  const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  if (saved.api === api) sessions = saved.sessions;
} catch {
  /* première recette */
}
async function tokenFor(role, email) {
  if (sessions[role]) {
    const me = await fetch(api + '/auth/me', { headers: { Authorization: 'Bearer ' + sessions[role] } });
    if (me.ok && (await me.json()).role === role) return sessions[role];
  }
  const response = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: role === 'ETUDIANT' ? 'Etu#2026' : 'Passer@2026' }),
  });
  assert.ok(response.ok, role + ' connexion HTTP ' + response.status);
  sessions[role] = (await response.json()).token;
  fs.writeFileSync(sessionFile, JSON.stringify({ api, sessions }), { mode: 0o600 });
  fs.chmodSync(sessionFile, 0o600);
  return sessions[role];
}
function destination(href, role) {
  const requested = href.replace(/^#/, '');
  if (requested === '/')
    return (
      { SCOLARITE: '/scolarite', CONTROLEUR: '/controle', ENSEIGNANT: '/mes-seances', ETUDIANT: '/portail' }[role] ??
      '/'
    );
  if (requested === '/suivi-presences')
    return ['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'].includes(role)
      ? '/synthese-presences'
      : role === 'CONTROLEUR'
        ? '/statistiques'
        : '/rapports';
  if (requested === '/documents') return role === 'DIRECTION' ? '/attestations' : '/demandes-docs';
  if (requested === '/bilan') return '/rectorat';
  if (requested === '/mes-demarches') return '/demandes-docs/mes';
  return requested;
}
const responsive = new Set([
  '/etudiants',
  '/inscriptions',
  '/paiements',
  '/recettes',
  '/demandes-docs',
  '/portail',
  '/helpdesk',
  '/reservations',
  '/parametres',
  '/evaluations',
  '/notes',
  '/examens',
  '/rectorat',
  '/statistiques-mesrs',
]);
const results = [];
const interactions = [];
const browser = await chromium.launch();
try {
  for (const [role, email] of Object.entries(roles)) {
    const token = await tokenFor(role, email);
    const context = await browser.newContext({
      locale: 'fr-FR',
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 950 },
    });
    await context.addInitScript((token) => {
      localStorage.setItem('university_token', token);
      localStorage.setItem('university_lang', 'fr-FR');
      // Les anciennes préférences ne doivent plus forcer une présentation.
      localStorage.setItem('up:vue:etudiants', 'cartes');
    }, token);
    const page = await context.newPage();
    // La recette statique utilise un port local distinct de celui du serveur dev.
    await page.route('**/api/**', async (route) => {
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } catch {
        // Une navigation peut interrompre une réponse déjà prise en charge.
        try {
          await route.abort();
        } catch {
          /* requête déjà terminée */
        }
      }
    });
    let active;
    page.on('pageerror', (error) => active?.errors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('intlify') && !msg.text().includes('Not found parent scope'))
        active?.errors.push(msg.text());
    });
    page.on('response', (response) => {
      if (response.url().startsWith(api) && response.status() >= 400) {
        active?.http.push({ path: new URL(response.url()).pathname, status: response.status() });
      }
    });
    await page.goto(base + '/#/', { waitUntil: 'networkidle' });
    await page.locator('.q-page').waitFor();
    async function visit(requested, width = 1440) {
      active = { role, path: requested, width, errors: [], http: [] };
      await page.setViewportSize({ width, height: 950 });
      await page.evaluate(
        (target) => document.querySelector('#q-app').__vue_app__.config.globalProperties.$router.push(target),
        requested,
      );
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const expected = destination('#' + requested, role);
      try {
        await page.waitForURL((url) => url.hash.slice(1) === expected);
      } catch (error) {
        console.error(
          JSON.stringify({ role, requested, expected, actual: page.url(), errors: active.errors, http: active.http }),
        );
        throw error;
      }
      await page.waitForLoadState('networkidle');
      await page.locator('.q-page').waitFor();
      active.actual = new URL(page.url()).hash.slice(1);
      if (active.actual !== expected) active.errors.push('Destination attendue : ' + expected);
      assert.equal(await page.locator('.bascule-vue, .liens-croises, .kanban').count(), 0);
      active.headings = await page.locator('.q-page h1').allTextContents();
      active.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (active.overflow) active.errors.push('Débordement horizontal');
      results.push(active);
      if (active.errors.length || active.http.length) console.log(JSON.stringify(active));
    }
    for (const route of routes.filter((route) => !route.roles || route.roles.includes(role))) await visit(route.path);

    const drawer = page.locator('.q-drawer');
    assert.ok((await drawer.locator('.q-expansion-item').count()) <= 5);
    const links = new Set(
      await drawer
        .locator('[role=navigation] > a')
        .evaluateAll((items) => items.map((item) => item.getAttribute('href'))),
    );
    for (const group of await drawer.locator('.q-expansion-item').all()) {
      await group.locator('.q-expansion-item__container > .q-item').first().click();
      for (const href of await group
        .locator('a')
        .evaluateAll((items) => items.map((item) => item.getAttribute('href')))) {
        assert.ok(!links.has(href), role + ' lien dupliqué ' + href);
        links.add(href);
      }
    }
    for (const href of links) await visit(href.slice(1));
    interactions.push({ role, menuLinks: links.size, destinationsVerified: true });

    if (role === 'ADMIN') {
      await visit('/etudiants');
      assert.ok((await page.locator('.q-page .q-table').count()) > 0);
      await page.setViewportSize({ width: 375, height: 950 });
      await page.locator('.etudiants-cartes').waitFor();
      assert.equal(await page.locator('.q-page .q-table').count(), 0);
      await page.setViewportSize({ width: 1440, height: 950 });
      await page.locator('.q-page .q-table').waitFor();
      const account = page.getByRole('button', { name: 'Mon compte', exact: true });
      await account.click();
      await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
      await page.getByText('English', { exact: true }).click();
      await page.waitForFunction(() => document.documentElement.lang === 'en');
      // Fermer le menu du compte avant la capture ou la navigation suivante.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.equal(
        await page.locator('.page-entete').getByRole('button', { name: 'New student', exact: true }).count(),
        1,
      );
      await page.getByRole('button', { name: 'My account', exact: true }).click();
      await page.getByRole('button', { name: 'Change language', exact: true }).click();
      await page.getByText('Français', { exact: true }).click();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const evaluations = await (
        await fetch(api + '/evaluations?pageSize=1', { headers: { Authorization: 'Bearer ' + token } })
      ).json();
      assert.ok(evaluations.data?.[0]?.id, 'Évaluation de fixture disponible');
      await visit('/notes?evaluation=' + evaluations.data[0].id);
      await page.locator('.saisie-masse').waitFor();
      interactions.push({
        role,
        adaptiveList: true,
        accountLanguageSwitch: ['FR', 'EN', 'FR'],
        evaluationContext: true,
      });
    }
    for (const width of [375, 768]) {
      for (const route of routes.filter(
        (route) => responsive.has(route.path) && (!route.roles || route.roles.includes(role)),
      )) {
        await visit(route.path, width);
        if (['ADMIN', 'ETUDIANT'].includes(role) && ['/etudiants', '/portail', '/parametres'].includes(route.path)) {
          await page.screenshot({
            path: path.join(out, `${role}-${route.path.slice(1)}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
    console.log(`${role} : ${results.filter((r) => r.role === role).length} configurations vérifiées`);
    fs.writeFileSync(
      path.join(out, 'parcours.json'),
      JSON.stringify(
        { date: new Date().toISOString(), database: process.env.QA_DATABASE, results, interactions },
        null,
        2,
      ),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => r.errors.length || r.http.length);
console.log(
  JSON.stringify({
    configurations: results.length,
    roles: Object.keys(roles).length,
    failures: failed.length,
    report: path.join(out, 'parcours.json'),
  }),
);
assert.equal(failed.length, 0, 'Voir les échecs dans le rapport de recette');
