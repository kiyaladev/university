/** Émission et encaissement au guichet depuis le navigateur QA à 375 px. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
assert.ok(process.env.QA_ENV_FILE && process.env.QA_SESSION_FILE, 'Environnement et session QA obligatoires');
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
const tag = 'QA-UI-REGIE-' + randomUUID();
const browser = await chromium.launch();
let receiptId, paymentId;
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem('university_token', token);
    localStorage.setItem('university_lang', 'fr-FR');
    localStorage.setItem('up:vue:recettes', 'cartes');
  }, session.token);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [],
    apiFailures = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400)
      apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  await page.goto(base + '/#/recettes', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Émettre une recette', exact: true }).first().click();
  const dialog = page.locator('.q-dialog').last();
  const field = (label) =>
    dialog.locator('.q-field').filter({
      has: page
        .locator('.q-field__label')
        .filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }),
    });
  assert.ok(await dialog.locator('.q-card').evaluate((e) => e.getBoundingClientRect().width <= innerWidth));
  for (const label of ['Date *', 'Montant *', 'Devise'])
    assert.ok(
      await field(label).evaluate((e) => e.getBoundingClientRect().width >= 300),
      label + ' doit rester lisible sur mobile',
    );
  await field('Numéro (REC-AAAA-XXXXX)').locator('input').fill(tag);
  await field('Libellé *').locator('input').fill('Prestation fictive QA');
  await field('Montant *').locator('input').fill('1250');
  const issuance = page.waitForResponse((r) => r.url().endsWith('/api/recettes') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Émettre une recette', exact: true }).click();
  const issued = await issuance;
  assert.equal(issued.status(), 201, await issued.text());
  receiptId = (await issued.json()).id;
  const search = page.locator('.barre-filtres input').first();
  if (await search.count()) await search.fill(tag);
  const card = page.locator('.recette-carte').filter({ hasText: tag });
  await card.getByRole('button', { name: 'Encaisser', exact: true }).click();
  const confirmation = page.locator('.q-dialog').last();
  const collection = page.waitForResponse((r) => r.url().endsWith(`/recettes/${receiptId}/encaisser`));
  await confirmation.getByRole('button', { name: 'Encaisser', exact: true }).click();
  const collected = await collection;
  assert.equal(collected.status(), 201);
  const receipt = await prisma.recetteExterne.findUniqueOrThrow({
    where: { id: receiptId },
    include: { paiement: true },
  });
  paymentId = receipt.paiementId;
  assert.equal(receipt.paiement.statut, 'REUSSI');
  assert.equal(receipt.paiement.montant, 1250);
  await card.getByRole('link', { name: 'Voir le paiement', exact: true }).waitFor();
  assert.equal(await card.getByRole('button', { name: 'Encaisser', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(apiFailures, []);
  const report = {
    date: new Date().toISOString(),
    passed: true,
    viewport: 375,
    observations: {
      dateAmountCurrencyFieldsReadable: true,
      issuanceStatus: 201,
      collectionStatus: 201,
      successfulPaymentAmount: 1250,
      paidCardHidesCollectionAction: true,
    },
    errors,
    apiFailures,
    sessionSource: session.fixtureSource,
    actualCashMovementPending: true,
    productionUntouched: true,
  };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await prisma.recetteExterne.deleteMany({ where: { numero: tag } });
  await prisma.paiement.deleteMany({
    where: { OR: [{ id: paymentId ?? 'absent' }, { motif: { startsWith: 'Recette externe ' + tag } }] },
  });
  await prisma.$disconnect();
}
