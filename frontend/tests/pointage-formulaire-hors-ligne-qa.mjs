/** Écriture réelle, exclusivement sur l'installation QA fictive locale. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { ecrirePreuve } from './preuves.mjs';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcryptjs');
if (!process.env.QA_ENV_FILE) throw Error('QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const base = process.argv[2] || 'http://127.0.0.1:15042';
assert.equal(base, 'http://127.0.0.1:15042');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const tag = 'QA-OFFLINE-' + randomUUID();
let year, department, filiere, promotion, teacher, subject, assignment, room, controller;
const report = { date: new Date().toISOString(), statut: 'en_cours', api, simulatedApi: false };
const browser = await chromium.launch();
try {
  year = await prisma.anneeAcademique.create({
    data: { libelle: tag, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
  });
  department = await prisma.departement.create({ data: { code: tag, nom: tag } });
  filiere = await prisma.filiere.create({ data: { code: tag, nom: tag, departementId: department.id } });
  promotion = await prisma.promotion.create({
    data: { nom: tag, niveau: 'L1', filiereId: filiere.id, anneeId: year.id },
  });
  teacher = await prisma.enseignant.create({
    data: { matricule: tag, nom: 'Recette', prenom: 'Planning', departementId: department.id },
  });
  subject = await prisma.matiere.create({ data: { code: tag, intitule: 'Planning QA', departementId: department.id } });
  assignment = await prisma.affectation.create({
    data: { enseignantId: teacher.id, matiereId: subject.id, promotionId: promotion.id, anneeId: year.id },
  });
  room = await prisma.salle.create({ data: { code: tag, nom: 'Salle QA', qrToken: randomUUID() } });

  const password = randomUUID();
  controller = await prisma.user.create({
    data: {
      email: 'qa-offline-' + randomUUID() + '@example.invalid',
      password: await bcrypt.hash(password, 10),
      nom: 'Recette',
      prenom: 'Contrôleur',
      role: 'CONTROLEUR',
      departementId: department.id,
    },
  });
  Object.assign(process.env, env);
  const { AuthService } = require('../../backend/dist/modules/auth/auth.service');
  const { JwtService } = require('../../backend/node_modules/@nestjs/jwt');
  const { optionsJwt } = require('../../backend/dist/common/jwt-config.module');
  const auth = new AuthService(prisma, new JwtService(optionsJwt({ get: (k) => env[k] })));
  const token = (await auth.login({ email: controller.email, password }, 'QA-FIXTURE')).token;
  const me = await (await fetch(api + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(me.id, controller.id);
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  await context.addInitScript((token) => {
    localStorage.setItem('university_token', token);
    localStorage.setItem('university_lang', 'fr-FR');
  }, token);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const erreurs = [],
    appelsSync = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('request', (r) => {
    if (r.url() === api + '/seances/sync' && r.method() === 'POST') appelsSync.push(r.postDataJSON());
  });
  await page.goto(`${base}/#/controle`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne'),
    null,
    { timeout: 60000 },
  );
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne'),
    null,
    { timeout: 60000 },
  );
  await page.goto(`${base}/#/controle`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Préparer hors ligne', exact: true }).click();
  await page.waitForFunction((id) => Boolean(localStorage.getItem('university_tournee_preparee_' + id)), controller.id);
  const cache = await page.evaluate(() => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    return { affectations: store.affectationsCache.map((a) => a.id), salles: store.sallesCache.map((s) => s.id) };
  });
  assert.ok(cache.affectations.includes(assignment.id));
  assert.ok(cache.salles.includes(room.id));
  report.actualPrepareButtonVerified = true;
  await page.goto(`${base}/#/controle`, { waitUntil: 'networkidle' });
  await context.setOffline(true);

  const affectation = { id: assignment.id, anneeId: year.id, matiereId: subject.id };
  const salle = { id: room.id, code: room.code, nom: room.nom };
  await page.locator('button[aria-label="Ouvrir une séance non programmée"]').click();
  const dialog = page.locator('.q-dialog').last();
  const select = dialog.locator('.q-select').first();
  await select.locator('input').fill('Recette');
  await page.locator('.q-menu .q-item').filter({ hasText: 'Recette' }).first().click();
  await dialog.getByLabel('Heure de début', { exact: true }).fill('18:00');
  await dialog.getByLabel('Heure de fin', { exact: true }).fill('19:00');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne').file
        .length === 1,
  );
  const queued = await page.evaluate((userId) => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    return {
      result: { id: store.file[0].idClient, enFile: true },
      file: store.file,
      affectations: store.affectationsCache,
      salles: store.sallesCache,
      visible: store.pourDate('2026-10-06'),
      storage: localStorage.getItem('university_file_seances_' + userId),
    };
  }, controller.id);
  report.actualOfflineFormVerified = true;
  assert.equal(queued.result.enFile, true, 'la séance doit être mise en file hors ligne');
  assert.match(queued.result.id, /^[0-9a-f-]{36}$/i, 'la file reçoit un UUID client stable');
  assert.equal(queued.file.length, 1);
  assert.equal(queued.affectations.length, 1);
  assert.ok(queued.salles.length >= 1);
  assert.equal(queued.visible[0].id, queued.result.id, 'la tournée affiche la séance locale par sa clé cliente');
  assert.equal(JSON.parse(queued.storage)[0].idClient, queued.result.id);
  assert.equal(appelsSync.length, 0, 'aucune demande de synchronisation ne part pendant la coupure réseau');

  const pointageDialog = page.locator('.q-dialog').last();
  await pointageDialog.getByRole('textbox', { name: 'Arrivée constatée', exact: true }).fill('18:00');
  await pointageDialog.getByRole('textbox', { name: 'Fin de séance', exact: true }).fill('19:00');
  await pointageDialog.getByLabel('Étudiants présents', { exact: true }).fill('12');
  await pointageDialog.getByLabel('Observations', { exact: true }).fill('Observation confidentielle QA');
  await pointageDialog.getByRole('tab', { name: 'Signer', exact: true }).click();
  const canvas = pointageDialog.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box);
  const save = pointageDialog.getByRole('button', { name: 'Valider le pointage', exact: true });
  assert.equal(await save.isDisabled(), true);
  await page.mouse.move(box.x + 20, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 65, { steps: 8 });
  await page.mouse.up();
  assert.equal(await save.isDisabled(), false);
  await save.click();
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file.length === 1,
  );
  const encryption = await page.evaluate((owner) => {
    const store = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages');
    return {
      raw: localStorage.getItem('university_file_pointages_' + owner),
      count: store.file.length,
      pin: store.file[0].codePinEnseignant,
    };
  }, controller.id);
  report.actualPointageFormAndCanvasVerified = true;
  assert.equal(encryption.count, 1);
  assert.equal(encryption.pin, undefined);
  assert.ok(
    encryption.raw && !encryption.raw.includes('Observation confidentielle QA') && !encryption.raw.includes('1234'),
  );
  report.encryptedPointageVerified = true;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne')?.file
        ?.length === 1,
    null,
    { timeout: 60000 },
  );
  const restored = await page.evaluate(() => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    return {
      id: store.file[0].idClient,
      affectations: store.affectationsCache.length,
      salles: store.sallesCache.length,
    };
  });
  assert.equal(restored.id, queued.result.id);
  assert.equal(restored.affectations, cache.affectations.length);
  assert.equal(restored.salles, cache.salles.length);

  await page.waitForFunction(
    () =>
      document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file.length === 1,
  );
  await context.setOffline(false);
  await page.evaluate(async () => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    await store.synchroniser();
  });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('seancesHorsLigne')?.file
        ?.length === 0,
    null,
    { timeout: 60000 },
  );
  assert.equal(appelsSync.length, 1, 'une seule synchronisation est envoyée');
  const envoyee = appelsSync[0].seances[0];
  assert.equal(envoyee.idClient, queued.result.id);
  assert.equal(envoyee.affectation, undefined, 'les relations locales ne sont pas envoyées au serveur');
  assert.equal(envoyee.salle, undefined);
  assert.equal(envoyee.enfileeLe, undefined);

  await page.evaluate(async () => {
    const store = document
      .querySelector('#q-app')
      .__vue_app__.config.globalProperties.$pinia._s.get('seancesHorsLigne');
    await store.synchroniser();
  });
  assert.equal(appelsSync.length, 1, 'un nouvel appel ne rejoue pas une file déjà acceptée');
  assert.deepEqual(erreurs, [], 'aucune erreur JavaScript pendant le parcours');
  report.statut = 'valide';
  report.uuid = queued.result.id;
  const stored = await prisma.seance.findUniqueOrThrow({ where: { id: queued.result.id } });
  assert.equal(stored.controleurAssigneId, controller.id);
  assert.equal(stored.affectationId, assignment.id);
  assert.equal(
    await prisma.auditLog.count({ where: { entiteId: stored.id, action: 'SEANCE_SYNCHRONISEE_HORS_LIGNE' } }),
    1,
  );
  report.singlePersistedSessionAndAudit = true;
  await page.evaluate(async () => {
    const store = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages');
    await store.synchroniser();
  });
  await page.waitForFunction(
    () =>
      document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia._s.get('pointages').file.length === 0,
  );
  const controls = await prisma.controle.findMany({ where: { seanceId: stored.id } });
  assert.equal(controls.length, 1);
  assert.equal(controls[0].statut, 'PRESENT');
  assert.equal(controls[0].attestation, 'SIGNATURE');
  assert.equal(controls[0].attestationValide, true);
  assert.equal(controls[0].dureeMinutes, 60);
  assert.equal(controls[0].controleurId, controller.id);
  assert.equal(controls[0].horsLigne, true);
  assert.equal(controls[0].observation, 'Observation confidentielle QA');
  const logs = await prisma.auditLog.findMany({ where: { entiteId: controls[0].id } });
  assert.ok(logs.length > 0);
  assert.ok(logs.every((l) => !l.details.includes('Observation confidentielle QA')));
  report.singleOfflineControlPersisted = true;

  await context.close();
} catch (e) {
  report.statut = 'echec';
  report.erreur = e.message;
  process.exitCode = 1;
} finally {
  if (year) {
    const ss = await prisma.seance.findMany({ where: { anneeId: year.id }, select: { id: true } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ entiteId: { in: ss.map((s) => s.id) } }, ...(controller ? [{ userId: controller.id }] : [])] },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entiteId: {
          in: (await prisma.controle.findMany({ where: { seance: { anneeId: year.id } }, select: { id: true } })).map(
            (c) => c.id,
          ),
        },
      },
    });
    await prisma.controle.deleteMany({ where: { seance: { anneeId: year.id } } });
    await prisma.seance.deleteMany({ where: { anneeId: year.id } });
    if (assignment) await prisma.affectation.delete({ where: { id: assignment.id } });
    if (promotion) await prisma.promotion.delete({ where: { id: promotion.id } });
    if (filiere) await prisma.filiere.delete({ where: { id: filiere.id } });
    if (teacher) await prisma.enseignant.delete({ where: { id: teacher.id } });
    if (subject) await prisma.matiere.delete({ where: { id: subject.id } });
    if (controller) await prisma.user.delete({ where: { id: controller.id } });
    if (department) await prisma.departement.delete({ where: { id: department.id } });
    if (room) await prisma.salle.delete({ where: { id: room.id } });
    await prisma.anneeAcademique.delete({ where: { id: year.id } });
  }
  report.productionUntouched = true;
  report.physicalDevicePending = true;
  report.scope = 'Préparation, séance et présence signée par formulaires, API QA réelle';
  ecrirePreuve('pointage-formulaire-hors-ligne-qa.json', report);
  await browser.close();
  await prisma.$disconnect();
  console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur }));
}
