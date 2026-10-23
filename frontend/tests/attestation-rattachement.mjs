/** Formulaire d’attestation sur des inscriptions fictives, API et base QA réelles. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
assert.ok(process.env.QA_ENV_FILE, 'QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(env.PORT, '15041');
const base = process.argv[2] || 'http://127.0.0.1:15042';
assert.equal(base, 'http://127.0.0.1:15042');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const tag = 'QA-UI-ATT-' + randomUUID();
const browser = await chromium.launch();
const years = [], promotions = [];
let studentId, otherStudentId, releaseOldResponse;
const observations = {}, errors = [], apiFailures = [];
try {
  const login = await fetch('http://127.0.0.1:15041/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@unipresence.gn', password: 'Passer@2026' }) });
  assert.equal(login.status, 201);
  const { token } = await login.json();
  const sample = await prisma.promotion.findFirstOrThrow();
  for (const suffix of ['A', 'B']) {
    years.push(await prisma.anneeAcademique.create({ data: { libelle: tag + '-ANNEE-' + suffix, dateDebut: new Date('2026-09-01'), dateFin: new Date('2027-07-31') } }));
  }
  for (const [suffix, year] of [['A', years[0]], ['VIDE', years[0]], ['B', years[1]]]) {
    promotions.push(await prisma.promotion.create({ data: { nom: tag + '-PROMO-' + suffix, niveau: sample.niveau, filiereId: sample.filiereId, anneeId: year.id } }));
  }
  const student = await prisma.etudiant.create({ data: { matricule: tag, nom: 'Recette', prenom: 'Parcours' } });
  studentId = student.id;
  const otherStudent = await prisma.etudiant.create({ data: { matricule: tag + '-AUTRE', nom: 'Recette', prenom: 'Autre' } });
  otherStudentId = otherStudent.id;
  const inscriptions = [];
  for (const [index, promotion] of [[0, promotions[0]], [1, promotions[2]]]) {
    inscriptions.push(await prisma.inscription.create({ data: { numero: tag + '-INS-' + (index ? 'B' : 'A'), etudiantId: student.id, anneeId: years[index].id, promotionId: promotion.id, statut: 'VALIDE' } }));
  }
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, serviceWorkers: 'block' });
  await context.addInitScript(token => { localStorage.setItem('university_token', token); localStorage.setItem('university_lang', 'fr-FR'); }, token);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  await page.goto(base + '/#/attestations?' + new URLSearchParams({ emettre: '1', etudiantId: student.id, anneeId: years[0].id, promotionId: promotions[0].id, type: 'SCOLARITE' }), { waitUntil: 'networkidle' });
  const dialog = page.locator('.q-dialog').last();
  observations.mobileDialogFitsViewport = await dialog.locator('.q-card').evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  const field = label => dialog.locator('.q-select').filter({ has: page.locator('.q-field__label').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
  const enrollment = () => field('Inscription liée (facultatif)');
  async function choose(label, text) {
    const select = field(label);
    await select.scrollIntoViewIfNeeded();
    await select.locator('.q-field__control').click();
    await page.locator('.q-menu .q-item').filter({ hasText: text }).first().click();
  }
  await enrollment().waitFor();
  await choose('Inscription liée (facultatif)', inscriptions[0].numero);
  const emptyPromotionResponse = page.waitForResponse(r => { const u = new URL(r.url()); return u.pathname.endsWith('/inscriptions') && u.searchParams.get('etudiantId') === student.id && u.searchParams.get('promotionId') === promotions[1].id; });
  await choose('Promotion', promotions[1].nom);
  assert.deepEqual((await (await emptyPromotionResponse).json()).data, []);
  await page.waitForTimeout(50);
  observations.promotionChangeClearsIncompatibleEnrollment = await enrollment().count() === 0;
  await choose('Promotion', promotions[0].nom);
  await enrollment().waitFor();
  await choose('Inscription liée (facultatif)', inscriptions[0].numero);
  await choose('Année académique', years[1].libelle);
  await page.waitForTimeout(500);
  observations.yearChangeClearsPreviousPromotion = !(await field('Promotion').innerText()).includes(promotions[0].nom);
  observations.yearChangeClearsPreviousEnrollment = !(await dialog.innerText()).includes(inscriptions[0].numero);
  await choose('Promotion', promotions[2].nom);
  await enrollment().waitFor();
  await choose('Inscription liée (facultatif)', inscriptions[1].numero);

  // Retenir une vraie réponse de l’API pour l’année A, puis la livrer après B.
  let markOldResponseHeld;
  const oldResponseHeld = new Promise(resolve => { markOldResponseHeld = resolve; });
  const oldResponseReleased = new Promise(resolve => { releaseOldResponse = resolve; });
  let delayed = false;
  await page.route('**/api/inscriptions?**', async route => {
    const query = new URL(route.request().url()).searchParams;
    if (!delayed && query.get('etudiantId') === student.id && query.get('anneeId') === years[0].id) {
      delayed = true;
      const response = await route.fetch();
      markOldResponseHeld();
      await oldResponseReleased;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await choose('Année académique', years[0].libelle);
  let interceptionTimeout;
  try {
    await Promise.race([oldResponseHeld, new Promise((_, reject) => { interceptionTimeout = setTimeout(() => reject(Error('La réponse de l’année précédente n’a pas été interceptée')), 15000); })]);
  } finally {
    clearTimeout(interceptionTimeout);
  }
  await choose('Année académique', years[1].libelle);
  await enrollment().waitFor();
  const oldDelivery = page.waitForResponse(r => { const url = new URL(r.url()); return url.pathname.endsWith('/inscriptions') && url.searchParams.get('etudiantId') === student.id && url.searchParams.get('anneeId') === years[0].id; });
  releaseOldResponse();
  await oldDelivery;
  await page.waitForTimeout(300);
  await enrollment().locator('.q-field__control').click();
  const offered = await page.locator('.q-menu .q-item').allTextContents();
  observations.latePreviousYearResponseIgnored = offered.some(t => t.includes(inscriptions[1].numero)) && !offered.some(t => t.includes(inscriptions[0].numero));
  await page.locator('.q-menu .q-item').filter({ hasText: inscriptions[observations.latePreviousYearResponseIgnored ? 1 : 0].numero }).first().click();
  await field('Année académique').locator('.q-field__focusable-action').click();
  await page.waitForTimeout(100);
  observations.clearingYearClearsPromotionAndEnrollment = !(await field('Promotion').innerText()).includes(promotions[2].nom) && await enrollment().count() === 0;
  await choose('Promotion', promotions[2].nom);
  await enrollment().waitFor();
  observations.promotionWithoutYearSelectsItsYear = (await field('Année académique').innerText()).includes(years[1].libelle);
  await choose('Inscription liée (facultatif)', inscriptions[1].numero);
  async function chooseStudent(identity) {
    const enrollmentResponse = page.waitForResponse(r => { const u = new URL(r.url()); return u.pathname.endsWith('/inscriptions') && u.searchParams.get('etudiantId') === identity.id; });
    await field('Étudiant *').locator('input').fill(identity.matricule);
    await page.locator('.q-menu .q-item').getByText(`${identity.nom} ${identity.prenom} — ${identity.matricule}`, { exact: true }).click();
    await enrollmentResponse;
    await page.waitForTimeout(50);
  }
  await chooseStudent(otherStudent);
  observations.studentChangeClearsPreviousEnrollment = await enrollment().count() === 0;
  await chooseStudent(student);
  await enrollment().waitFor();
  await choose('Inscription liée (facultatif)', inscriptions[1].numero);
  const issuance = page.waitForResponse(r => r.url().endsWith('/api/attestations') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Émettre', exact: true }).click();
  const issued = await issuance;
  observations.issuanceStatus = issued.status();
  if (issued.status() === 201) {
    const document = await prisma.attestation.findUniqueOrThrow({ where: { id: (await issued.json()).id } });
    observations.persistedTrackMatchesLatestChoice = document.etudiantId === student.id && document.anneeId === years[1].id && document.promotionId === promotions[2].id && document.inscriptionId === inscriptions[1].id;
  }
  const passed = Object.entries(observations).every(([key, value]) => key === 'issuanceStatus' ? value === 201 : value === true) && !errors.length && !apiFailures.length;
  const report = { date: new Date().toISOString(), passed, viewport: 375, observations, errors, apiFailures, apiAndDatabaseReal: true, oldResponseDelayedWithoutChangingItsContent: true, serviceWorkerBlockedForNetworkInterception: true, productionUntouched: true };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert.ok(passed, 'Les sélections doivent suivre le dernier parcours choisi');
} finally {
  releaseOldResponse?.();
  await browser.close();
  if (studentId) {
    await prisma.attestation.deleteMany({ where: { etudiantId: studentId } });
    await prisma.inscription.deleteMany({ where: { etudiantId: studentId } });
    await prisma.etudiant.delete({ where: { id: studentId } });
  }
  if (otherStudentId) await prisma.etudiant.delete({ where: { id: otherStudentId } });
  for (const promotion of promotions) await prisma.promotion.delete({ where: { id: promotion.id } });
  for (const year of years) await prisma.anneeAcademique.delete({ where: { id: year.id } });
  await prisma.$disconnect();
}
