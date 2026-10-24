/** Prolongation du parcours existant, API réelle et formulaire mobile sur QA uniquement. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcryptjs');
const { JwtService } = require('../../backend/node_modules/@nestjs/jwt');
assert.ok(process.env.QA_ENV_FILE && process.env.QA_SESSION_FILE);
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE));
const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE));
const url = new URL(env.DATABASE_URL);
assert.equal(url.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(env.PORT, '15041');
assert.equal(env.NODE_ENV, 'development');
assert.equal(session.api, 'http://127.0.0.1:15041/api');
assert.equal(session.database, url.pathname);
const base = process.argv[2] || 'http://127.0.0.1:15042';
assert.equal(base, 'http://127.0.0.1:15042');
Object.assign(process.env, env);
const { AuthService } = require('../../backend/dist/modules/auth/auth.service');
const { optionsJwt } = require('../../backend/dist/common/jwt-config.module');
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const auth = new AuthService(db, new JwtService(optionsJwt({ get: (k) => env[k] })));
const tag = 'QA-CARTE-PROLONGATION-' + randomUUID();
const browser = await chromium.launch();
let account, student, card;
async function call(token, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (expected !== null)
    assert.equal(r.status, expected, method + ' ' + path.split('?')[0] + ': ' + text.slice(0, 160));
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
try {
  const {
    ADMIN: admin,
    SCOLARITE: school,
    DIRECTION: direction,
    ETUDIANT_AUTRE: other,
    ENSEIGNANT: teacher,
  } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  assert.equal((await call(school, 'GET', '/auth/me')).data.role, 'SCOLARITE');
  const password = randomUUID();
  account = await db.user.create({
    data: {
      email: tag.toLowerCase() + '@example.invalid',
      password: await bcrypt.hash(password, 10),
      nom: 'Prolongation QA',
      prenom: 'Carte',
      role: 'ETUDIANT',
    },
  });
  student = await db.etudiant.create({
    data: { userId: account.id, matricule: tag, nom: 'Prolongation QA', prenom: 'Carte' },
  });
  const owner = (await auth.login({ email: account.email, password }, 'QA-FIXTURE')).token;
  assert.equal((await call(owner, 'GET', '/auth/me')).data.id, account.id);
  card = (
    await call(
      admin,
      'POST',
      '/cartes-etudiantes',
      { etudiantId: student.id, dateValidite: '2000-01-01', nip: '1234' },
      201,
    )
  ).data;
  const before = await db.carteEtudiante.findUniqueOrThrow({ where: { id: card.id } });
  const qrPath = '/cartes-etudiantes/verifier?' + new URLSearchParams({ carte: card.id, k: card.qrToken });
  assert.equal((await call(null, 'GET', qrPath)).data.valide, false);
  assert.equal(
    (await call(admin, 'POST', `/cartes-etudiantes/${card.id}/verifier-nip`, { nip: '1234' }, 201)).data.ok,
    false,
  );
  const futureDate = new Date();
  futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);
  const future = futureDate.toISOString().slice(0, 10);
  for (const token of [owner, other, teacher, direction])
    await call(token, 'PUT', '/cartes-etudiantes/' + card.id, { dateValidite: future }, 403);
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem('university_token', token);
    localStorage.setItem('university_lang', 'fr-FR');
  }, school);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [],
    apiFailures = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400)
      apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  await page.goto(base + '/#/cartes-etudiantes?etudiantId=' + student.id, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Cartes', exact: true }).click();
  const renderedCard = page.locator('.carte-carte').filter({ hasText: tag });
  await renderedCard.getByRole('button', { name: 'Modifier', exact: true }).click();
  const dialog = () => page.locator('.q-dialog').last();
  const width = await dialog()
    .locator('.q-card')
    .evaluate((e) => e.getBoundingClientRect().width);
  assert.ok(width <= 375, `Dialogue trop large : ${width}`);
  assert.equal(await dialog().getByLabel('Date de validité', { exact: true }).inputValue(), '2000-01-01');
  await dialog().getByLabel('Date de validité', { exact: true }).fill(future);
  const mutation = page.waitForResponse(
    (r) => r.url().endsWith('/cartes-etudiantes/' + card.id) && r.request().method() === 'PUT',
  );
  await dialog().getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const response = await mutation;
  assert.equal(response.status(), 200);
  const updated = await response.json();
  assert.equal(updated.id, card.id);
  assert.equal(updated.qrToken, card.qrToken);
  assert.equal(updated.dateValidite.slice(0, 10), future);
  assert.equal(updated.nip, undefined);
  const after = await db.carteEtudiante.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(after.nip, before.nip);
  assert.equal(after.dateEmission.toISOString(), before.dateEmission.toISOString());
  assert.equal((await call(null, 'GET', qrPath)).data.valide, true);
  assert.equal(
    (await call(admin, 'POST', `/cartes-etudiantes/${card.id}/verifier-nip`, { nip: '1234' }, 201)).data.ok,
    true,
  );
  assert.equal((await call(owner, 'GET', '/cartes-etudiantes/me')).data.dateValidite.slice(0, 10), future);
  assert.ok((await call(owner, 'GET', `/cartes-etudiantes/${card.id}/imprimer`)).data.includes('Prolongation QA'));
  await call(other, 'GET', `/cartes-etudiantes/${card.id}/imprimer`, null, 404);
  await renderedCard.getByRole('button', { name: 'Modifier', exact: true }).click();
  assert.equal(await dialog().getByLabel('Date de validité', { exact: true }).inputValue(), future);
  await dialog().getByRole('button', { name: 'Annuler', exact: true }).click();
  const results = await Promise.all([
    call(admin, 'POST', `/cartes-etudiantes/${card.id}/revoquer`, { motif: 'Révocation fictive de recette' }, null),
    call(school, 'PUT', '/cartes-etudiantes/' + card.id, { dateValidite: '2099-01-01' }, null),
  ]);
  assert.equal(results[0].status, 201);
  assert.ok([200, 400].includes(results[1].status));
  await call(school, 'PUT', '/cartes-etudiantes/' + card.id, { dateValidite: future }, 400);
  await call(admin, 'POST', '/cartes-etudiantes', { etudiantId: student.id }, 409);
  const final = await db.carteEtudiante.findUniqueOrThrow({ where: { id: card.id } });
  assert.equal(final.statut, 'REVOQUE');
  assert.equal(final.active, false);
  assert.equal((await call(null, 'GET', qrPath)).data.valide, false);
  assert.equal(
    (await call(admin, 'POST', `/cartes-etudiantes/${card.id}/verifier-nip`, { nip: '1234' }, 201)).data.ok,
    false,
  );
  await page.reload({ waitUntil: 'networkidle' });
  await renderedCard.waitFor();
  assert.equal(await renderedCard.getByRole('button', { name: 'Modifier', exact: true }).count(), 0);
  const audit = await db.auditLog.findMany({ where: { entite: 'CarteEtudiante', entiteId: card.id } });
  assert.equal(audit.filter((a) => a.action === 'CARTE_ETUDIANTE_REVOQUEE').length, 1);
  const details = JSON.stringify(audit.map((a) => a.details));
  assert.ok(!details.includes(card.qrToken));
  assert.ok(!details.includes(before.nip));
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const proof = {
    date: new Date().toISOString(),
    passed: true,
    viewport: 375,
    dialogWidth: width,
    expiredCardInitiallyRejected: true,
    schoolExtensionPersisted: true,
    identityQrPinAndIssueDatePreserved: true,
    sameQrAndPinUsableAfterExtension: true,
    ownerPrintAndOtherStudentRefusal: true,
    editPreloadsUpdatedValidity: true,
    unauthorizedRolesRejected: true,
    revocationAndExtensionStatuses: results.map((r) => r.status),
    revokedCardCannotBeExtendedOrReissued: true,
    revokedEditHiddenOnMobile: true,
    auditWithoutPinOrQr: true,
    errors,
    apiFailures,
    scope: 'prolongation de la carte existante, sans remplacement de QR',
    replacementAndHistoryPolicyPending: true,
    physicalPrintAndScanPending: true,
    sessionSource: session.fixtureSource,
    httpLoginRouteQualified: false,
    productionUntouched: true,
  };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally {
  await browser.close();
  if (card) await db.carteEtudiante.delete({ where: { id: card.id } });
  if (student) await db.etudiant.delete({ where: { id: student.id } });
  if (account) await db.user.delete({ where: { id: account.id } });
  await db.$disconnect();
}
