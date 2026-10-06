/** Recette de correction et traduction, exclusivement sur les fixtures QA locales. */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const base = process.argv[2] || 'http://127.0.0.1:15034';
const fixtureFile = process.argv[3];
const database = new URL(process.env.DATABASE_URL);
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname) || !['localhost','127.0.0.1'].includes(database.hostname) || !/^\/university_qa_\d+$/.test(database.pathname) || !fixtureFile?.includes('/university_qa_')) throw Error('Base, API et fixtures QA locales obligatoires');
const [seanceId] = JSON.parse(fs.readFileSync(fixtureFile));
const db = new PrismaClient();
const browser = await chromium.launch();
const checks = [];
let before;
try {
 before = await db.controle.findUniqueOrThrow({ where: { seanceId } });
 await db.controle.update({ where: { seanceId }, data: { statut: 'PRESENT', attestation: 'SIGNATURE', attestationValide: true, signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' } });
 for (const language of ['fr-FR','en-US']) {
  const context = await browser.newContext({ locale: language, viewport: { width: 390, height: 950 } });
  const page = await context.newPage(); const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto(base+'/#/connexion', {waitUntil:'networkidle'});
  await page.locator('input[type=email]').fill('controleur1@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url=>url.hash==='#/controle');
  const card=page.locator('article.seance').filter({hasText:'22:31'});
  await card.locator('button.seance__action').click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  const en=language==='en-US';
  await dialog.getByRole('tab',{name:en?'Sign':'Signer',exact:true}).click();
  const save=dialog.getByRole('button',{name:en?'Correct attendance record':'Corriger le pointage',exact:true});
  assert.equal(await save.isDisabled(),true,'L’ancienne signature ne doit pas autoriser la correction');
  await dialog.getByText(en?'Every correction requires new confirmation from the teacher.':'Toute correction du constat exige une nouvelle attestation de l’enseignant.',{exact:true}).waitFor();
  await dialog.getByText(en?'Teacher confirmation':'Attestation de l’enseignant',{exact:true}).waitFor();
  await dialog.getByRole('textbox',{name:en?'Observed arrival':'Arrivée constatée',exact:true}).waitFor();
  await dialog.getByRole('button',{name:en?'Clear':'Effacer',exact:true}).waitFor();
  const canvas=dialog.locator('canvas');const box=await canvas.boundingBox();
  await page.mouse.move(box.x+20,box.y+25);await page.mouse.down();await page.mouse.move(box.x+90,box.y+65,{steps:8});await page.mouse.up();
  assert.equal(await save.isDisabled(),false,'Une nouvelle signature autorise la correction');
  await dialog.getByRole('button',{name:en?'Clear':'Effacer',exact:true}).click();
  assert.equal(await save.isDisabled(),true,'Effacer la preuve bloque à nouveau la correction');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  checks.push({language,previousSignature:'refused',newSignature:'accepted',clear:'blocks save',translation:'OK',mobile:'OK'});
  await page.screenshot({path:(process.argv[4]||'/tmp/university-pointage-langues.json').replace('.json','-'+language+'.png'),fullPage:true});
  await context.close();
 }
 const report={date:new Date().toISOString(),checks};fs.writeFileSync(process.argv[4]||'/tmp/university-pointage-langues.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
 if(before)await db.controle.update({where:{seanceId},data:{statut:before.statut,attestation:before.attestation,attestationValide:before.attestationValide,signatureBase64:before.signatureBase64}});
 await browser.close();await db.$disconnect();
}
