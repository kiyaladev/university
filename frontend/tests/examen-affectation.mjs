import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-examen-affectation.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('PWA locale obligatoire');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
  const erreurs = [];
  page.on('pageerror', error => erreurs.push(error.message));
  await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('scolarite@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.hash.startsWith('#/connexion'));
  await page.goto(base + '/#/examens', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Planifier un examen' }).first().click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByRole('combobox', { name: 'Surveillant affecté' });
  const responsePromise = page.waitForResponse(response => response.url().includes('/examens/surveillants?'));
  await field.focus();
  const response = await responsePromise;
  const reponseSurveillants = { status: response.status(), data: await response.json() };
  assert.equal(reponseSurveillants.status, 200);
  assert.ok(Array.isArray(reponseSurveillants.data));
  assert.ok(reponseSurveillants.data.every(user => ['CONTROLEUR', 'ENSEIGNANT'].includes(user.role)));
  assert.ok(reponseSurveillants.data.every(user => !('email' in user) && !('password' in user)));
  assert.equal(await field.isVisible(), true);
  assert.deepEqual(erreurs, []);
  fs.writeFileSync(report, JSON.stringify({ date: new Date().toISOString(), environnement: 'QA locale isolée', status: reponseSurveillants.status, options: reponseSurveillants.data.length, rolesAutorises: [...new Set(reponseSurveillants.data.map(user => user.role))], erreursJavaScript: erreurs }, null, 2));
  console.log(JSON.stringify({ status: reponseSurveillants.status, options: reponseSurveillants.data.length, roles: [...new Set(reponseSurveillants.data.map(user => user.role))] }));
} finally { await browser.close(); }
