/**
 * Recette navigateur : les parcours métier désignés par la mission.
 *
 *   - création d'un examen (bug corrigé récemment) ;
 *   - grille des frais ;
 *   - moyens de preuve ;
 *   - correction d'un pointage ;
 *   - pages découpées récemment (Séances, Cités, Patrimoine, Paiements,
 *     Stages, Inscriptions, Resto) : chaque onglet s'ouvre et affiche son
 *     contenu.
 *
 *   node tests/navigateur-fonctionnalites.mjs [dossier du build] [dossier des preuves]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  ROLES,
  capturer,
  connecterAvecJeton,
  ecrireJson,
  etatEcran,
  exigerLocal,
  jetonPourRole,
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

const API = process.env.API_URL || 'http://127.0.0.1:15041/api';
const statique = await servirStatique(dossierBuild);
exigerLocal(statique.url);

const COMPTE = Object.fromEntries(ROLES.map((role) => [role.role, role]));

/** Pages découpées : onglets attendus d'après le découpage des composants. */
const PAGES_ONGLETS = [
  { role: 'ADMIN', chemin: '/cites', onglets: ['Résidences', 'Chambres', 'Attributions'] },
  { role: 'ADMIN', chemin: '/patrimoine', onglets: ['Équipements', 'Catégories', 'Réparations'] },
  { role: 'ADMIN', chemin: '/resto', onglets: ['Guichet', 'Portefeuilles', 'Transactions'] },
  { role: 'ADMIN', chemin: '/stages', onglets: ['Travaux', 'Soutenances'] },
];

/** Pages découpées qui n'ont pas d'onglets mais plusieurs blocs. */
const PAGES_SANS_ONGLET = [
  { role: 'ADMIN', chemin: '/seances' },
  { role: 'ADMIN', chemin: '/paiements' },
  { role: 'ADMIN', chemin: '/inscriptions' },
];

const anomalies = [];
const resultats = [];

function noter(scenario, statut, detail, capture) {
  resultats.push({ scenario, statut, detail, ...(capture ? { capture } : {}) });
  if (statut === 'KO')
    anomalies.push({ scenario, attendu: 'le parcours aboutit sans erreur', obtenu: detail, capture });
}

const browser = await chromium.launch();

/** Ouvre un écran et relève ce qui s'y passe. */
async function ouvrir(page, chemin, suivi) {
  suivi.vider();
  // Le routeur fonctionne en mode « hash » : on change l'adresse depuis la
  // page, sinon le navigateur ne fait qu'un aller-retour sans-router.
  await page.evaluate((cible) => {
    window.location.hash = cible;
  }, chemin);
  await page.waitForFunction((cible) => window.location.hash === `#${cible}`, chemin, { timeout: 20000 });
  await page.waitForTimeout(600);
  await stabiliser(page);
  const etat = await etatEcran(page);
  const erreurs = [
    ...suivi.consoleErreurs.map((texte) => `[console] ${texte}`),
    ...suivi.exceptions.map((texte) => `[exception] ${texte}`),
    ...suivi.httpErreurs.map((texte) => `[http] ${texte}`),
  ];
  return { etat, erreurs };
}

