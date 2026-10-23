import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:15042';
const api = process.env.API_URL || 'http://127.0.0.1:15041/api';
if (![base, api].every(url => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname))) throw Error('Recette réservée aux environnements locaux');
const browser = await chromium.launch();
const results = [];
try {
  for (const [role, email, password, routes] of [
    ['ADMIN', 'admin@unipresence.gn', 'Passer@2026', ['/etudiants', '/inscriptions', '/paie', '/recettes', '/attestations', '/demandes-docs', '/demandes-docs/tarifs', '/notes', '/evaluations', '/deliberations', '/bulletins', '/cartes-etudiantes', '/badges', '/parametres']],
    ['ETUDIANT', 'etudiant1@university.gn', 'Etu#2026', ['/demandes-docs/mes', '/emploi-du-temps']],
  ]) {
    const response = await fetch(api + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 201);
    const { token } = await response.json();
    const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
    await context.addInitScript(token => { localStorage.setItem('university_token', token); localStorage.setItem('university_lang', 'fr-FR'); }, token);
    const page = await context.newPage();
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    for (const route of routes) {
      errors = [];
      await page.goto(base + '/#' + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      assert.equal(new URL(page.url()).hash, '#' + route);
      assert.deepEqual(errors, [], route);
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(layout.scrollWidth <= layout.width + 1, JSON.stringify({ role, route, ...layout }));
      results.push({ role, route, ...layout, errors });
    }
    await context.close();
  }
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ date: new Date().toISOString(), language: 'fr-FR', results }, null, 2));
  console.log(JSON.stringify({ checks: results.length, failures: 0 }));
} finally { await browser.close(); }
