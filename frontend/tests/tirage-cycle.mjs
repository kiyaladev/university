/** Circuit déclaré depuis le navigateur ; aucune imprimante sollicitée. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
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
const tag = 'QA-UI-TIRAGE-' + randomUUID();
const browser = await chromium.launch();
let examId;
async function request(token, route, body) {
  const response = await fetch(api + route, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 201);
  return response.json();
}
try {
  const { token } = await request(null, '/auth/login', { email: 'admin@unipresence.gn', password: 'Passer@2026' });
  const me = await (await fetch(api + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(me.id, (await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } })).id);
  const year = await prisma.anneeAcademique.findFirstOrThrow({ where: { active: true, cloturee: false } });
  const promotion = await prisma.promotion.findFirstOrThrow({ where: { anneeId: year.id } });
  const matiere = await prisma.matiere.findFirstOrThrow();
  const exam = await request(token, '/examens', { intitule: 'Épreuve fictive', codeExamen: tag, type: 'FINAL', anneeId: year.id, promotionId: promotion.id, matiereId: matiere.id, dateExamen: '2026-10-06', heureDebut: '09:00', heureFin: '11:00' });
  examId = exam.id;
  const hash = createHash('sha256').update('Épreuve fictive').digest('hex');
  const tirage = await request(token, '/tirage', { examenId: exam.id, dateTirage: '2026-10-06', nbExemplaires: 2, empreinteSource: hash });
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript(token => { localStorage.setItem('university_token', token); localStorage.setItem('university_lang', 'fr-FR'); }, token);
  const page = await context.newPage();
  const errors = [], transitions = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/#/tirage?examenId=' + exam.id, { waitUntil: 'networkidle' });
  const card = page.locator('.kanban__carte').filter({ hasText: tag });
  const stages = [
    ['Imprimé', 'imprimer', 'IMPRIME', 'Imprimer'],
    ['Mis sous pli', 'mettre-sous-pli', 'MIS_SOUS_PLI', 'Mis sous pli'],
    ['Distribué', 'distribuer', 'DISTRIBUE', 'Distribué'],
    ['Récupéré', 'recuperer', 'RECUPERE', 'Récupéré'],
  ];
  for (const [label, route, stage, confirmation] of stages) {
    await card.getByRole('button', { name: '→ ' + label, exact: true }).click();
    const dialog = page.locator('.q-dialog').last();
    assert.ok(await dialog.locator('.q-card').evaluate(e => e.getBoundingClientRect().width <= innerWidth));
    const responsePromise = page.waitForResponse(r => r.url().endsWith(`/tirage/${tirage.id}/${route}`));
    await dialog.getByRole('button', { name: confirmation, exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201, route + ': ' + await response.text());
    const body = response.request().postDataJSON();
    if (stage === 'IMPRIME') assert.equal(body.empreinteSource, hash);
    else assert.equal(body.stade, stage);
    assert.equal((await prisma.tirage.findUniqueOrThrow({ where: { id: tirage.id } })).stade, stage);
    transitions.push({ stage, status: response.status() });
    await page.waitForTimeout(300);
  }
  assert.equal(await card.getByRole('button', { name: /^→ / }).count(), 0);
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), viewport: 375, transitions, checks: ['empreinte déclarée envoyée à l’impression', 'stade envoyé pour chaque transition', 'quatre étapes persistées jusqu’à RECUPERE', 'dialogues contenus à 375 px', 'action de transition absente après récupération'], errors, physicalPrinterUsed: false, productionUntouched: true };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  if (examId) {
    await prisma.tirage.deleteMany({ where: { examenId: examId } });
    await prisma.examen.delete({ where: { id: examId } });
  }
  await prisma.$disconnect();
}
