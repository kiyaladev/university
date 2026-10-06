/** Écriture réelle, exclusivement sur l'installation QA fictive locale. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
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


const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE)); assert.equal(session.api, api); assert.equal(session.database, database.pathname);
const report = { date: new Date().toISOString(), statut: 'en_cours', checks: [] }; let id; const fixtures = [];
const browser = await chromium.launch();
async function request(token, method, path, body, expected = 200) {
 const r = await fetch(api + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); assert.equal(r.status, expected); return r.json();
}
try {
 const admin = session.sessions.ADMIN;
 const secret = 'Contenu confidentiel QA ' + randomUUID();
 const vod = await request(admin, 'POST', '/vod', { titre: secret, description: secret, type: 'VIDEO', url: 'https://example.invalid/recette.mp4', public: false }, 201);
 fixtures.push({ id: vod.id, model: 'coursVOD', action: 'VOD_CREE', secret });
 const letter = await request(admin, 'POST', '/courrier', { numero: 'QA-AUDIT-' + randomUUID(), type: 'ENTRANT', objet: secret, notes: secret, expediteur: secret }, 201);
 fixtures.push({ id: letter.id, model: 'courrier', action: 'COURRIER_CREE', secret });
 for (const fixture of fixtures) {
  const logs = await prisma.auditLog.findMany({ where: { entiteId: fixture.id } }); assert.equal(logs.length, 1);
  const states = JSON.parse(logs[0].details); assert.equal(states.avant, null); assert.equal(states.apres.id, fixture.id); assert.ok(!logs[0].details.includes(secret));
 }
 for (const role of ['SCOLARITE', 'ETUDIANT', 'ENSEIGNANT']) await request(session.sessions[role], 'GET', '/controles/audit', null, 403);
 for (const fixture of fixtures) for (const role of ['ADMIN', 'DIRECTION']) for (const locale of ['fr-FR', 'en-US']) for (const width of [375, 1440]) {
  const token = session.sessions[role]; assert.equal((await request(token, 'GET', '/auth/me')).role, role);
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  await context.addInitScript(({ token, locale }) => { localStorage.setItem('unipresence_token', token); localStorage.setItem('lang', locale); }, { token, locale });
  const page = await context.newPage(); page.setDefaultTimeout(60000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/#/audit', { waitUntil: 'networkidle' });
  const en = locale === 'en-US';
  await page.getByLabel(en ? 'Action' : 'Action', { exact: true }).fill(fixture.action);
  const response = page.waitForResponse(r => r.url().includes('/controles/audit') && new URL(r.url()).searchParams.get('action') === fixture.action);
  await page.getByRole('button', { name: en ? 'Search' : 'Rechercher', exact: true }).click();
  const r = await response; assert.equal(r.status(), 200); const data = await r.json(); assert.ok(data.data.some(row => row.entiteId === fixture.id));
  await page.getByRole('button', { name: en ? 'Details' : 'Détails', exact: true }).first().click();
  const dialog = page.locator('.q-dialog').last();
  await dialog.locator('dd').filter({ hasText: fixture.id }).waitFor();
  const text = await dialog.innerText(); assert.ok(text.includes(fixture.id)); assert.ok(text.includes('null')); assert.ok(!text.includes(fixture.secret));
  assert.ok(!text.includes('latitude')); assert.ok(!text.includes('qrToken')); assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  report.checks.push({ action: fixture.action, role, locale, width, actualEventAndBeforeAfter: true, privateFieldsAbsent: true });
  await context.close();
 }
 report.statut = 'valide';
} catch (e) { report.statut = 'echec'; report.erreur = e.message; process.exitCode = 1; }
finally {
 for (const fixture of fixtures) { await prisma.auditLog.deleteMany({ where: { entiteId: fixture.id } }); await prisma[fixture.model].delete({ where: { id: fixture.id } }); }
 report.productionUntouched = true; report.scope = 'VOD et courrier réels, interface avant/après ADMIN/DIRECTION FR/EN bureau/mobile';
 fs.writeFileSync('../audit/recommandations-2026-10-06/journal-campus-interface.json', JSON.stringify(report, null, 2) + '\n');
 await browser.close(); await prisma.$disconnect(); console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur, checks: report.checks.length }));
}
