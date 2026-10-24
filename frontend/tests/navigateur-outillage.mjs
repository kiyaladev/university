/**
 * Outillage commun des scénarios de recette navigateur de la PWA compilée.
 *
 * Le front est servi en statique sur 127.0.0.1 (le service worker et le
 * routeur en mode « hash » exigent un vrai serveur HTTP), l'API de recette
 * répond sur 127.0.0.1:15041. Aucun scénario n'atteint une cible distante :
 * une recette navigateur écrit dans les données de la base QA.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/** Comptes de démonstration retenus pour la recette navigateur. */
export const ROLES = [
  { role: 'ADMIN', email: 'admin@unipresence.gn', motDePasse: 'Passer@2026' },
  { role: 'SCOLARITE', email: 'scolarite@unipresence.gn', motDePasse: 'Passer@2026' },
  { role: 'ENSEIGNANT', email: 'enseignant@unipresence.gn', motDePasse: 'Passer@2026' },
  { role: 'CONTROLEUR', email: 'controleur1@unipresence.gn', motDePasse: 'Passer@2026' },
  { role: 'ETUDIANT', email: 'etudiant1@university.gn', motDePasse: 'Etu#2026' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

/**
 * Sert un dossier compilé en statique, avec repli sur `index.html` pour les
 * navigations (le routeur fonctionne en mode « hash », le repli sert
 * néanmoins les ouvertures directes d'une adresse).
 */
export async function servirStatique(dossier) {
  const racine = path.resolve(dossier);
  if (!fs.existsSync(path.join(racine, 'index.html'))) {
    throw new Error(`Build PWA introuvable : ${racine}`);
  }
  const serveur = http.createServer((req, res) => {
    const demande = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const cible = path.resolve(racine, demande === '/' ? 'index.html' : `.${demande}`);
    if (!cible.startsWith(`${racine}${path.sep}`) && cible !== path.join(racine, 'index.html')) {
      res.writeHead(403).end();
      return;
    }
    const fichier =
      fs.existsSync(cible) && fs.statSync(cible).isFile()
        ? cible
        : req.headers.accept?.includes('text/html')
          ? path.join(racine, 'index.html')
          : null;
    if (!fichier) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(fichier)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(fichier).pipe(res);
  });
  // Le port est imposable : la liste CORS_ORIGINS de l'API de recette n'admet
  // que quelques origines (5029, 5082…), et un port libre enverrait le front
  // dans le hors-texte. `QA_FRONT_PORT` permet de choisir une origine admise.
  const port = Number(process.env.QA_FRONT_PORT || 0);
  await new Promise((resolve, reject) => {
    serveur.once('error', reject);
    serveur.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${serveur.address().port}`,
    fermer: () => new Promise((resolve) => serveur.close(resolve)),
  };
}

/** Refuse toute cible qui ne serait pas locale : la recette écrit dans les données. */
export function exigerLocal(url) {
  const hote = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hote)) throw new Error(`Cible locale obligatoire : ${url}`);
  return url;
}

/**
 * Relève les erreurs de console, les exceptions de page et les réponses HTTP
 * en erreur de l'API. `vider()` permet de ne retenir que ce qui suit l'écran
 * ouvert, pas ce qui précède.
 */
export function surveiller(page) {
  const consoleErreurs = [];
  const exceptions = [];
  const httpErreurs = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErreurs.push(message.text());
  });
  page.on('pageerror', (erreur) => exceptions.push(erreur.message));
  page.on('response', (reponse) => {
    if (reponse.status() >= 400 && reponse.url().includes('/api/')) {
      httpErreurs.push(`${reponse.status()} ${reponse.url()}`);
    }
  });
  return {
    consoleErreurs,
    exceptions,
    httpErreurs,
    vider() {
      consoleErreurs.length = 0;
      exceptions.length = 0;
      httpErreurs.length = 0;
    },
  };
}

/** Connexion par le formulaire de l'interface, comme le ferait l'utilisateur. */
export async function connecter(page, base, compte) {
  await page.goto(`${base}/#/connexion`, { waitUntil: 'domcontentloaded' });
  // L'application est une SPA : le formulaire n'existe qu'après le démarrage.
  await page.locator('input[type=email]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type=email]').fill(compte.email);
  await page.locator('input[type=password]').fill(compte.motDePasse);
  await page.locator('button[type=submit]').click();
  await page.waitForFunction(() => !location.hash.includes('/connexion'), null, { timeout: 30000 });
  await page.waitForTimeout(800);
}

/**
 * Jeton de session d'un rôle, mis en cache.
 *
 * L'API limite les connexions à dix tentatives par quart d'heure et par compte
 * (une faculté derrière un même NAT ne doit pas se bloquer). Une recette qui
 * se connecte à chaque écran épuise donc la limite : on récupère le jeton une
 * fois et on le réutilise, la connexion par le formulaire restant testée à part.
 */
export async function jetonPourRole(api, compte) {
  const fichier = process.env.QA_SESSION_FILE || '/tmp/mc/l7/navigateur-sessions.json';
  let sessions = {};
  try {
    sessions = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch {
    /* premier passage */
  }
  const moment = Date.now();
  const enCache = sessions[compte.role];
  if (enCache && enCache.jeton && enCache.expire > moment) return enCache.jeton;
  const reponse = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: compte.email, password: compte.motDePasse }),
  });
  if (!reponse.ok) throw new Error(`connexion ${compte.role} : HTTP ${reponse.status}`);
  const corps = await reponse.json();
  const charge = JSON.parse(Buffer.from(corps.token.split('.')[1], 'base64url').toString('utf8'));
  sessions[compte.role] = { jeton: corps.token, expire: charge.exp * 1000 };
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify(sessions), { mode: 0o600 });
  return corps.token;
}

/** Ouvre l'application avec un jeton déjà obtenu, sans repasser par le formulaire. */
export async function connecterAvecJeton(page, base, jeton) {
  await page.addInitScript((valeur) => {
    localStorage.setItem('university_token', valeur);
    // La langue déjà choisie par l'utilisateur est respectée : le scénario
    // de changement de langue doit pouvoir observer sa persistance.
    if (!localStorage.getItem('university_lang')) localStorage.setItem('university_lang', 'fr-FR');
  }, jeton);
  await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

/** Attend la fin des requêtes de l'écran courant, sans faire échouer le scénario. */
export async function stabiliser(page) {
  // L'application interroge l'API en continu : `networkidle` ne se produit
  // presque jamais. On attend plutôt la fin du chargement visible.
  await page
    .locator('.q-inner-loading:visible')
    .first()
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * État d'un écran : titre du document, texte visible et présence d'une erreur
 * bloquante. `titre` doit porter la marque « University ».
 */
export async function etatEcran(page) {
  const titre = await page.title();
  const texte = (
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
    .replace(/\s+/g, ' ')
    .trim();
  const chargement = await page
    .locator('.q-inner-loading, .q-spinner')
    .count()
    .catch(() => 0);
  return { titre, texte, chargement, vide: texte.length < 120 };
}

/** Capture d'écran vers le dossier des preuves du jour. */
export async function capturer(page, dossier, nom) {
  const cible = path.join(dossier, `${nom}.png`);
  await page.screenshot({ path: cible, fullPage: false }).catch(() => {});
  return cible;
}

/** Nom de fichier sans caractère gênant. */
export function nomFichier(valeur) {
  return String(valeur)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Écrit un rapport JSON de preuve. */
export function ecrireJson(cible, contenu) {
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, JSON.stringify(contenu, null, 2) + '\n');
  return cible;
}
