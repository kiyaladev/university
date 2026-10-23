/** Création/publication/archivage depuis l'interface QA locale. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
if (!process.env.QA_ENV_FILE) throw Error('QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const base = process.argv[2] || 'http://127.0.0.1:15042';
assert.equal(base, 'http://127.0.0.1:15042');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const tag = 'QA-UI-VOD-' + randomUUID();
const browser = await chromium.launch();
const errors = [];
async function login(email, password) {
  const response = await fetch(api + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 201);
  return (await response.json()).token;
}
async function pageFor(token) {
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript(token => { localStorage.setItem('university_token', token); localStorage.setItem('university_lang', 'fr-FR'); }, token);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/#/vod', { waitUntil: 'networkidle' });
  return page;
}
try {
  const token = await login('admin@unipresence.gn', 'Passer@2026');
  const me = await (await fetch(api + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(me.id, (await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } })).id);
  const page = await pageFor(token);
  await page.getByRole('button', { name: 'Nouvelle ressource', exact: true }).click();
  let dialog = page.locator('.q-dialog').last();
  assert.ok(await dialog.locator('.q-card').evaluate(e => e.getBoundingClientRect().width <= innerWidth));
  await dialog.getByLabel('Titre', { exact: true }).fill(tag);
  await dialog.getByLabel('URL du média (Mux / S3 / CDN / chemin local)', { exact: true }).fill('https://example.invalid/fictif.mp4');
  await dialog.locator('.q-toggle').filter({ hasText: 'Ressource publique' }).click();
  const creation = page.waitForResponse(r => r.url().endsWith('/vod') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  const response = await creation;
  assert.equal(response.status(), 201);
  assert.equal(response.request().postDataJSON().public, false);
  const vod = await response.json();
  assert.equal((await prisma.coursVOD.findUniqueOrThrow({ where: { id: vod.id } })).public, false);
  const card = page.locator('.vod-carte').filter({ hasText: tag });
  await card.getByRole('button', { name: 'Modifier la ressource', exact: true }).click();
  dialog = page.locator('.q-dialog').last();
  await dialog.locator('.q-toggle').filter({ hasText: 'Ressource publique' }).click();
  const modification = page.waitForResponse(r => r.url().endsWith('/vod/' + vod.id) && r.request().method() === 'PUT');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  assert.equal((await modification).status(), 200);
  const publication = page.waitForResponse(r => r.url().endsWith(`/vod/${vod.id}/publier`));
  await card.getByRole('button', { name: 'Mettre la ressource en ligne', exact: true }).click();
  assert.equal((await publication).status(), 201);
  const teacherPage = await pageFor(await login('enseignant@unipresence.gn', 'Passer@2026'));
  const foreignCard = teacherPage.locator('.vod-carte').filter({ hasText: tag });
  await foreignCard.waitFor();
  assert.equal(await foreignCard.getByRole('button', { name: 'Modifier la ressource', exact: true }).count(), 0);
  assert.equal(await foreignCard.getByRole('button', { name: 'Archiver la ressource', exact: true }).count(), 0);
  const archive = page.waitForResponse(r => r.url().endsWith(`/vod/${vod.id}/archiver`));
  await card.getByRole('button', { name: 'Archiver la ressource', exact: true }).click();
  await page.locator('.q-dialog').last().getByRole('button', { name: 'Archiver', exact: true }).click();
  assert.equal((await archive).status(), 201);
  await page.waitForTimeout(500);
  await card.waitFor();
  for (const name of ['Modifier la ressource', 'Mettre la ressource en ligne', 'Archiver la ressource']) assert.equal(await card.getByRole('button', { name, exact: true }).count(), 0);
  assert.equal((await prisma.coursVOD.findUniqueOrThrow({ where: { id: vod.id } })).statut, 'ARCHIVE');
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), viewport: 375, checks: ['dialogue contenu à 375 px', 'création privée avec booléen false persisté', 'modification publique et publication depuis la carte', 'actions auteur absentes pour un autre enseignant', 'archivage persisté et actions terminales absentes'], errors, mediaPlayed: false, productionUntouched: true };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await prisma.coursVOD.deleteMany({ where: { titre: tag } });
  await prisma.$disconnect();
}
