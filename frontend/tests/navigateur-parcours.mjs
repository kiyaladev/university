/**
 * Recette navigateur de la PWA compilée : le menu complet de chaque rôle de
 * démonstration.
 *
 * Pour chaque rôle : connexion par le formulaire, ouverture de **chaque**
 * entrée du menu, et relevé de ce qui s'y passe — erreur de console,
 * exception de page, réponse 4xx/5xx inattendue, écran vide, titre du
 * document. Le rapport produit un tableau écran × rôle.
 *
 *   node tests/navigateur-parcours.mjs [dossier du build] [dossier des preuves]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  ROLES,
  capturer,
  connecter,
  ecrireJson,
  etatEcran,
  exigerLocal,
  nomFichier,
  servirStatique,
  stabiliser,
  surveiller,
} from './navigateur-outillage.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dossierBuild = process.argv[2] || process.env.QA_BUILD_DIR || '/tmp/mc/l7/build-nav';
const date = new Date().toISOString().slice(0, 10);
const dossierPreuves = process.argv[3] || path.join(RACINE, 'docs', 'audits', 'preuves', date);
fs.mkdirSync(dossierPreuves, { recursive: true });

const statique = await servirStatique(dossierBuild);
exigerLocal(statique.url);

const browser = await chromium.launch();
const lignes = [];
const anomalies = [];

try {
  const rolesChoisis = process.env.QA_ROLES
    ? ROLES.filter((compte) => process.env.QA_ROLES.split(',').includes(compte.role))
    : ROLES;
  for (const compte of rolesChoisis) {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const suivi = surveiller(page);

    try {
      await connecter(page, statique.url, compte);
    } catch (erreur) {
      anomalies.push({
        type: 'connexion',
        role: compte.role,
        attendu: 'la page de connexion mène à l’écran d’accueil',
        obtenu: erreur.message,
      });
      await contexte.close();
      continue;
    }

    const drawer = page.locator('.q-drawer');
    await drawer.locator('.index__lien').first().waitFor({ timeout: 15000 });

    // Toutes les adresses du menu : raccourcis d'abord, puis les rubriques.
    const adresses = await drawer
      .locator('a.index__lien')
      .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
    const groupes = drawer.locator('.q-expansion-item');
    for (let index = 0; index < (await groupes.count()); index++) {
      const groupe = groupes.nth(index);
      const titre = (await groupe.locator('.q-expansion-item__container > .q-item').first().innerText()).trim();
      const hrefs = await groupe
        .locator('a.index__lien')
        .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      for (const href of hrefs) adresses.push(href);
      lignes.push({
        role: compte.role,
        ecran: `rubrique « ${titre} »`,
        libelle: titre,
        statut: 'INFO',
        titreDocument: '',
        erreurs: [],
      });
    }

    const vus = new Set();
    for (const href of adresses) {
      if (!href || vus.has(href)) continue;
      vus.add(href);
      const chemin = href.replace(/^#/, '');
      const avantHash = await page.evaluate(() => location.hash);
      suivi.vider();
      const lien = drawer.locator(`a.index__lien[href="${href}"]:visible`).first();
      try {
        if (!(await lien.count())) {
          const groupe = page
            .locator('.q-expansion-item')
            .filter({ has: page.locator(`a[href="${href}"]`) })
            .first();
          await groupe.locator('.q-expansion-item__container > .q-item').first().click();
          await page.waitForTimeout(400);
        }
        await drawer.locator(`a.index__lien[href="${href}"]:visible`).first().click();
        // Un lien de famille ouvre l'écran qui le regroupe : on attend le
        // changement d'adresse, pas une adresse précise.
        if (avantHash !== `#${chemin}`) {
          await page.waitForFunction((avant) => location.hash !== avant, avantHash, { timeout: 15000 });
        }
      } catch (erreur) {
        const ligne = {
          role: compte.role,
          ecran: chemin,
          libelle: chemin,
          statut: 'KO',
          titreDocument: '',
          erreurs: [`[navigation] ${erreur.message}`],
        };
        lignes.push(ligne);
        anomalies.push({
          type: 'navigation',
          role: compte.role,
          ecran: chemin,
          attendu: 'le lien du menu ouvre l’écran',
          obtenu: erreur.message,
        });
        continue;
      }

      await stabiliser(page);
      const etat = await etatEcran(page);
      const erreurs = [
        ...suivi.consoleErreurs.map((texte) => `[console] ${texte}`),
        ...suivi.exceptions.map((texte) => `[exception] ${texte}`),
        ...suivi.httpErreurs.map((texte) => `[http] ${texte}`),
      ];
      if (etat.vide) erreurs.push('[écran] texte visible insuffisant');
      if (!etat.titre.includes('University')) erreurs.push(`[titre] « ${etat.titre} »`);

      const ligne = {
        role: compte.role,
        ecran: chemin,
        libelle: (
          await drawer
            .locator(`a.index__lien[href="${href}"]`)
            .first()
            .innerText()
            .catch(() => chemin)
        )
          .replace(/\s+/g, ' ')
          .trim(),
        statut: erreurs.length ? 'KO' : 'OK',
        titreDocument: etat.titre,
        erreurs,
      };
      lignes.push(ligne);
      if (erreurs.length) {
        const capture = await capturer(page, dossierPreuves, `navigateur-${compte.role}-${nomFichier(chemin)}`);
        ligne.capture = capture;
        anomalies.push({
          type: 'ecran',
          role: compte.role,
          ecran: chemin,
          attendu: 'écran sans erreur console ni 4xx/5xx, titre « University »',
          obtenu: erreurs.join(' | '),
          capture,
        });
      }
    }
    await contexte.close();
  }
} finally {
  await browser.close();
  await statique.fermer();
}

const ecranParRole = new Map();
for (const ligne of lignes) {
  if (!ecranParRole.has(ligne.ecran)) ecranParRole.set(ligne.ecran, new Set());
  ecranParRole.get(ligne.ecran).add(ligne.role);
}

const rapport = {
  date: new Date().toISOString(),
  build: dossierBuild,
  front: statique.url,
  roles: lignes.map((ligne) => ligne.role),
  totaux: {
    ecrans: lignes.length,
    ok: lignes.filter((ligne) => ligne.statut === 'OK').length,
    ko: lignes.filter((ligne) => ligne.statut === 'KO').length,
  },
  lignes,
  anomalies,
};
ecrireJson(path.join(dossierPreuves, 'navigateur-parcours.json'), rapport);
console.log(`écrans : ${rapport.totaux.ok} OK, ${rapport.totaux.ko} KO`);
for (const anomalie of anomalies) console.log(` • [${anomalie.role}] ${anomalie.ecran} — ${anomalie.obtenu}`);
process.exit(rapport.totaux.ko ? 1 : 0);