try {
  // ── création d'un examen (scolarité) ───────────────────────────────────
  {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const suivi = surveiller(page);
    await connecterAvecJeton(page, statique.url, await jetonPourRole(API, COMPTE.SCOLARITE));
    const { etat, erreurs } = await ouvrir(page, '/examens', suivi);
    if (etat.vide || erreurs.length) {
      const capture = await capturer(page, dossierPreuves, 'navigateur-creer-examen-ecran');
      noter(
        'création d’examen — écran /examens',
        'KO',
        [...erreurs, etat.vide ? 'écran vide' : ''].join(' | '),
        capture,
      );
    } else {
      noter('création d’examen — écran /examens', 'OK', `titre « ${etat.titre} »`);
    }

    // Le formulaire de planification : on le remplit puis on l'enregistre.
    const intitule = `Examen recette navigateur ${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
    const code = `RECNAV${Date.now().toString().slice(-6)}`;
    try {
      await page.getByRole('button', { name: 'Planifier un examen' }).first().click();
      await page.locator('.q-dialog').waitFor({ state: 'visible', timeout: 15000 });

      // Les champs de recherche (matière, promotion, année) sont des sélecteurs
      // distants : on garde la première suggestion proposée par l'API.
      const champ = (libelle) =>
        page
          .locator('.q-dialog .q-field')
          .filter({ has: page.locator('.q-field__label', { hasText: libelle }) })
          .first();
      const choisir = async (libelle, saisie) => {
        const cible = champ(libelle);
        await cible.locator('input').click();
        if (saisie) await cible.locator('input').fill(saisie);
        await page.waitForTimeout(1200);
        const option = page.locator('.q-menu:visible .q-item').first();
        if (!(await option.count())) throw new Error(`aucune option pour « ${libelle} »`);
        await option.click();
        await page.waitForTimeout(500);
      };

      await champ('Intitulé').locator('input').fill(intitule);
      await champ('Code').locator('input').fill(code);
      await choisir('Matière', 'a');
      await choisir('Promotion', 'a');
      await choisir('Année académique', 'a');
      // La date se saisit au calendrier : le champ est en lecture seule. Le
      // calendrier ne s'ouvre qu'au clic sur l'icône (constat de recette).
      await champ("Date de l'examen").locator('.q-icon').first().click();
      await page.locator('.q-date:visible .q-date__today').first().click();
      await page.waitForTimeout(500);

      await page.getByRole('button', { name: 'Enregistrer' }).first().click();
      await page.waitForTimeout(3000);
      const notification = await page
        .locator('.q-notification')
        .first()
        .innerText()
        .catch(() => '');
      const cree = await page.locator(`text=${intitule}`).count();
      if (cree > 0) {
        noter(
          'création d’un examen',
          'OK',
          `examen « ${intitule} » (code ${code}) présent dans la liste — notification : ${notification.trim() || 'aucune'}`,
        );
      } else {
        const capture = await capturer(page, dossierPreuves, 'navigateur-creer-examen-echec');
        noter(
          'création d’un examen',
          'KO',
          `attendu : l’examen « ${intitule} » apparaît ; obtenu : ${notification || 'aucune notification'}`,
          capture,
        );
      }
    } catch (erreur) {
      const capture = await capturer(page, dossierPreuves, 'navigateur-creer-examen-exception');
      noter('création d’un examen', 'KO', erreur.message, capture);
    }
    await contexte.close();
  }

  // ── grille des frais, moyens de preuve, correction de pointage ──────────
  for (const scenario of [
    { role: 'SCOLARITE', chemin: '/frais', nom: 'grille des frais' },
    { role: 'ADMIN', chemin: '/moyens-attestation', nom: 'moyens de preuve' },
    { role: 'ADMIN', chemin: '/corrections-pointages', nom: 'correction de pointage' },
  ]) {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const suivi = surveiller(page);
    await connecterAvecJeton(page, statique.url, await jetonPourRole(API, COMPTE[scenario.role]));
    const { etat, erreurs } = await ouvrir(page, scenario.chemin, suivi);
    const problemes = [...erreurs];
    if (etat.vide) problemes.push('écran vide');
    if (!etat.titre.includes('University')) problemes.push(`titre « ${etat.titre} »`);
    const capture = problemes.length
      ? await capturer(page, dossierPreuves, `navigateur-${nomFichier(scenario.nom)}`)
      : undefined;
    noter(scenario.nom, problemes.length ? 'KO' : 'OK', problemes.join(' | ') || `titre « ${etat.titre} »`, capture);
    await contexte.close();
  }

  // ── pages découpées sans onglets : le contenu principal s'affiche ──────
  for (const pageDecoupee of PAGES_SANS_ONGLET) {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const suivi = surveiller(page);
    await connecterAvecJeton(page, statique.url, await jetonPourRole(API, COMPTE[pageDecoupee.role]));
    const { etat, erreurs } = await ouvrir(page, pageDecoupee.chemin, suivi);
    const problemes = [...erreurs];
    if (etat.vide) problemes.push('écran vide');
    const blocs = await page.locator('.q-table, table, .resume-liste, .q-card').count();
    if (!blocs) problemes.push('aucun bloc de contenu (tableau, résumé ou carte)');
    const capture = problemes.length
      ? await capturer(page, dossierPreuves, `navigateur-${nomFichier(pageDecoupee.chemin)}`)
      : undefined;
    noter(
      `pages découpées — ${pageDecoupee.chemin}`,
      problemes.length ? 'KO' : 'OK',
      problemes.join(' | ') || `titre « ${etat.titre} », ${blocs} bloc(s) de contenu`,
      capture,
    );
    await contexte.close();
  }

  // ── pages découpées : chaque onglet s'ouvre et affiche son contenu ─────
  for (const pageDecoupee of PAGES_ONGLETS) {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const suivi = surveiller(page);
    await connecterAvecJeton(page, statique.url, await jetonPourRole(API, COMPTE[pageDecoupee.role]));
    const { etat, erreurs } = await ouvrir(page, pageDecoupee.chemin, suivi);
    const problemes = [...erreurs];
    if (etat.vide) problemes.push('écran vide');
    const onglets = page.locator('.q-tab');
    const nombreOnglets = await onglets.count();
    const libellesOnglets = (await onglets.allInnerTexts().catch(() => [])).map((texte) => texte.trim());
    for (const attendu of pageDecoupee.onglets) {
      if (!libellesOnglets.some((libelle) => libelle.includes(attendu))) {
        problemes.push(`onglet « ${attendu} » absent (onglets : ${libellesOnglets.join(', ') || 'aucun'})`);
      }
    }
    for (let index = 0; index < nombreOnglets; index++) {
      const onglet = onglets.nth(index);
      const libelle = (await onglet.innerText().catch(() => '')).trim();
      suivi.vider();
      await onglet.click();
      await page.waitForTimeout(900);
      await stabiliser(page);
      const texte = (
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      )
        .replace(/\s+/g, ' ')
        .trim();
      if (texte.length < 120) problemes.push(`onglet « ${libelle} » : contenu insuffisant`);
      problemes.push(
        ...suivi.consoleErreurs.map((texte) => `[console ${libelle}] ${texte}`),
        ...suivi.exceptions.map((texte) => `[exception ${libelle}] ${texte}`),
        ...suivi.httpErreurs.map((texte) => `[http ${libelle}] ${texte}`),
      );
    }
    const capture = problemes.length
      ? await capturer(page, dossierPreuves, `navigateur-${nomFichier(pageDecoupee.chemin)}`)
      : undefined;
    noter(
      `pages découpées — ${pageDecoupee.chemin} (${nombreOnglets} onglet(s))`,
      problemes.length ? 'KO' : 'OK',
      problemes.join(' | ') || `titre « ${etat.titre} », onglets ouverts sans erreur`,
      capture,
    );
    await contexte.close();
  }
} finally {
  await browser.close();
  await statique.fermer();
}

const rapport = {
  date: new Date().toISOString(),
  build: dossierBuild,
  front: statique.url,
  totaux: {
    scenarios: resultats.length,
    ok: resultats.filter((resultat) => resultat.statut === 'OK').length,
    ko: resultats.filter((resultat) => resultat.statut === 'KO').length,
  },
  resultats,
  anomalies,
};
ecrireJson(path.join(dossierPreuves, 'navigateur-fonctionnalites.json'), rapport);
console.log(`scénarios : ${rapport.totaux.ok} OK, ${rapport.totaux.ko} KO`);
for (const anomalie of anomalies) console.log(` • ${anomalie.scenario} — ${anomalie.obtenu}`);
process.exit(rapport.totaux.ko ? 1 : 0);
