/** Écriture réelle, exclusivement sur l'installation QA fictive locale. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { ecrirePreuve } from './preuves.mjs';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcryptjs');
if (!process.env.QA_ENV_FILE) throw Error('QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const base = process.argv[2] || 'http://127.0.0.1:15042';
assert.equal(base, 'http://127.0.0.1:15042');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE));
assert.equal(session.api, api);
assert.equal(session.database, database.pathname);
const report = { date: new Date().toISOString(), statut: 'en_cours', checks: [] };
let id;
const browser = await chromium.launch();
async function request(token, method, path, body, expected = 200) {
  const r = await fetch(api + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(r.status, expected);
  return r.json();
}
try {
  const admin = session.sessions.ADMIN;
  id = randomUUID();
  const actor = await request(admin, 'GET', '/auth/me');
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'VOTE_DEPOSE',
      entite: 'QA-VOTE-' + id,
      entiteId: id,
      details: JSON.stringify({ scrutinId: 'choix-prive-QA-' + id, candidatId: randomUUID() }),
    },
  });
  for (const role of ['ADMIN', 'DIRECTION']) {
    const filtered = await request(session.sessions[role], 'GET', '/controles/audit?action=VOTE_DEPOSE');
    assert.equal(filtered.total, 0);
    assert.deepEqual(filtered.data, []);
    const byEntity = await request(
      session.sessions[role],
      'GET',
      '/controles/audit?entite=' + encodeURIComponent('QA-VOTE-' + id),
    );
    assert.equal(byEntity.total, 0);
    assert.deepEqual(byEntity.data, []);
  }
  for (const role of ['SCOLARITE', 'ETUDIANT', 'ENSEIGNANT'])
    await request(session.sessions[role], 'GET', '/controles/audit', null, 403);
  for (const role of ['ADMIN', 'DIRECTION'])
    for (const locale of ['fr-FR', 'en-US'])
      for (const width of [375, 1440]) {
        const token = session.sessions[role];
        assert.equal((await request(token, 'GET', '/auth/me')).role, role);
        const context = await browser.newContext({ viewport: { width, height: 950 } });
        await context.addInitScript(
          ({ token, locale }) => {
            localStorage.setItem('university_token', token);
            localStorage.setItem('university_lang', locale);
          },
          { token, locale },
        );
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(base + '/#/audit', { waitUntil: 'networkidle' });
        const en = locale === 'en-US';
        await page.getByLabel(en ? 'Action' : 'Action', { exact: true }).fill('VOTE_DEPOSE');
        const response = page.waitForResponse(
          (r) => r.url().includes('/controles/audit') && new URL(r.url()).searchParams.get('action') === 'VOTE_DEPOSE',
        );
        await page.getByRole('button', { name: en ? 'Search' : 'Rechercher', exact: true }).click();
        const r = await response;
        assert.equal(r.status(), 200);
        const data = await r.json();
        assert.equal(data.total, 0);
        assert.deepEqual(data.data, []);
        assert.equal(await page.getByRole('button', { name: en ? 'Details' : 'Détails', exact: true }).count(), 0);
        assert.ok(!(await page.locator('body').innerText()).includes('choix-prive-QA-'));
        assert.deepEqual(errors, []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        report.checks.push({ role, locale, width, legacyVoteHidden: true, filteredCountZero: true });
        await context.close();
      }
  report.statut = 'valide';
} catch (e) {
  report.statut = 'echec';
  report.erreur = e.message;
  process.exitCode = 1;
} finally {
  if (id) {
    await prisma.auditLog.deleteMany({ where: { entiteId: id } });
  }
  report.productionUntouched = true;
  report.scope =
    'Trace historique VOTE_DEPOSE synthétique QA masquée par API et interface ADMIN/DIRECTION FR/EN bureau/mobile';
  ecrirePreuve('journal-votes-historiques-interface.json', report);
  await browser.close();
  await prisma.$disconnect();
  console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur, checks: report.checks.length }));
}
