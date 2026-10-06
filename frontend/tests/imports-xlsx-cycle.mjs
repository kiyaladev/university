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

const { zipSync } = await import('fflate');
const tag = 'QA-XLSX-' + randomUUID();
const xml = s => new TextEncoder().encode(s);
const cells = ['Code', 'Nom', 'Capacité', 'Actif', tag, 'Amphithéâtre QA', '20', 'non'];
const sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + [cells.slice(0, 4), cells.slice(4)].map((row, i) => '<row r="' + (i + 1) + '">' + row.map((value, j) => '<c r="' + String.fromCharCode(65 + j) + (i + 1) + '" t="inlineStr"><is><t>' + value + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>';
const workbook = zipSync({
 'xl/workbook.xml': xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import" sheetId="1" r:id="rId1"/></sheets></workbook>'),
 'xl/_rels/workbook.xml.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>'),
 'xl/worksheets/sheet1.xml': xml(sheet),
});
const report = { date: new Date().toISOString(), statut: 'en_cours', viewport: 375 };
const browser = await chromium.launch();
try {
 const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE));
 assert.equal(session.api, api); assert.equal(session.database, database.pathname);
 const token = session.sessions.SCOLARITE;
 const me = await (await fetch(api + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
 assert.equal(me.role, 'SCOLARITE');
 const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
 await context.addInitScript(token => { localStorage.setItem('unipresence_token', token); localStorage.setItem('lang', 'fr-FR'); }, token);
 const page = await context.newPage(); page.setDefaultTimeout(60000);
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto(base + '/#/imports', { waitUntil: 'networkidle' });
 await page.locator('.q-select').click(); await page.getByRole('option', { name: 'Salles', exact: true }).click();
 await page.locator('input[type=file]').setInputFiles({ name: 'recette.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(workbook) });
 const previewResponse = page.waitForResponse(r => r.url().endsWith('/imports/referentiels/previsualiser') && r.request().method() === 'POST');
 await page.getByRole('button', { name: 'Prévisualiser', exact: true }).click();
 const preview = await previewResponse; assert.equal(preview.status(), 201);
 assert.equal((await preview.json()).valides, 1);
 assert.ok(preview.request().postDataJSON().contenu.includes('Amphithéâtre QA'));
 assert.equal(await prisma.salle.count({ where: { code: tag } }), 0);
 await page.getByRole('button', { name: 'Importer les lignes valides', exact: true }).click();
 const appliedResponse = page.waitForResponse(r => r.url().endsWith('/imports/referentiels/appliquer') && r.request().method() === 'POST');
 await page.locator('.q-dialog').getByRole('button', { name: 'OK', exact: true }).click();
 const applied = await appliedResponse; assert.equal(applied.status(), 201); assert.equal((await applied.json()).importees, 1);
 const room = await prisma.salle.findUniqueOrThrow({ where: { code: tag } });
 assert.equal(room.actif, false); assert.equal(room.capacite, 20); assert.equal(room.nom, 'Amphithéâtre QA');
 assert.equal(await prisma.auditLog.count({ where: { entiteId: room.id, action: 'SALLE_CREEE' } }), 1);
 assert.deepEqual(errors, []);
 report.statut = 'valide'; report.observations = ['Fichier XLSX réel choisi dans le formulaire mobile', 'Décodage Unicode et transmission CSV à API QA', 'Aperçu sans écriture', 'Confirmation puis création persistée inactive, capacité 20', 'Une trace de création', 'Aucune erreur JavaScript'];
} catch (e) { report.statut = 'echec'; report.erreur = e.message; process.exitCode = 1; }
finally {
 const rooms = await prisma.salle.findMany({ where: { code: tag } });
 await prisma.auditLog.deleteMany({ where: { entiteId: { in: rooms.map(r => r.id) } } });
 await prisma.salle.deleteMany({ where: { code: tag } });
 report.fixturesRestantes = await prisma.salle.count({ where: { code: tag } });
 report.historicalFilesPending = true; report.productionUntouched = true;
 fs.writeFileSync('../audit/recommandations-2026-10-06/imports-xlsx-interface.json', JSON.stringify(report, null, 2) + '\n');
 await browser.close(); await prisma.$disconnect(); console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur }));
}
