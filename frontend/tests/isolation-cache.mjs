import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:15034';
const api = process.argv[3] || 'http://127.0.0.1:15031/api';
const report = process.argv[4] || '/tmp/university-cache.json';
if (![base, api].every(value => ['localhost', '127.0.0.1'].includes(new URL(value).hostname))) throw Error('Recette locale obligatoire');
async function login(email, password) {
  const response = await fetch(api + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 201);
  return (await response.json()).token;
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const admin = await login('admin@unipresence.gn', 'Passer@2026');
  const student = await login('etudiant1@university.gn', 'Etu#2026');
  async function teachers(token) {
    return page.evaluate(async ({ api, token }) => {
      const response = await fetch(api + '/enseignants?all=1', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw Error(`API ${response.status}`);
      return response.json();
    }, { api, token });
  }
  const administrative = await teachers(admin);
  const minimal = await teachers(student);
  assert.ok(administrative.data.some(row => 'tauxHoraire' in row));
  assert.ok(minimal.data.length && minimal.data.every(row => !('tauxHoraire' in row)));
  await page.waitForFunction(async () => {
    const cache = await caches.open('unipresence-api-v2');
    const keys = await cache.keys();
    return keys.filter(key => new URL(key.url).pathname.endsWith('/enseignants')).length === 2;
  });
  const keys = await page.evaluate(async () => (await (await caches.open('unipresence-api-v2')).keys()).map(key => key.url));
  assert.ok(keys.every(key => !key.includes(admin) && !key.includes(student)));
  await context.setOffline(true);
  assert.deepEqual((await teachers(student)).data, minimal.data, 'Le cache étudiant conserve sa projection minimale');
  assert.deepEqual((await teachers(admin)).data, administrative.data, 'Le cache administrateur reste séparé');
  const result = { date: new Date().toISOString(), checks: ['Deux sessions pour une même URL', 'Aucun jeton dans les clés du cache', 'Projection étudiant conservée hors ligne', 'Cache administrateur séparé'] };
  fs.writeFileSync(report, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
