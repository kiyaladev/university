import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:15042';
const api = process.env.API_URL || 'http://127.0.0.1:15041/api';
if (![base, api].every(url => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) || process.env.QA_DATABASE !== 'university_recommandations_20261006') throw Error('Recette locale et base QA explicites obligatoires');
async function call(path, token, method = 'GET', body) {
  const response = await fetch(api + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
}
const admin = (await call('/auth/login', '', 'POST', { email: 'admin@unipresence.gn', password: 'Passer@2026' })).token;
const student = (await call('/auth/login', '', 'POST', { email: 'etudiant1@university.gn', password: 'Etu#2026' })).token;
let tarif = (await call('/documents-demande/tarifs', student)).find(t => t.montant > 0);
if (!tarif) tarif = await call('/documents-demande/tarifs', admin, 'POST', { type: 'ATTESTATION_SCOLARITE', montant: 1000, delaiHeures: 24 });
const demande = await call('/documents-demande', student, 'POST', { type: tarif.type, motif: 'Recette QA du paiement documentaire' });
assert.equal(demande.statut, 'EN_ATTENTE_PAIEMENT');
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
  await context.addInitScript(token => localStorage.setItem('university_token', token), student);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/#/demandes-docs/mes', { waitUntil: 'networkidle' });
  await page.getByRole('row').filter({ hasText: demande.numero }).getByRole('button', { name: 'Payer', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Payer', exact: true }).click();
  await dialog.getByText('Indiquez un numéro Mobile Money valide.', { exact: true }).waitFor();
  await dialog.getByLabel('Numéro Mobile Money', { exact: true }).fill('+224622000001');
  const responsePromise = page.waitForResponse(r => r.url().endsWith(`/documents-demande/${demande.id}/payer`) && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Payer', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const payload = response.request().postDataJSON();
  assert.equal(payload.mode, 'MOBILE_MONEY');
  assert.equal(payload.telephone, '+224622000001');
  assert.equal('simuler' in payload, false);
  const saved = await call(`/documents-demande/${demande.id}`, student);
  assert.equal(saved.paiement.statut, 'EN_ATTENTE');
  assert.equal(saved.statut, 'EN_ATTENTE_PAIEMENT');
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), environnement: 'API et base QA réelles, aucun opérateur externe', checks: ['numéro vide refusé dans le navigateur', 'demande Mobile Money sans simulation envoyée', 'paiement persisté EN_ATTENTE', 'document non traité avant confirmation', 'aucune erreur JavaScript'] };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
