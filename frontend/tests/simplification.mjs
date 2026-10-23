/** Recette d'interface isolée : aucune base réelle, aucune écriture distante. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const build = path.resolve(process.argv[2] || '/tmp/university-ui-root-dist-20261013');
const evidence = path.resolve(process.argv[3] || '/tmp/university-ui-root-qa-20261013');
fs.mkdirSync(evidence, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = http.createServer((req, res) => {
  const file = path.resolve(build, '.' + new URL(req.url, 'http://localhost').pathname);
  if (file !== build && !file.startsWith(build + '/')) return res.writeHead(403).end();
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(build, 'index.html');
  res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
const empty = { data: [], total: 0, page: 1, pageSize: 20 };
const student = {
  id: 'student',
  nom: 'Diallo',
  prenom: 'Aminata',
  matricule: '2026-0001',
  actif: true,
  inscriptions: [],
  _count: { inscriptions: 0 },
};
const evaluation = {
  id: 'evaluation',
  intitule: 'Analyse',
  type: 'EXAMEN',
  statut: 'OUVERT',
  semestre: 1,
  coefficient: 1,
  date: '2026-10-13',
  matiere: { intitule: 'Mathématiques' },
  promotion: { id: 'promotion', nom: 'L1' },
  _count: { notes: 0 },
};
const today = new Date().toLocaleDateString('en-CA');
const work = {
  id: 'work',
  intitule: 'Projet de stage',
  type: 'STAGE',
  statut: 'PROPOSE',
  rapportRendu: false,
  etudiant: student,
};
const draw = {
  id: 'draw',
  stade: 'PROGRAMME',
  examenId: 'exam',
  examen: { id: 'exam', codeExamen: 'EX-1', intitule: 'Mathématiques' },
  dateTirage: today,
  nbExemplaires: 30,
  empreinteSource: 'a'.repeat(64),
};
const deliberation = {
  id: 'jury',
  statut: 'BROUILLON',
  session: 'NORMALE',
  promotionId: 'promotion',
  promotion: { nom: 'L1' },
  annee: { libelle: '2026-2027' },
  creeLe: today,
  tauxReussite: null,
  _count: { lignes: 0 },
  lignes: [],
};
const session = {
  id: 'session',
  date: today,
  heureDebut: '08:00',
  heureFin: '10:00',
  statut: 'PLANIFIE',
  type: 'COURS',
  salle: { id: 'room', code: 'A1' },
  affectation: {
    id: 'charge',
    enseignant: { id: 'teacher', nom: 'Camara', prenom: 'Moussa' },
    matiere: { intitule: 'Mathématiques' },
    promotion: { nom: 'L1', effectif: 30 },
  },
};
const serviceIds = [
  'presence',
  'scolarite',
  'finances',
  'documentsEtudiants',
  'reclamations',
  'reservations',
  'bibliotheque',
  'logements',
  'restauration',
  'stages',
  'helpdesk',
  'formations',
  'patrimoine',
  'courrier',
  'examens',
  'elections',
  'cartes',
  'badges',
  'vod',
  'notifications',
  'rectorat',
];

async function open(role, locale = 'fr-FR', width = 1440, disabled = [], record = session) {
  const context = await browser.newContext({ locale, serviceWorkers: 'block', viewport: { width, height: 950 } });
  const errors = [];
  const writes = [];
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const token = `e30.${Buffer.from(JSON.stringify({ sub: role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
  await context.addInitScript(
    ({ token, locale }) => {
      localStorage.setItem('university_token', token);
      localStorage.setItem('university_lang', locale);
      // Old preferences must no longer force desktop tables on a phone.
      localStorage.setItem('up:vue:etudiants', 'tableau');
    },
    { token, locale },
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace(/^\/api/, '');
    let data = empty;
    if (route.request().method() !== 'GET') {
      writes.push({ endpoint, body: route.request().postDataJSON() });
      data = { id: 'saved' };
    } else if (endpoint === '/auth/me')
      data = { id: role, role, nom: 'Test', prenom: 'Agent', actif: true, email: 'fixture@example.test' };
    else if (endpoint === '/services-actifs')
      data = serviceIds.map((id, i) => ({ id, actif: !disabled.includes(id), obligatoire: i < 4, pilote: i > 5 }));
    else if (endpoint === '/etudiants') data = { ...empty, data: [student], total: 1 };
    else if (endpoint === '/travaux-encadres') data = { ...empty, data: [work], total: 1 };
    else if (endpoint === '/tirage') data = { ...empty, data: [draw], total: 1 };
    else if (endpoint === '/deliberations') data = { ...empty, data: [deliberation], total: 1 };
    else if (endpoint === '/deliberations/jury') data = deliberation;
    else if (endpoint === '/evaluations') data = { ...empty, data: [evaluation], total: 1 };
    else if (endpoint === '/evaluations/evaluation') data = evaluation;
    else if (endpoint === '/notes/evaluation/evaluation') data = { evaluation, lignes: [], notes: [] };
    else if (endpoint === '/seances/journee') data = { seances: [record] };
    else if (endpoint === '/parametres/pointage') data = [{ cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'true' }];
    else if (endpoint === '/parametres') data = [{ cle: 'TOLERANCE_RETARD_MIN', valeur: '15' }];
    else if (endpoint === '/rapports/dashboard')
      data = {
        jour: { date: today, planifiees: 0, controlees: 0, tauxControle: 0 },
        global: {},
        evolution: [],
        repartition: [],
        departements: [],
        enseignantsAbsents: [],
      };
    else if (endpoint === '/rapports/salles' || endpoint === '/rapports/presence-enseignants') data = [];
    else if (endpoint.startsWith('/rapports/')) data = { lignes: [], totaux: {} };
    else if (endpoint === '/rectorat/chiffres') data = { effectifParPromotion: [], reussiteParPromotion: [] };
    else if (endpoint === '/patrimoine/dashboard') data = { parCategorie: [], alertes: [] };
    else if (endpoint === '/documents-demande/dashboard' || endpoint.endsWith('/stats')) data = {};
    else if (endpoint === '/soutenances') data = [];
    else if (endpoint === '/portail/me')
      data = {
        etudiant: student,
        inscription: { statut: 'VALIDE', promotion: { nom: 'L1' }, annee: { libelle: '2026-2027' } },
        frais: { montant: 100000, paye: 60000, solde: 40000, devise: 'GNF', taux: 60 },
        paiements: [
          {
            id: 'payment',
            reference: 'P1',
            mode: 'ESPECES',
            statut: 'REUSSI',
            horodatage: today,
            montant: 60000,
            devise: 'GNF',
          },
        ],
        attestations: [],
      };
    else if (endpoint === '/portail/resultats') data = { finale: null, lignes: [] };
    else if (endpoint === '/portail/resto/me') data = { solde: 0, recharges: [], consommations: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  let navigation = 0;
  async function goto(target) {
    await page.goto(`${base}/?qa=${navigation++}#${target}`, { waitUntil: 'networkidle' });
    const expected =
      target === '/suivi-presences'
        ? ['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'].includes(role)
          ? '/synthese-presences'
          : role === 'CONTROLEUR'
            ? '/statistiques'
            : '/rapports'
        : target === '/documents'
          ? role === 'DIRECTION'
            ? '/attestations'
            : '/demandes-docs'
          : target === '/mes-demarches'
            ? '/demandes-docs/mes'
            : target === '/'
              ? ({ SCOLARITE: '/scolarite', CONTROLEUR: '/controle', ENSEIGNANT: '/mes-seances', ETUDIANT: '/portail' }[
                  role
                ] ?? '/')
              : target;
    await page.waitForURL((url) => url.hash === '#' + expected);
    await page.waitForLoadState('networkidle');
    try {
      await page.locator('.q-page').waitFor({ timeout: 10000 });
    } catch (error) {
      console.error(
        JSON.stringify({ role, target, url: page.url(), errors, body: await page.locator('body').innerText() }),
      );
      throw error;
    }
    assert.equal(
      await page.locator('.bascule-vue,.liens-croises').count(),
      0,
      target + ' : renvois et choix de vue retirés',
    );
    assert.deepEqual(errors, [], target + ' : erreurs JS');
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      target + ' : débordement',
    );
  }
  return { context, page, errors, writes, goto };
}

try {
  if (!process.env.QA_ONLY_ATTENDANCE) {
    for (const role of [
      'ADMIN',
      'DIRECTION',
      'SCOLARITE',
      'CHEF_DEPARTEMENT',
      'CONTROLEUR',
      'ENSEIGNANT',
      'ETUDIANT',
    ]) {
      const test = await open(role);
      const { page, goto } = test;
      await goto('/');
      const drawer = page.locator('.q-drawer');
      const hrefs = await drawer.locator('a').evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      assert.equal(new Set(hrefs).size, hrefs.length, role + ' : liens uniques');
      for (const removed of ['/notes', '/bulletins', '/statistiques-mesrs', '/tirage', '/demandes-docs/tarifs'])
        assert.ok(!hrefs.includes('#' + removed), role + ' : entrée secondaire ' + removed);
      if (role === 'ADMIN' || role === 'DIRECTION' || role === 'CHEF_DEPARTEMENT')
        assert.ok((await page.locator('.q-page a').count()) <= 4, 'Accueil réduit');
      if (['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR'].includes(role)) {
        await goto('/suivi-presences');
        assert.equal(
          new URL(page.url()).hash,
          '#' +
            (['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'].includes(role)
              ? '/synthese-presences'
              : role === 'CONTROLEUR'
                ? '/statistiques'
                : '/rapports'),
        );
      }
      if (['ADMIN', 'SCOLARITE', 'DIRECTION'].includes(role)) {
        await goto('/documents');
        assert.equal(new URL(page.url()).hash, role === 'DIRECTION' ? '#/attestations' : '#/demandes-docs');
        await goto('/deliberations');
        await page.getByRole('button', { name: 'Bulletins', exact: true }).click();
        await page.waitForURL((url) => url.hash.startsWith('#/bulletins'));
      }
      if (role === 'ETUDIANT') {
        await goto('/mes-demarches');
        assert.equal(new URL(page.url()).hash, '#/demandes-docs/mes');
        await page.getByRole('tab', { name: 'Réclamations', exact: true }).click();
        await page.waitForURL((url) => url.hash === '#/reclamations/mes');
      }
      await page.setViewportSize({ width: 375, height: 950 });
      await goto('/');
      await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
      await drawer.locator('a.index__lien').first().click();
      await page.waitForTimeout(400);
      assert.ok(
        await drawer.evaluate((element) => element.classList.contains('q-layout--prevent-focus')),
        role + ' : menu mobile fermé',
      );
      results.push({ role, navigation: 'OK', mobileMenu: 'OK' });
      await test.context.close();
    }

    for (const locale of ['fr-FR', 'en-US']) {
      const test = await open('ADMIN', locale);
      const { page, goto } = test;
      const en = locale === 'en-US';
      await goto('/etudiants');
      assert.ok(await page.locator('.q-page .q-table').isVisible());
      await page
        .getByRole('button', { name: en ? 'Other actions' : 'Autres actions', exact: true })
        .first()
        .click();
      await page.locator('.q-menu .actions-secondaires').waitFor();
      assert.ok((await page.locator('.q-menu button').count()) >= 3, 'Actions conservées');
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 375, height: 950 });
      await page.locator('.etudiants-cartes').waitFor();
      assert.equal(await page.locator('.q-page .q-table').count(), 0, 'Adaptation mobile sans choix');
      await page.screenshot({ path: path.join(evidence, `etudiants-${locale}-375.png`), fullPage: true });
      await goto('/evaluations');
      await page
        .getByRole('button', { name: en ? /Enter grades|Enter marks/ : /Saisir les notes/ })
        .first()
        .click();
      await page.waitForURL((url) => url.hash.startsWith('#/notes'));
      await page.getByText('Analyse', { exact: true }).waitFor();
      assert.equal(await page.locator('.notes-page .q-field').count(), 0, 'Pas de resélection de l’évaluation');
      await goto('/parametres');
      await page.getByRole('heading', { name: en ? 'Attendance rules' : 'Règles de présence', exact: true }).waitFor();
      assert.equal(
        await page.locator('.q-header > .q-toolbar > button[aria-label]').count(),
        2,
        'Préférences dans le compte',
      );
      await page.getByRole('button', { name: en ? 'My account' : 'Mon compte', exact: true }).click();
      await page.getByRole('button', { name: en ? 'Change language' : 'Changer de langue', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert.deepEqual(test.errors, []);
      results.push({ locale, adaptiveList: 'OK', secondaryActions: 'OK', assessmentContext: 'OK', preferences: 'OK' });
      await test.context.close();
    }

    const portal = await open('ETUDIANT', 'fr-FR', 375);
    await portal.goto('/portail');
    assert.ok((await portal.page.getByText('40 000', { exact: false }).count()) >= 1, 'Solde visible');
    assert.equal(await portal.page.getByText('P1', { exact: false }).isVisible(), false, 'Historique replié');
    await portal.page.getByText('Historique des paiements', { exact: true }).click();
    await portal.page.getByText('P1', { exact: false }).waitFor();
    await portal.page.screenshot({ path: path.join(evidence, 'portail-375.png'), fullPage: true });
    results.push({ portal: 'OK', history: 'OK' });
    await portal.context.close();
  }

  const attendance = await open('CONTROLEUR', 'fr-FR', 375);
  await attendance.goto('/controle');
  await attendance.page.locator('button.seance__action').first().click();
  const dialog = attendance.page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Présent', exact: true }).waitFor();
  await attendance.page.waitForLoadState('networkidle');
  await attendance.page.screenshot({ path: path.join(evidence, 'pointage-avant-signature-375.png'), fullPage: true });
  assert.equal(await dialog.locator('.constats button').count(), 5, 'Tous les constats métier restent accessibles');
  assert.equal(
    await dialog.getByRole('textbox', { name: 'Observations', exact: true }).count(),
    0,
    'Observation repliée',
  );
  const save = dialog.getByRole('button', { name: 'Valider le pointage', exact: true });
  assert.ok(await save.isDisabled(), 'Attestation toujours obligatoire');
  const canvas = dialog.locator('canvas');
  await dialog.getByRole('spinbutton').fill('20');
  await canvas.scrollIntoViewIfNeeded();
  await canvas.hover({ position: { x: 20, y: 20 } });
  const bounds = await canvas.boundingBox();
  await attendance.page.mouse.move(bounds.x + 20, bounds.y + 20);
  await attendance.page.mouse.down();
  await attendance.page.mouse.move(bounds.x + 80, bounds.y + 50, { steps: 6 });
  await attendance.page.mouse.up();
  await attendance.page.screenshot({ path: path.join(evidence, 'pointage-signature-375.png'), fullPage: true });
  await save.click();
  await attendance.page.waitForLoadState('networkidle');
  const recorded = attendance.writes.find((write) => write.endpoint === '/controles');
  assert.ok(recorded, 'Pointage envoyé');
  assert.equal(
    recorded.body.statut,
    'PRESENT',
    'Constat explicite conservé : simplification de l’interface uniquement',
  );
  assert.ok(recorded.body.signatureBase64, 'Preuve conservée');
  await attendance.page.locator('button.seance__action').first().click();
  await dialog.getByRole('button', { name: 'Absent', exact: true }).click();
  await dialog.getByRole('button', { name: 'Valider le pointage', exact: true }).click();
  await attendance.page.waitForLoadState('networkidle');
  assert.equal(
    attendance.writes.filter((write) => write.endpoint === '/controles').at(-1).body.statut,
    'ABSENT',
    'Absence explicite conservée',
  );
  assert.deepEqual(attendance.errors, []);
  results.push({ attendance: 'OK', findingPreserved: 'OK', requiredProof: 'OK' });
  await attendance.context.close();

  const correction = await open('CONTROLEUR', 'fr-FR', 375, [], {
    ...session,
    controle: {
      statut: 'RETARD',
      heureArrivee: '08:20',
      heureFinReelle: '10:00',
      effectifPresent: 20,
      signatureBase64: 'ANCIENNE_SIGNATURE',
      attestation: 'SIGNATURE',
      dureeMinutes: 100,
    },
  });
  await correction.goto('/controle');
  await correction.page.locator('button.seance__action').first().click();
  const corrected = correction.page.getByRole('dialog');
  const correctionSave = corrected.getByRole('button', { name: 'Corriger le pointage', exact: true });
  await correction.page.waitForLoadState('networkidle');
  assert.ok(await correctionSave.isDisabled(), 'L’ancienne preuve ne suffit pas à corriger');
  await corrected.locator('canvas').scrollIntoViewIfNeeded();
  await corrected.locator('canvas').hover({ position: { x: 20, y: 20 } });
  const correctionBounds = await corrected.locator('canvas').boundingBox();
  await correction.page.mouse.move(correctionBounds.x + 20, correctionBounds.y + 20);
  await correction.page.mouse.down();
  await correction.page.mouse.move(correctionBounds.x + 80, correctionBounds.y + 50, { steps: 6 });
  await correction.page.mouse.up();
  await correctionSave.click();
  await correction.page.waitForLoadState('networkidle');
  assert.equal(
    correction.writes.find((write) => write.endpoint === '/controles').body.statut,
    'RETARD',
    'Constat existant préservé à la correction',
  );
  assert.deepEqual(correction.errors, []);
  await correction.context.close();
  results.push({ correction: 'OK', renewedProof: 'OK', previousStatus: 'OK' });

  const disabled = await open('ADMIN', 'fr-FR', 1440, ['rectorat', 'cartes', 'examens']);
  await disabled.goto('/');
  const disabledHrefs = await disabled.page
    .locator('.q-drawer a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  for (const target of ['#/bilan', '#/examens', '#/examens/scan'])
    assert.ok(!disabledHrefs.includes(target), 'Service fermé absent du menu');
  await disabled.goto('/documents');
  assert.equal(
    await disabled.page.getByRole('tab', { name: 'Cartes étudiantes', exact: true }).count(),
    0,
    'Section du service fermé masquée',
  );
  await disabled.context.close();
  results.push({ disabledServices: 'OK' });

  for (const width of [375, 768, 1440]) {
    const dossiers = await open('ADMIN', 'fr-FR', width);
    await dossiers.goto('/stages');
    await dossiers.page.getByRole('button', { name: 'Valider', exact: true }).waitFor();
    await dossiers.page.getByRole('button', { name: 'Autres actions', exact: true }).first().click();
    const abandon = dossiers.page.locator('.q-menu').getByRole('button', { name: 'Abandonner', exact: true });
    await abandon.click();
    await dossiers.page.getByRole('dialog').waitFor();
    assert.equal(dossiers.writes.length, 0, 'Une transition conserve sa confirmation');
    await dossiers.goto('/tirage');
    await dossiers.page.getByRole('button', { name: 'Autres actions', exact: true }).first().click();
    await dossiers.page.locator('.q-menu').getByRole('button', { name: 'Annuler le tirage', exact: true }).click();
    await dossiers.page.getByRole('dialog').waitFor();
    assert.equal(dossiers.writes.length, 0, 'Annulation non exécutée sans confirmation');
    await dossiers.goto('/deliberations');
    await dossiers.page.getByRole('button', { name: 'Voir le détail de la délibération', exact: true }).first().click();
    await dossiers.page
      .getByRole('dialog')
      .getByText('Aucune ligne : lancez le recalcul pour produire les moyennes et les décisions.', { exact: true })
      .waitFor();
    assert.deepEqual(dossiers.errors, [], 'Actions et cartes sans erreurs');
    results.push({ width, stageTransitions: 'OK', printActions: 'OK', deliberationDetails: 'OK' });
    await dossiers.context.close();
  }
  fs.writeFileSync(
    path.join(evidence, 'results.json'),
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
