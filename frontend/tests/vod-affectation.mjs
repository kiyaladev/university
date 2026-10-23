/** Affectation privée depuis le formulaire ; bénéficiaire et tiers sur API QA réelle. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
assert.ok(process.env.QA_ENV_FILE && process.env.QA_SESSION_FILE);
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(env.PORT, '15041');
assert.equal(session.api, 'http://127.0.0.1:15041/api');
assert.equal(session.database, database.pathname);
const base = process.argv[2] || 'http://127.0.0.1:15042';
assert.equal(base, 'http://127.0.0.1:15042');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const tag = 'QA-UI-VOD-AFFECTATION-' + randomUUID();
const browser = await chromium.launch();
const errors = [], apiFailures = [], observations = {};
async function request(token, method, route, body, status = 200) {
  const r = await fetch(session.api + route, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  assert.equal(r.status, status, route + ': ' + text.slice(0, 300));
  return JSON.parse(text);
}
async function pageFor(token) {
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript(token => { localStorage.setItem('unipresence_token', token); localStorage.setItem('lang', 'fr-FR'); }, token);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  await page.goto(base + '/#/vod', { waitUntil: 'networkidle' });
  return page;
}
try {
  const { ADMIN: admin, ETUDIANT: owner, ETUDIANT_AUTRE: other, ENSEIGNANT: teacher } = session.sessions;
  assert.ok(admin && owner && other && teacher);
  const me = await request(owner, 'GET', '/auth/me');
  const student = await prisma.etudiant.findUniqueOrThrow({ where: { userId: me.id } });
  const inscription = await prisma.inscription.findFirstOrThrow({ where: { etudiantId: student.id, statut: 'VALIDE' } });
  const page = await pageFor(admin);
  await page.getByRole('button', { name: 'Nouvelle ressource', exact: true }).click();
  const dialog = () => page.locator('.q-dialog').last();
  const beneficiary = label => dialog().locator('.q-select').filter({ has: page.locator('.q-field__label').filter({ hasText: label }) });
  const label = 'Inscription bénéficiaire (facultatif)';
  await dialog().getByLabel('Titre', { exact: true }).fill(tag);
  await dialog().getByLabel('URL du média (Mux / S3 / CDN / chemin local)', { exact: true }).fill('https://example.invalid/recette-vod.mp4');
  await dialog().locator('.q-toggle').filter({ hasText: 'Ressource publique' }).click();
  async function selectEnrollment() {
    const results = page.waitForResponse(r => { const u = new URL(r.url()); return u.pathname.endsWith('/inscriptions') && u.searchParams.get('search') === inscription.numero; });
    await beneficiary(label).locator('input').fill(inscription.numero);
    await results;
    await page.waitForTimeout(50);
    const option = page.locator('.q-menu .q-item').filter({ hasText: inscription.numero }).first();
    await option.click();
    await page.waitForTimeout(100);
    assert.ok((await beneficiary(label).locator('input').inputValue()).includes(inscription.numero));
  }
  await selectEnrollment();
  assert.ok(await dialog().locator('.q-card').evaluate(e => e.getBoundingClientRect().width <= innerWidth));
  const creation = page.waitForResponse(r => r.url().endsWith('/api/vod') && r.request().method() === 'POST');
  await dialog().getByRole('button', { name: 'Créer', exact: true }).click();
  const created = await creation;
  assert.equal(created.status(), 201);
  assert.equal(created.request().postDataJSON().inscriptionId, inscription.id);
  assert.equal(created.request().postDataJSON().public, false);
  const vod = await created.json();
  const card = page.locator('.vod-carte').filter({ hasText: tag }).filter({ hasNotText: '-ENSEIGNANT' });
  const publication = page.waitForResponse(r => r.url().endsWith(`/vod/${vod.id}/publier`));
  await card.getByRole('button', { name: 'Mettre la ressource en ligne', exact: true }).click();
  assert.equal((await publication).status(), 201);
  assert.equal((await request(owner, 'GET', `/vod/${vod.id}`)).id, vod.id);
  await request(other, 'GET', `/vod/${vod.id}`, null, 404);
  observations.beneficiaryAccessAllowedOtherStudentRejected = true;

  async function reopen() {
    const preload = page.waitForResponse(r => r.url().endsWith('/inscriptions/' + inscription.id));
    await card.getByRole('button', { name: 'Modifier la ressource', exact: true }).click();
    assert.equal((await preload).status(), 200);
    await page.waitForFunction(numero => [...document.querySelectorAll('.q-dialog input')].some(input => input.value.includes(numero)), inscription.numero);
    assert.ok((await beneficiary(label).locator('input').inputValue()).includes(inscription.numero));
  }
  await reopen();
  const edit = page.waitForResponse(r => r.url().endsWith('/vod/' + vod.id) && r.request().method() === 'PUT');
  await dialog().getByRole('button', { name: 'Enregistrer', exact: true }).click();
  assert.equal((await edit).status(), 200);
  assert.equal((await prisma.coursVOD.findUniqueOrThrow({ where: { id: vod.id } })).inscriptionId, inscription.id);
  observations.editPreservesBeneficiaryAndPreloadsReadableLabel = true;
  await reopen();
  await beneficiary(label).locator('.q-field__focusable-action').click();
  const removal = page.waitForResponse(r => r.url().endsWith('/vod/' + vod.id) && r.request().method() === 'PUT');
  await dialog().getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const removed = await removal;
  assert.equal(removed.status(), 200);
  assert.equal(removed.request().postDataJSON().inscriptionId, null);
  assert.equal((await prisma.coursVOD.findUniqueOrThrow({ where: { id: vod.id } })).inscriptionId, null);
  await request(owner, 'GET', `/vod/${vod.id}`, null, 404);
  observations.removalRevokesStudentAccess = true;
  await card.getByRole('button', { name: 'Modifier la ressource', exact: true }).click();
  await selectEnrollment();
  const reassignment = page.waitForResponse(r => r.url().endsWith('/vod/' + vod.id) && r.request().method() === 'PUT');
  await dialog().getByRole('button', { name: 'Enregistrer', exact: true }).click();
  assert.equal((await reassignment).status(), 200);
  assert.equal((await request(owner, 'GET', `/vod/${vod.id}`)).id, vod.id);
  observations.reassignmentRestoresStudentAccess = true;
  await page.getByRole('button', { name: 'Changer de langue', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await card.getByRole('button', { name: 'Edit the resource', exact: true }).click();
  await beneficiary('Beneficiary enrollment (optional)').waitFor();
  assert.ok((await dialog().innerText()).includes('An enrollment grants access to that student only.'));
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  observations.frenchAndEnglishPrivateAffiliationLabels = true;

  await request(teacher, 'POST', '/vod', { titre: tag + '-ENSEIGNANT', type: 'VIDEO', public: false, url: 'https://example.invalid/recette-vod.mp4' }, 201);
  const teacherPage = await pageFor(teacher);
  await teacherPage.locator('.vod-carte').filter({ hasText: tag + '-ENSEIGNANT' }).getByRole('button', { name: 'Modifier la ressource', exact: true }).click();
  const teacherDialog = teacherPage.locator('.q-dialog').last();
  assert.equal(await teacherDialog.getByText(label, { exact: true }).count(), 0);
  assert.ok((await teacherDialog.innerText()).includes('L’administration peut affecter'));
  observations.teacherDoesNotQueryRestrictedEnrollmentRegistry = true;
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const report = { date: new Date().toISOString(), passed: true, viewport: 375, observations, errors, apiFailures, sessionSource: session.fixtureSource, affiliationScope: 'une inscription bénéficiaire, pas une promotion entière', mediaPlaybackAndPedagogicalValidationPending: true, productionUntouched: true };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  if (errors.length || apiFailures.length) console.log(JSON.stringify({ errors, apiFailures }));
  await browser.close();
  await prisma.coursVOD.deleteMany({ where: { titre: { startsWith: tag } } });
  await prisma.$disconnect();
}
