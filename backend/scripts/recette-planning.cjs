/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
assert.ok(process.env.QA_ENV_FILE && process.env.QA_SESSION_FILE);
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE));
const session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE));
const url = new URL(env.DATABASE_URL);
assert.equal(url.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(env.PORT, '15041');
assert.equal(env.NODE_ENV, 'development');
assert.equal(session.api, 'http://127.0.0.1:15041/api');
assert.equal(session.database, url.pathname);
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const tag = 'QA-PLANNING-' + randomUUID();
const report = { date: new Date().toISOString(), statut: 'en_cours' };
let year, department, filiere, promotion, teacher, subject, assignment, room, slot;
async function call(token, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (expected !== null) assert.equal(r.status, expected, method + ' ' + path + ': ' + text.slice(0, 180));
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function main() {
  const { ADMIN: admin, SCOLARITE: school, ETUDIANT: student, ENSEIGNANT: teacherToken } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  year = await db.anneeAcademique.create({
    data: { libelle: tag, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
  });
  department = await db.departement.create({ data: { code: tag, nom: tag } });
  filiere = await db.filiere.create({ data: { code: tag, nom: tag, departementId: department.id } });
  promotion = await db.promotion.create({ data: { nom: tag, niveau: 'L1', filiereId: filiere.id, anneeId: year.id } });
  teacher = await db.enseignant.create({
    data: { matricule: tag, nom: 'Recette', prenom: 'Planning', departementId: department.id },
  });
  subject = await db.matiere.create({ data: { code: tag, intitule: 'Planning QA', departementId: department.id } });
  assignment = await db.affectation.create({
    data: { enseignantId: teacher.id, matiereId: subject.id, promotionId: promotion.id, anneeId: year.id },
  });
  room = await db.salle.create({ data: { code: tag, nom: 'Salle QA', qrToken: randomUUID() } });
  const dto = {
    affectationId: assignment.id,
    salleId: room.id,
    jourSemaine: 1,
    heureDebut: '08:00',
    heureFin: '10:00',
    dateDebut: '2026-10-12',
    dateFin: '2026-10-26',
  };
  await call(student, 'POST', '/creneaux', dto, 403);
  await call(teacherToken, 'POST', '/creneaux', dto, 403);
  slot = (await call(school, 'POST', '/creneaux', dto, 201)).data;
  await call(admin, 'POST', '/creneaux', { ...dto, heureDebut: '09:00', heureFin: '11:00' }, 400);
  await call(admin, 'PUT', '/creneaux/' + slot.id, { heureFin: '07:00' }, 400);
  const gen = {
    anneeId: year.id,
    creneauIds: [slot.id],
    dateDebut: '2026-10-01',
    dateFin: '2026-10-31',
    joursExclus: ['2026-10-19'],
  };
  const first = (await call(school, 'POST', '/seances/generer', gen, 201)).data;
  assert.equal(first.creees, 2);
  assert.equal(first.candidates, 2);
  const second = (await call(school, 'POST', '/seances/generer', gen, 201)).data;
  assert.equal(second.creees, 0);
  assert.equal(second.ignorees, 2);
  const persisted = await db.seance.findMany({ where: { anneeId: year.id }, orderBy: { date: 'asc' } });
  assert.deepEqual(
    persisted.map((s) => s.date.toISOString().slice(0, 10)),
    ['2026-10-12', '2026-10-26'],
  );
  assert.ok(persisted.every((s) => s.salleId === room.id && s.creneauId === slot.id && s.heureDebut === '08:00'));
  await call(student, 'GET', '/seances?anneeId=' + year.id, null, 403);
  const teacherList = (await call(teacherToken, 'GET', '/seances?anneeId=' + year.id)).data;
  assert.equal(teacherList.total, 0);
  await call(teacherToken, 'GET', '/seances/' + persisted[0].id, null, 404);
  await call(school, 'PUT', '/seances/' + persisted[0].id, { thematique: 'Thématique confidentielle QA' });
  await call(school, 'POST', '/seances/' + persisted[0].id + '/annuler', { motif: 'Motif confidentiel QA' }, 201);
  assert.equal((await db.seance.findUniqueOrThrow({ where: { id: persisted[0].id } })).statut, 'ANNULE');
  const offlineId = randomUUID(),
    offline = {
      idClient: offlineId,
      affectationId: assignment.id,
      date: '2026-10-13',
      heureDebut: '14:00',
      heureFin: '16:00',
      salleId: room.id,
    };
  const sync = (await call(school, 'POST', '/seances/sync', { seances: [offline] }, 201)).data;
  report.sync = sync;
  assert.equal(sync.synchronisees, 1);
  assert.equal(sync.echecs.length, 0);
  assert.deepEqual(sync.resultats[0], { idClient: offlineId, ok: true, id: offlineId, dejaCreee: false });
  const replay = (await call(school, 'POST', '/seances/sync', { seances: [offline] }, 201)).data;
  assert.equal(replay.resultats[0].dejaCreee, true);
  assert.equal(replay.resultats[0].id, offlineId);
  assert.equal(await db.seance.count({ where: { id: offlineId } }), 1);
  const mismatched = (
    await call(school, 'POST', '/seances/sync', { seances: [{ ...offline, heureFin: '17:00' }] }, 201)
  ).data;
  assert.equal(mismatched.synchronisees, 0);
  assert.equal(mismatched.echecs.length, 1);
  assert.equal(mismatched.resultats[0].ok, false);
  assert.equal((await db.seance.findUniqueOrThrow({ where: { id: offlineId } })).heureFin, '16:00');
  assert.equal(
    await db.auditLog.count({ where: { entiteId: offlineId, action: 'SEANCE_SYNCHRONISEE_HORS_LIGNE' } }),
    1,
  );
  report.syncRejeu = replay;
  report.syncDivergent = mismatched;
  await db.anneeAcademique.update({ where: { id: year.id }, data: { cloturee: true } });
  await call(school, 'PUT', '/creneaux/' + slot.id, { heureFin: '11:00' }, 400);
  await call(school, 'POST', '/seances/generer', gen, 400);
  await call(school, 'PUT', '/seances/' + persisted[1].id, { thematique: 'Interdit' }, 400);
  await call(admin, 'DELETE', '/seances/' + persisted[1].id, null, 400);
  const logs = await db.auditLog.findMany({
    where: { entiteId: { in: [year.id, slot.id, ...persisted.map((s) => s.id), offlineId] } },
  });
  assert.equal(logs.filter((l) => l.action === 'SEANCES_GENEREES').length, 1);
  for (const l of logs)
    for (const text of ['Thématique confidentielle QA', 'Motif confidentiel QA']) assert.ok(!l.details.includes(text));
  report.generations = [first, second];
  report.datesPersistantes = persisted.map((s) => s.date.toISOString().slice(0, 10));
  report.observations = [
    'Création scolarité, refus étudiant/enseignant',
    'Collision de créneau et heures invalides refusées',
    'Bornes et jour exclu respectés',
    'Génération rejouée sans doublon ni seconde trace',
    'Registre étudiant refusé, enseignant tiers sans lecture',
    'Modification et annulation persistées',
    'Synchronisation UUID rejouée, contenu divergent refusé',
    'Créneau, génération, modification et suppression bloqués après clôture',
    'Journal sans thématique ni motif libre',
  ];
  report.statut = 'valide';
}
main()
  .catch((e) => {
    report.statut = 'echec';
    report.erreur = e.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    if (year) {
      const ss = await db.seance.findMany({ where: { anneeId: year.id }, select: { id: true } });
      await db.auditLog.deleteMany({
        where: { entiteId: { in: [year.id, ...(slot ? [slot.id] : []), ...ss.map((s) => s.id)] } },
      });
      await db.seance.deleteMany({ where: { anneeId: year.id } });
      if (assignment) {
        await db.creneau.deleteMany({ where: { affectationId: assignment.id } });
        await db.affectation.delete({ where: { id: assignment.id } });
      }
      if (promotion) await db.promotion.delete({ where: { id: promotion.id } });
      if (filiere) await db.filiere.delete({ where: { id: filiere.id } });
      if (teacher) await db.enseignant.delete({ where: { id: teacher.id } });
      if (subject) await db.matiere.delete({ where: { id: subject.id } });
      if (department) await db.departement.delete({ where: { id: department.id } });
      if (room) await db.salle.delete({ where: { id: room.id } });
      await db.anneeAcademique.delete({ where: { id: year.id } });
      report.fixturesRestantes = await db.anneeAcademique.count({ where: { id: year.id } });
      assert.equal(report.fixturesRestantes, 0);
    }
    report.productionUntouched = true;
    report.limites = [
      'Formulaires navigateur et acceptation humaine non qualifiés par cette recette',
      'Synchronisation des pointages et appareil terrain non qualifiés par cette recette',
    ];
    fs.writeFileSync('../docs/audits/preuves/2026-10-06/planning-http.json', JSON.stringify(report, null, 2) + '\n');
    await db.$disconnect();
    console.log(
      JSON.stringify({ statut: report.statut, erreur: report.erreur, fixturesRestantes: report.fixturesRestantes }),
    );
  });
