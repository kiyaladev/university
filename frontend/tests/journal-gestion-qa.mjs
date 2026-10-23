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


const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE)); assert.equal(session.api, api); assert.equal(session.database, database.pathname);
const report = { date: new Date().toISOString(), statut: 'en_cours', checks: [] }; const dependencies = []; const fixtures = [];
const browser = await chromium.launch();
async function request(token, method, path, body, expected = 200) {
 const r = await fetch(api + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const data = await r.json(); assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(data)}`); return data;
}
try {
 const admin = session.sessions.ADMIN;
 const secret = 'Contenu confidentiel QA ' + randomUUID();
 const room = await request(admin, 'POST', '/salles', { code: 'QA-' + randomUUID(), nom: 'QA Journal ' + randomUUID(), capacite: 20 }, 201);
 dependencies.push({ id: room.id, model: 'salle' });
 const reservation = await request(admin, 'POST', '/reservations', { salleId: room.id, motif: secret, organisme: secret, responsable: secret, dateJour: '2026-10-26', heureDebut: '18:00', heureFin: '19:00' }, 201);
 fixtures.push({ id: reservation.id, model: 'reservationSalle', action: 'RESERVATION_CREEE', secret });
 const category = await request(admin, 'POST', '/patrimoine/categories', { code: 'QA-' + randomUUID(), libelle: 'Matériel QA', dureeAmortissement: 5 }, 201);
 dependencies.push({ id: category.id, model: 'categoriePatrimoine' });
 const asset = await request(admin, 'POST', '/patrimoine/equipements', { numeroSerie: 'QA-' + randomUUID(), numeroInventaire: 'QA-' + randomUUID(), libelle: 'Projecteur QA', categorieId: category.id, valeurAcquisition: 100000 }, 201);
 dependencies.push({ id: asset.id, model: 'equipementPatrimoine' });
 const repair = await request(admin, 'POST', `/patrimoine/equipements/${asset.id}/reparation`, { description: secret, prestataire: secret }, 201);
 fixtures.push({ id: repair.id, model: 'reparationMateriel', action: 'PATRIMOINE_REPARATION_DECLAREE', secret });
 const formation = await request(admin, 'POST', '/formations', { titre: secret, description: secret, prix: 5000, capacite: 1, dureeHeures: 8 }, 201);
 fixtures.push({ id: formation.id, model: 'formation', action: 'FORMATION_CREE', secret });
 for (const fixture of fixtures) {
  const logs = await prisma.auditLog.findMany({ where: { entiteId: fixture.id } }); assert.equal(logs.length, 1);
  const states = JSON.parse(logs[0].details); assert.equal(states.avant, null); assert.equal(states.apres.id, fixture.id); assert.ok(!logs[0].details.includes(secret));
 }
 for (const role of ['SCOLARITE', 'ETUDIANT', 'ENSEIGNANT']) await request(session.sessions[role], 'GET', '/controles/audit', null, 403);
 for (const fixture of fixtures) for (const role of ['ADMIN', 'DIRECTION']) for (const locale of ['fr-FR', 'en-US']) for (const width of [375, 1440]) {
  const token = session.sessions[role]; assert.equal((await request(token, 'GET', '/auth/me')).role, role);
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  await context.addInitScript(({ token, locale }) => { localStorage.setItem('university_token', token); localStorage.setItem('university_lang', locale); }, { token, locale });
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
 for (const dependency of dependencies.reverse()) { await prisma.auditLog.deleteMany({ where: { entiteId: dependency.id } }); await prisma[dependency.model].delete({ where: { id: dependency.id } }); }
 report.productionUntouched = true; report.scope = 'Réservation, patrimoine et formation réels, interface avant/après ADMIN/DIRECTION FR/EN bureau/mobile';
 ecrirePreuve('journal-gestion-interface.json', report);
 await browser.close(); await prisma.$disconnect(); console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur, checks: report.checks.length }));
}
