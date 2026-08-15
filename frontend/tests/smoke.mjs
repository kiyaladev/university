/**
 * Test de fumée : parcourt tous les écrans avec chaque rôle et vérifie qu'aucune
 * erreur JavaScript ni réponse HTTP en erreur ne survient. Effectue également un
 * pointage complet depuis l'interface.
 *
 *   API + front démarrés, puis :  node tests/smoke.mjs [url]
 */
import { chromium } from 'playwright';

const BASE = `${process.argv[2] ?? 'http://localhost:5029'}/#`;
const MOT_DE_PASSE = 'Passer@2026';
const erreurs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on('console', (m) => m.type() === 'error' && erreurs.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => erreurs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/api/')) {
    erreurs.push(`[http ${r.status()}] ${r.url()}`);
  }
});

async function connexion(email) {
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', MOT_DE_PASSE);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  console.log(`\n— ${email} → ${page.url().split('#')[1]}`);
}

async function visiter(chemin, nom) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const texte = await page.locator('body').innerText();
  const etat = texte.length > 200 ? 'OK' : 'ÉCRAN VIDE';
  if (etat !== 'OK') erreurs.push(`[vide] ${chemin}`);
  console.log(`  ${nom.padEnd(22)} ${etat}`);
}

// ------------------------------------------------------------- contrôleur
await connexion('controleur1@unipresence.gn');
await visiter('/controle', 'contrôle');

// Le champ d'action de la plaque : « Pointer » quand la séance reste à faire.
const boutons = page.locator('button.seance__action--vierge');
if (await boutons.count()) {
  await boutons.first().click();
  await page.waitForTimeout(800);
  // Scopé au champ de constat : « Retard » apparaît aussi sur les plaques déjà
  // pointées derrière le dialogue.
  await page.click('.constat--retard');
  await page.fill('label:has-text("Étudiants présents") input', '48');
  await page.fill('label:has-text("Matière / thème réellement déroulé") input', 'Séance de contrôle (test)');

  // L'enseignant doit attester sa présence : code personnel, sinon signature.
  await attester();

  await page.click('button:has-text("Valider le pointage")');
  await page.waitForTimeout(2000);
  console.log('  pointage complet          OK');
} else {
  console.log('  pointage complet          IGNORÉ (aucune séance à pointer aujourd’hui)');
}

async function attester() {
  const ongletCode = page.locator('.q-tab:has-text("Code")');
  if ((await ongletCode.count()) && !(await ongletCode.first().getAttribute('aria-disabled'))) {
    await ongletCode.first().click();
    await page.waitForTimeout(300);
    await page.fill('label:has-text("Code personnel") input', '2468');
    console.log('  attestation               code personnel');
    return;
  }

  // Repli : signature tracée sur l'écran, comme sur le registre papier.
  await page.locator('.q-tab:has-text("Signer")').first().click();
  await page.waitForTimeout(300);
  const zone = page.locator('canvas.signature-pad');
  const boite = await zone.boundingBox();
  await page.mouse.move(boite.x + 20, boite.y + boite.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(
      boite.x + 20 + i * (boite.width - 50) / 6,
      boite.y + boite.height / 2 + (i % 2 ? -18 : 18),
    );
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  console.log('  attestation               signature manuscrite');
}

await visiter('/', 'tableau de bord');
await visiter('/seances', 'séances');
await visiter('/salles', 'salles & QR');

// --------------------------------------------------------------- direction
await connexion('direction@unipresence.gn');
await visiter('/', 'tableau de bord');
await visiter('/rapports', 'rapports');
await visiter('/justificatifs', 'justificatifs');
await visiter('/emploi-du-temps', 'emploi du temps');

// ---------------------------------------------------------- administrateur
await connexion('admin@unipresence.gn');
for (const [chemin, nom] of [
  ['/utilisateurs', 'utilisateurs'],
  ['/parametres', 'paramètres'],
  ['/structure', 'structure'],
  ['/enseignants', 'enseignants'],
  ['/matieres', 'matières'],
  ['/affectations', 'affectations'],
]) {
  await visiter(chemin, nom);
}

// -------------------------------------------------------------- enseignant
await connexion('enseignant@unipresence.gn');
await visiter('/mes-seances', 'mes séances');

// Garde-fou de débit : la limite stricte ne vaut que pour la connexion.
// Déclarée globalement, elle bridait l'application entière à 10 requêtes par
// quart d'heure — le genre de régression qu'on ne voit qu'en production.
{
  const API = 'https://presence-api.naimba.com/api';
  const { token } = await (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'controleur1@unipresence.gn', password: MOT_DE_PASSE }),
    })
  ).json();

  const codes = [];
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${API}/seances?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    codes.push(r.status);
  }
  const bridees = codes.filter((c) => c === 429).length;
  console.log(`\n— débit : 20 requêtes courantes → ${bridees} refusée(s)`);
  if (bridees) erreurs.push(`[débit] ${bridees}/20 requêtes courantes refusées (429)`);
}

await browser.close();

const uniques = [...new Set(erreurs)];
console.log(`\n${uniques.length} erreur(s)`);
uniques.forEach((e) => console.log(' •', e));
process.exit(uniques.length ? 1 : 0);
