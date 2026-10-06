import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { chromium } from 'playwright';

const fichier = new URL('../src/services/file-chiffree.ts', import.meta.url);
const source = fs.readFileSync(fichier, 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
const moduleBase64 = Buffer.from(javascript).toString('base64');
const serveur = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>Test coffre hors ligne</title>');
});
await new Promise(resolve => serveur.listen(0, '127.0.0.1', resolve));
const adresse = serveur.address();
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${adresse.port}`);
  const controles = await page.evaluate(async (encoded) => {
    const { ecrireFileChiffree, lireFileChiffree } = await import(`data:text/javascript;base64,${encoded}`);
    const cle = 'file_test_agent';
    const pointage = {
      seanceId: 'seance-avec-signature',
      signatureBase64: 'SIGNATURE_MANUSCRITE_A_NE_PAS_LIRE',
    };
    await ecrireFileChiffree(cle, 'compte-controleur', [pointage]);
    const stockage = localStorage.getItem(cle);
    const relu = await lireFileChiffree(cle, 'compte-controleur', []);
    let autreCompteRefuse = false;
    try { await lireFileChiffree(cle, 'autre-compte', []); } catch { autreCompteRefuse = true; }

    const db = await new Promise((resolve, reject) => {
      const demande = indexedDB.open('unipresence-file-crypto-v1', 1);
      demande.onsuccess = () => resolve(demande.result);
      demande.onerror = () => reject(demande.error);
    });
    const cleStockee = await new Promise((resolve, reject) => {
      const lecture = db.transaction('cles', 'readonly').objectStore('cles').get('compte-controleur');
      lecture.onsuccess = () => resolve(lecture.result?.cle);
      lecture.onerror = () => reject(lecture.error);
    });
    db.close();

    const migration = 'file_ancienne';
    localStorage.setItem(migration, JSON.stringify([{ seanceId: 'ancienne' }]));
    const migree = await lireFileChiffree(migration, 'compte-controleur', []);
    const stockageMigre = localStorage.getItem(migration);

    const alteree = `${stockage.slice(0, -2)}AA`;
    localStorage.setItem(cle, alteree);
    let alterationRefusee = false;
    try { await lireFileChiffree(cle, 'compte-controleur', []); } catch { alterationRefusee = true; }

    return {
      prefixe: stockage.startsWith('upf1:'),
      signatureEnClairAbsente: !stockage.includes(pointage.signatureBase64),
      pinEnClairAbsent: !stockage.includes('PIN_A_NE_JAMAIS_STOCKER'),
      roundTrip: relu[0],
      autreCompteRefuse,
      cleNonExtractible: cleStockee?.extractable === false,
      migrationConserveDonnees: migree[0]?.seanceId === 'ancienne',
      migrationChiffree: stockageMigre.startsWith('upf1:') && !stockageMigre.includes('ancienne'),
      alterationRefusee,
      valeurAltereePreservee: localStorage.getItem(cle) === alteree,
    };
  }, moduleBase64);

  assert.equal(controles.prefixe, true);
  assert.equal(controles.signatureEnClairAbsente, true);
  assert.equal(controles.pinEnClairAbsent, true);
  assert.deepEqual(controles.roundTrip, {
    seanceId: 'seance-avec-signature',
    signatureBase64: 'SIGNATURE_MANUSCRITE_A_NE_PAS_LIRE',
  });
  assert.equal(controles.autreCompteRefuse, true);
  assert.equal(controles.cleNonExtractible, true);
  assert.equal(controles.migrationConserveDonnees, true);
  assert.equal(controles.migrationChiffree, true);
  assert.equal(controles.alterationRefusee, true);
  assert.equal(controles.valeurAltereePreservee, true);
  console.log(JSON.stringify({ date: new Date().toISOString(), checks: Object.keys(controles) }));
} finally {
  await browser.close();
  await new Promise(resolve => serveur.close(resolve));
}
