import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import ts from 'typescript';
import { chromium } from 'playwright';

const fichier = new URL('../src/shared/services/file-chiffree.ts', import.meta.url);
const source = fs.readFileSync(fichier, 'utf8');
const javascript = ts
  .transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext })
  // Le service est chargé par une URL `data:` : l'alias `@/boot/i18n` du projet
  // n'y est pas résolvable. Ses messages ne portent que des clés de
  // traduction : un stub suffit à faire tourner le service hors application.
  .replace(
    /import\s+\{\s*i18n\s*\}\s+from\s+['"]@\/boot\/i18n['"];?/,
    'const i18n = { global: { t: (cle) => cle } };',
  );
assert.ok(!javascript.includes('@/boot/i18n'), "l'import i18n doit être neutralisé");
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
      codePinEnseignant: 'PIN_A_NE_JAMAIS_STOCKER',
    };
    const restant = { seanceId: 'seance-encore-en-attente', signatureBase64: 'AUTRE_SIGNATURE' };
    await ecrireFileChiffree(cle, 'compte-controleur', [pointage, restant]);
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

    // L'altération est éprouvée sur une copie : la file principale doit rester
    // déchiffrable après le rechargement de la page.
    const cleAlteree = 'file_test_alteree';
    const alteree = `${stockage.slice(0, -2)}AA`;
    localStorage.setItem(cleAlteree, alteree);
    let alterationRefusee = false;
    try { await lireFileChiffree(cleAlteree, 'compte-controleur', []); } catch { alterationRefusee = true; }

    return {
      prefixe: stockage.startsWith('upf1:'),
      signatureEnClairAbsente: !stockage.includes(pointage.signatureBase64),
      pinEnClairAbsent: !stockage.includes(pointage.codePinEnseignant),
      roundTrip: relu,
      autreCompteRefuse,
      cleNonExtractible: cleStockee?.extractable === false,
      migrationConserveDonnees: migree[0]?.seanceId === 'ancienne',
      migrationChiffree: stockageMigre.startsWith('upf1:') && !stockageMigre.includes('ancienne'),
      alterationRefusee,
      valeurAltereePreservee: localStorage.getItem('file_test_alteree') === alteree,
    };
  }, moduleBase64);

  // Chiffrement avant persistance : la file n'est jamais écrite en clair.
  assert.equal(controles.prefixe, true);
  assert.equal(controles.signatureEnClairAbsente, true);
  assert.equal(controles.pinEnClairAbsent, true);
  assert.deepEqual(controles.roundTrip, [
    {
      seanceId: 'seance-avec-signature',
      signatureBase64: 'SIGNATURE_MANUSCRITE_A_NE_PAS_LIRE',
      codePinEnseignant: 'PIN_A_NE_JAMAIS_STOCKER',
    },
    { seanceId: 'seance-encore-en-attente', signatureBase64: 'AUTRE_SIGNATURE' },
  ]);
  assert.equal(controles.autreCompteRefuse, true);
  assert.equal(controles.cleNonExtractible, true);
  assert.equal(controles.migrationConserveDonnees, true);
  assert.equal(controles.migrationChiffree, true);
  assert.equal(controles.alterationRefusee, true);
  assert.equal(controles.valeurAltereePreservee, true);

  // Décryptage après rechargement : la page est rechargée, le module réinstancié
  // et la clé relue dans IndexedDB ; la file se déchiffre à l'identique.
  await page.reload();
  const apresRechargement = await page.evaluate(async (encoded) => {
    const { ecrireFileChiffree, lireFileChiffree } = await import(`data:text/javascript;base64,${encoded}`);
    const cle = 'file_test_agent';
    const relu = await lireFileChiffree(cle, 'compte-controleur', []);
    // Retrait après synchronisation : le store réécrit la file sans le pointage
    // accepté par le serveur ; il ne doit rester que ceux en attente.
    await ecrireFileChiffree(cle, 'compte-controleur', [relu[1]]);
    const restant = await lireFileChiffree(cle, 'compte-controleur', []);
    const stockage = localStorage.getItem(cle);
    return { relu, restant, chiffree: stockage.startsWith('upf1:') };
  }, moduleBase64);

  assert.equal(apresRechargement.relu.length, 2);
  assert.equal(apresRechargement.relu[0].seanceId, 'seance-avec-signature');
  assert.deepEqual(apresRechargement.restant, [
    { seanceId: 'seance-encore-en-attente', signatureBase64: 'AUTRE_SIGNATURE' },
  ]);
  assert.equal(apresRechargement.chiffree, true);

  console.log(
    JSON.stringify({
      date: new Date().toISOString(),
      checks: [
        'chiffrement avant persistance',
        'PIN absent',
        'décryptage après rechargement',
        'retrait après synchronisation',
        'migration des anciennes files',
      ],
    }),
  );
} finally {
  await browser.close();
  await new Promise(resolve => serveur.close(resolve));
}
