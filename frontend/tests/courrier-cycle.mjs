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
const tag = 'QA-UI-' + randomUUID();
const browser = await chromium.launch();
let page;
let department;
let head;
try {
  let token;
  if (process.env.QA_SESSION_FILE) {
    const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE, 'utf8'));
    assert.equal(session.api, api);
    assert.equal(session.database, database.pathname);
    token = session.token;
  } else {
    const login = await fetch(api + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@unipresence.gn', password: 'Passer@2026' }),
    });
    assert.equal(login.status, 201);
    token = (await login.json()).token;
  }
  department = await prisma.departement.create({ data: { code: tag, nom: 'Département fictif de recette' } });
  const me = await (await fetch(api + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(me.id, (await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } })).id);
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem('university_token', token);
    localStorage.setItem('university_lang', 'fr-FR');
  }, token);
  page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  const apiFailures = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400)
      apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  await page.goto(base + '/#/courrier', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Enregistrer un courrier', exact: true }).first().click();
  let dialog = page.locator('.q-dialog').last();
  await dialog.getByLabel('Numéro (COUR-AAAA-XXXXX)', { exact: true }).fill(tag);
  await dialog.getByLabel('Objet', { exact: true }).fill('Courrier fictif de recette');
  const select = dialog
    .locator('.q-select')
    .filter({ has: page.locator('.q-field__label').filter({ hasText: 'Département destinataire (facultatif)' }) });
  await select.locator('input').fill(tag);
  await page.locator('.q-menu .q-item').filter({ hasText: tag }).click();
  assert.ok((await select.locator('input').inputValue()).includes(tag));
  const creation = page.waitForResponse((r) => r.url().endsWith('/courrier') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const response = await creation;
  assert.equal(response.status(), 201);
  const body = response.request().postDataJSON();
  assert.equal(body.dateReception, undefined);
  assert.equal(body.dateEnvoi, undefined);
  assert.equal(body.departementId, department.id);
  const listing = await (
    await fetch(api + '/courrier?type=ENTRANT&pageSize=20', { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  assert.ok(
    listing.data.some((row) => row.numero === tag),
    'Courrier créé absent de la liste API',
  );
  await page.getByText(tag, { exact: true }).click();
  dialog = page.locator('.q-dialog').last();
  await dialog.getByRole('button', { name: 'Parapher', exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Parapher', exact: true }).count(), 1);
  await dialog.getByRole('button', { name: 'Parapher', exact: true }).click();
  const stamp = page.locator('.q-dialog').last();
  await stamp.getByText('Parapher l’étape 1', { exact: true }).waitFor();
  assert.ok(await stamp.locator('.q-card').evaluate((e) => e.getBoundingClientRect().width <= innerWidth));
  const signature = page.waitForResponse((r) => r.url().includes('/parapher/') && r.request().method() === 'POST');
  await stamp.getByRole('button', { name: 'Valider', exact: true }).click();
  assert.equal((await signature).status(), 201);
  await page.waitForTimeout(700);
  const row = await prisma.courrier.findUniqueOrThrow({
    where: { numero: tag },
    include: { circuits: { orderBy: { ordre: 'asc' } } },
  });
  assert.equal(row.circuits[0].statut, 'TRAITE');
  assert.equal(row.circuits[1].statut, 'EN_CIRCUIT');
  assert.equal(row.statut, 'EN_CIRCUIT');
  assert.equal(row.departementId, department.id);
  const password = randomUUID();
  head = await prisma.user.create({
    data: {
      email: tag.toLowerCase() + '@example.invalid',
      password: await bcrypt.hash(password, 10),
      nom: 'Chef fictif',
      prenom: 'QA',
      role: 'CHEF_DEPARTEMENT',
      departementId: department.id,
    },
  });
  const headLogin = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: head.email, password }),
  });
  assert.equal(headLogin.status, 201);
  const headToken = (await headLogin.json()).token;
  const headContext = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await headContext.addInitScript((token) => {
    localStorage.setItem('university_token', token);
    localStorage.setItem('university_lang', 'fr-FR');
  }, headToken);
  const headPage = await headContext.newPage();
  headPage.setDefaultTimeout(60000);
  let departmentRegistryRequests = 0;
  headPage.on('request', (r) => {
    if (new URL(r.url()).pathname.includes('/api/departements')) departmentRegistryRequests++;
  });
  headPage.on('pageerror', (e) => errors.push(e.message));
  headPage.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400)
      apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  await headPage.goto(base + '/#/courrier', { waitUntil: 'networkidle' });
  await headPage.getByRole('button', { name: 'Enregistrer un courrier', exact: true }).first().click();
  const headDialog = headPage.locator('.q-dialog').last();
  assert.equal(await headDialog.getByText('Département destinataire (facultatif)', { exact: true }).count(), 0);
  await headDialog.getByText('Ce courrier est adressé à votre département.', { exact: true }).waitFor();
  await headDialog.getByLabel('Numéro (COUR-AAAA-XXXXX)', { exact: true }).fill(tag + '-CHEF');
  await headDialog.getByLabel('Objet', { exact: true }).fill('Courrier fictif du chef');
  const headCreation = headPage.waitForResponse(
    (r) => r.url().endsWith('/courrier') && r.request().method() === 'POST',
  );
  await headDialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const headResponse = await headCreation;
  assert.equal(headResponse.status(), 201);
  assert.equal(headResponse.request().postDataJSON().departementId, undefined);
  assert.equal((await headResponse.json()).departementId, department.id);
  assert.equal(departmentRegistryRequests, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const report = {
    date: new Date().toISOString(),
    viewport: 375,
    departmentSelectionPersisted: true,
    headOwnDepartmentDerivedWithoutRegistryRequest: true,
    sessionQaReused: Boolean(process.env.QA_SESSION_FILE),
    headFixtureLoginHTTPStatus: 201,
    adminHttpLoginRouteQualified: !process.env.QA_SESSION_FILE,
    checks: [
      'enregistrement depuis le dialogue sans date facultative',
      'département choisi au clic et persisté',
      'une seule étape proposée au paraphe',
      'dialogue de paraphe contenu à 375 px',
      'paraphe persisté, étapes suivantes en attente',
      'chef : département automatique et registre non demandé',
    ],
    errors,
    apiFailures,
  };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  const rows = await prisma.courrier.findMany({
    where: { numero: { in: [tag, tag + '-CHEF'] } },
    select: { id: true },
  });
  await prisma.circuitCourrier.deleteMany({ where: { courrierId: { in: rows.map((r) => r.id) } } });
  await prisma.courrier.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  if (head) await prisma.user.delete({ where: { id: head.id } });
  if (department) await prisma.departement.delete({ where: { id: department.id } });
  await prisma.$disconnect();
}
