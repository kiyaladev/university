/**
 * Recette navigateur : changement de langue fr/en, titre « University » et
 * mode hors ligne.
 *
 * Le mode hors ligne est vérifié sur la file des séances et sur les caches de
 * tournée préparée (affectations, salles) : tout doit être chiffré dans le
 * stockage local, et aucune donnée en clair ne doit y subsister.
 *
 *   node tests/navigateur-langue-hors-ligne.mjs [dossier du build] [dossier des preuves]
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
  exigerLocal,
  jetonPourRole,
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
const resultats = [];
const anomalies = [];

function noter(scenario, statut, detail, capture) {
  resultats.push({ scenario, statut, detail, ...(capture ? { capture } : {}) });
  if (statut === 'KO')
    anomalies.push({ scenario, attendu: 'le parcours aboutit sans erreur', obtenu: detail, capture });
}

const browser = await chromium.launch();

try {
  // ── changement de langue fr → en → fr ──────────────────────────────────
  {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const suivi = surveiller(page);
    await connecterAvecJeton(page, statique.url, await jetonPourRole(API, COMPTE.ADMIN));

    const langueInitiale = await page.evaluate(() => document.documentElement.lang);
    const libelleInitial = await page.locator('.q-drawer').innerText();
    if (!/Présences|Attendance/.test(libelleInitial)) {
      noter('langue — écran français', 'KO', `menu inattendu : ${libelleInitial.slice(0, 120)}`);
    } else {
      noter('langue — écran français', 'OK', `« ${langueInitiale} », menu en français`);
    }

    // Le sélecteur de langue vit dans le menu du compte.
    await page.locator('.q-header button:has(.q-avatar)').first().click();
    await page.locator('.q-menu').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.getByText('Changer de langue', { exact: false }).first().click();
    await page.waitForTimeout(500);
    await page.getByText('English', { exact: true }).first().click();
    await page.waitForTimeout(1200);

    const langueApres = await page.evaluate(() => document.documentElement.lang);
    const libelleApres = await page.locator('.q-drawer').innerText();
    const titreApres = await page.title();
    const erreurs = [
      ...suivi.consoleErreurs.map((texte) => `[console] ${texte}`),
      ...suivi.exceptions.map((texte) => `[exception] ${texte}`),
    ];
    const problemes = [...erreurs];
    if (langueApres !== 'en') problemes.push(`attendu : html lang « en » ; obtenu : « ${langueApres} »`);
    if (!/Attendance|Attendance tracking/.test(libelleApres)) problemes.push('le menu n’est pas passé en anglais');
    if (!titreApres.includes('University')) problemes.push(`titre « ${titreApres} »`);
    const capture = problemes.length ? await capturer(page, dossierPreuves, 'navigateur-langue-anglais') : undefined;
    noter(
      'langue — passage en anglais',
      problemes.length ? 'KO' : 'OK',
      problemes.join(' | ') || `« ${langueApres} », menu en anglais, titre « ${titreApres} »`,
      capture,
    );

    // La langue choisie survit au rechargement.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const langueRecharge = await page.evaluate(() => document.documentElement.lang);
    const stockee = await page.evaluate(() => localStorage.getItem('university_lang'));
    if (langueRecharge !== 'en' || stockee !== 'en-US') {
      noter(
        'langue — persistance après rechargement',
        'KO',
        `attendu : « en-US » conservé ; obtenu : html lang « ${langueRecharge} », stockage « ${stockee} »`,
      );
    } else {
      noter(
        'langue — persistance après rechargement',
        'OK',
        `html lang « ${langueRecharge} », stockage « ${stockee} »`,
      );
    }

    // Retour au français.
    await page.locator('.q-header button:has(.q-avatar)').first().click();
    await page.locator('.q-menu').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.getByText('Change language', { exact: false }).first().click();
    await page.waitForTimeout(500);
    await page.getByText('Français', { exact: true }).first().click();
    await page.waitForTimeout(1200);
    const langueFinale = await page.evaluate(() => document.documentElement.lang);
    if (langueFinale !== 'fr') {
      noter('langue — retour au français', 'KO', `attendu : « fr-FR » ; obtenu : « ${langueFinale} »`);
    } else {
      noter('langue — retour au français', 'OK', `html lang « ${langueFinale} »`);
    }
    await contexte.close();
  }

  // ── titres des écrans publics (avant connexion) ────────────────────────
  {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    const titres = [];
    for (const chemin of ['/connexion', '/bibliotheque', '/formations', '/verification']) {
      await page.goto(`${statique.url}/#${chemin}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      titres.push({ chemin, titre: await page.title() });
    }
    const sansMarque = titres.filter((entree) => !entree.titre.includes('University'));
    noter(
      'titre « University » — écrans publics',
      sansMarque.length ? 'KO' : 'OK',
      sansMarque.length
        ? sansMarque.map((entree) => `${entree.chemin} → « ${entree.titre} »`).join(' | ')
        : titres.map((entree) => `${entree.chemin} → « ${entree.titre} »`).join(' | '),
    );
    await contexte.close();
  }

  // ── mode hors ligne : file des séances chiffrée ────────────────────────
  {
    const contexte = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await contexte.newPage();
    page.setDefaultTimeout(30000);
    await connecterAvecJeton(page, statique.url, await jetonPourRole(API, COMPTE.CONTROLEUR));
    await page.evaluate(() => {
      window.location.hash = '/controle';
    });
    await page.waitForFunction(() => window.location.hash === '#/controle', null, { timeout: 20000 });
    await stabiliser(page);

    // Avant de couper le réseau, la coque doit être mise en cache et la page
    // contrôlée par le service worker : c'est ce qui permet de rouvrir
    // l'application dans un amphi sans couverture.
    const serviceWorker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { support: false };
      const debut = Date.now();
      const pret = await navigator.serviceWorker.ready.catch(() => null);
      if (!pret) return { support: true, pret: false, controleur: false, delai: Date.now() - debut };
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          const limite = Date.now() + 30000;
          const verifier = () => {
            if (navigator.serviceWorker.controller || Date.now() > limite) resolve();
            else setTimeout(verifier, 300);
          };
          verifier();
        });
      }
      return {
        support: true,
        pret: true,
        controleur: !!navigator.serviceWorker.controller,
        delai: Date.now() - debut,
      };
    });
    if (!serviceWorker.support) {
      noter('hors ligne — service worker', 'KO', 'le navigateur ne gère pas les service workers');
    } else if (!serviceWorker.controleur) {
      noter(
        'hors ligne — service worker',
        'KO',
        `attendu : la page contrôlée par le service worker ; obtenu : aucun contrôleur après ${serviceWorker.delai} ms`,
      );
    } else {
      noter(
        'hors ligne — service worker',
        'OK',
        `coque mise en cache et page contrôlée après ${serviceWorker.delai} ms`,
      );
    }

    // La page doit être rechargée en ligne une fois : le service worker ne
    // contrôle la page qu'après son activation, et c'est lui qui met la
    // lecture de /auth/me en cache — sans elle, la session ne survit pas à la
    // coupure réseau.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await contexte.setOffline(true);
    await page.waitForTimeout(500);

    // La file hors ligne passe par le magasin Pinia de l'application : on
    // l'alimente comme le ferait l'écran de pointage, coupure réseau oblige.
    const enFile = await page.evaluate(async () => {
      const store = document
        .querySelector('#q-app')
        ?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne');
      if (!store) return { erreur: 'magasin indisponible' };
      const affectation = {
        id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
        anneeId: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
        matiereId: 'cccccccc-3333-4333-8333-cccccccccccc',
        intitule: 'Recette navigateur',
      };
      const salle = {
        id: 'dddddddd-4444-4444-8444-dddddddddddd',
        code: 'REC-NAV',
        nom: 'Salle recette en clair',
      };
      // Les caches de tournée sont chiffrés : leur écriture est asynchrone,
      // il faut l'attendre avant de lire le stockage local.
      await store.enregistrerAffectations([affectation]);
      await store.enregistrerSalles([salle]);
      const resultat = await store.creer(
        {
          affectationId: affectation.id,
          date: '2026-10-24T00:00:00.000Z',
          heureDebut: '18:00',
          heureFin: '19:00',
          type: 'CM',
          salleId: salle.id,
          thematique: 'THEMATIQUE_EN_CLAIR_A_NE_PAS_LIRE',
        },
        affectation,
        salle,
      );
      return { enFile: resultat.enFile, identifiant: resultat.id, proprietaire: store.proprietaire };
    });

    if (enFile.erreur) {
      noter('hors ligne — mise en file d’une séance', 'KO', enFile.erreur);
    } else if (!enFile.enFile) {
      noter('hors ligne — mise en file d’une séance', 'KO', 'la séance n’a pas été mise en file hors ligne');
    } else {
      noter('hors ligne — mise en file d’une séance', 'OK', `séance en file (${enFile.identifiant})`);
    }

    // Le stockage local ne doit rien laisser en clair.
    const stockage = await page.evaluate(() => {
      const entrees = [];
      for (let index = 0; index < localStorage.length; index++) {
        const cle = localStorage.key(index);
        entrees.push({ cle, valeur: localStorage.getItem(cle) ?? '' });
      }
      return entrees;
    });
    const fichierSeances = stockage.find((entree) => entree.cle.startsWith('university_file_seances'));
    const problemes = [];
    if (!fichierSeances) problemes.push('la file des séances est absente du stockage local');
    else if (!fichierSeances.valeur.startsWith('upf1:')) {
      problemes.push(`la file des séances n’est pas chiffrée : « ${fichierSeances.valeur.slice(0, 60)}… »`);
    } else {
      for (const marqueur of ['THEMATIQUE_EN_CLAIR_A_NE_PAS_LIRE', '"idClient"', '"thematique"', '"affectationId"']) {
        if (fichierSeances.valeur.includes(marqueur)) {
          problemes.push(`la file chiffrée contient « ${marqueur} » en clair`);
        }
      }
    }
    const capture = problemes.length ? await capturer(page, dossierPreuves, 'navigateur-hors-ligne') : undefined;
    noter(
      'hors ligne — file des séances chiffrée',
      problemes.length ? 'KO' : 'OK',
      problemes.join(' | ') ||
        `clé « ${fichierSeances.cle} » chiffrée (${fichierSeances.valeur.length} caractères, préfixe « upf1: »)`,
      capture,
    );

    // Les caches de tournée (affectations, salles) sont chiffrés comme la
    // file : l'intitulé de l'affectation, le code et le nom de la salle ne
    // doivent pas rester lisibles sur l'appareil.
    const caches = stockage.filter(
      (entree) =>
        entree.cle.startsWith('university_affectations_tournee') || entree.cle.startsWith('university_salles_tournee'),
    );
    const problemesCaches = [];
    if (caches.length !== 2) {
      problemesCaches.push(`attendu : deux caches de tournée ; obtenu : ${caches.length}`);
    }
    for (const cache of caches) {
      if (!cache.valeur.startsWith('upf1:')) {
        problemesCaches.push(`le cache « ${cache.cle} » n’est pas chiffré : « ${cache.valeur.slice(0, 60)}… »`);
        continue;
      }
      for (const marqueur of [
        'Recette navigateur',
        'Salle recette en clair',
        'REC-NAV',
        '"intitule"',
        '"code"',
        '"nom"',
      ]) {
        if (cache.valeur.includes(marqueur)) {
          problemesCaches.push(`le cache « ${cache.cle} » contient « ${marqueur} » en clair`);
        }
      }
    }
    noter(
      'hors ligne — caches de tournée chiffrés',
      problemesCaches.length ? 'KO' : 'OK',
      problemesCaches.join(' | ') ||
        caches.map((cache) => `${cache.cle} chiffrée (${cache.valeur.length} caractères)`).join(' | '),
      problemesCaches.length ? await capturer(page, dossierPreuves, 'navigateur-hors-ligne-caches') : undefined,
    );

    // Aucun reste en clair dans le stockage local, toutes clés confondues.
    const marqueurs = [
      'THEMATIQUE_EN_CLAIR_A_NE_PAS_LIRE',
      'Recette navigateur',
      'Salle recette en clair',
      'REC-NAV',
      '"idClient"',
      '"thematique"',
      '"intitule"',
      '"enregistreesLe"',
    ];
    const enClair = [];
    for (const entree of stockage) {
      for (const marqueur of marqueurs) {
        if (entree.valeur.includes(marqueur)) enClair.push(`${entree.cle} → ${marqueur}`);
      }
    }
    noter(
      'hors ligne — aucune donnée en clair dans localStorage',
      enClair.length ? 'KO' : 'OK',
      enClair.length
        ? `données en clair : ${enClair.join(' | ')}`
        : `clés du stockage local : ${stockage.map((entree) => entree.cle).join(', ')}`,
      enClair.length ? await capturer(page, dossierPreuves, 'navigateur-hors-ligne-en-clair') : undefined,
    );

    // L'application redémarre hors ligne et restitue la file déchiffrée.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const restaure = await page.evaluate(() => {
      const store = document
        .querySelector('#q-app')
        ?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne');
      return {
        file: store?.file?.length ?? -1,
        thematique: store?.file?.[0]?.thematique ?? '',
        affectations: store?.affectationsCache?.length ?? -1,
        salles: store?.sallesCache?.length ?? -1,
        intitule: store?.affectationsCache?.[0]?.intitule ?? '',
        nomSalle: store?.sallesCache?.[0]?.nom ?? '',
        ecranVide: (document.body.innerText || '').trim().length,
      };
    });
    const cachesRestitues =
      restaure.affectations === 1 &&
      restaure.salles === 1 &&
      restaure.intitule.includes('Recette navigateur') &&
      restaure.nomSalle.includes('Salle recette en clair');
    if (restaure.file !== 1 || !restaure.thematique.includes('THEMATIQUE_EN_CLAIR') || !cachesRestitues) {
      const captureRestaure = await capturer(page, dossierPreuves, 'navigateur-hors-ligne-rechargement');
      noter(
        'hors ligne — rechargement et restitution de la file',
        'KO',
        `attendu : une séance en file et les caches de tournée après rechargement hors ligne ; obtenu : ${JSON.stringify(restaure)}`,
        captureRestaure,
      );
    } else {
      noter(
        'hors ligne — rechargement et restitution de la file',
        'OK',
        `une séance et les caches de tournée restitués après rechargement hors ligne, écran ${restaure.ecranVide} caractères`,
      );
    }
    await contexte.setOffline(false);
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
ecrireJson(path.join(dossierPreuves, 'navigateur-langue-hors-ligne.json'), rapport);
console.log(`scénarios : ${rapport.totaux.ok} OK, ${rapport.totaux.ko} KO`);
for (const anomalie of anomalies) console.log(` • ${anomalie.scenario} — ${anomalie.obtenu}`);
process.exit(rapport.totaux.ko ? 1 : 0);
