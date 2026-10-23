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

const tag = 'QA-IMPORT-CRENEAUX-' + randomUUID();
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
  const { ADMIN: admin, SCOLARITE: school, ETUDIANT: student } = session.sessions;
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
  const header = 'Affectation ID;Jour;Heure début;Heure fin;Salle ID;Date début;Date fin';
  const line = (aff, day, start, end) => [aff, day, start, end, room.id, '12/10/2026', '26/10/2026'].join(';');
  const dto = {
    type: 'creneaux',
    contenu:
      header +
      '\n' +
      [
        line(assignment.id, 'lundi', '8h00', '10h00'),
        line(randomUUID(), 'mardi', '8h00', '10h00'),
        line(assignment.id, 'mardi', '14h00', '16h00'),
      ].join('\n'),
  };
  await call(student, 'POST', '/imports/referentiels/appliquer', dto, 403);
  const preview = (await call(school, 'POST', '/imports/referentiels/previsualiser', dto, 201)).data;
  assert.equal(preview.valides, 2);
  assert.equal(preview.rejetees, 1);
  assert.equal(await db.creneau.count({ where: { affectationId: assignment.id } }), 0);
  assert.equal(preview.apercu[0].donnees.jourSemaine, 1);
  assert.equal(preview.apercu[0].donnees.heureDebut, '08:00');
  const applied = (await call(school, 'POST', '/imports/referentiels/appliquer', dto, 201)).data;
  // Les créneaux importés sont mémorisés avant toute assertion : chacun porte
  // une trace d'audit (CRENEAU_CREE) qui doit être purgée en fin de recette,
  // même si la suite du scénario échoue.
  const persisted = await db.creneau.findMany({ where: { affectationId: assignment.id } });
  slot = persisted;
  assert.equal(applied.importees, 2);
  assert.equal(applied.rejetees, 1);
  assert.equal(persisted.length, 2);
  assert.ok(
    persisted.every(
      (c) =>
        c.dateDebut.toISOString().slice(0, 10) === '2026-10-12' &&
        c.dateFin.toISOString().slice(0, 10) === '2026-10-26',
    ),
  );
  const replay = (await call(admin, 'POST', '/imports/referentiels/appliquer', dto, 201)).data;
  assert.equal(replay.importees, 0);
  assert.equal(replay.rejetees, 3);
  const collision = { type: 'creneaux', contenu: header + '\n' + line(assignment.id, 'lundi', '9h00', '11h00') };
  const conflict = (await call(school, 'POST', '/imports/referentiels/previsualiser', collision, 201)).data;
  assert.equal(conflict.valides, 0);
  assert.equal(conflict.rejetees, 1);
  const refused = (await call(school, 'POST', '/imports/referentiels/appliquer', collision, 201)).data;
  assert.equal(refused.importees, 0);
  await db.anneeAcademique.update({ where: { id: year.id }, data: { cloturee: true } });
  const closedDto = { type: 'creneaux', contenu: header + '\n' + line(assignment.id, 'mercredi', '8h00', '10h00') };
  const closed = (await call(school, 'POST', '/imports/referentiels/appliquer', closedDto, 201)).data;
  assert.equal(closed.importees, 0);
  assert.equal(closed.rejetees, 1);
  assert.equal(await db.creneau.count({ where: { affectationId: assignment.id } }), 2);
  for (const c of persisted)
    assert.equal(await db.auditLog.count({ where: { entiteId: c.id, action: 'CRENEAU_CREE' } }), 1);
  report.preview = { valides: preview.valides, rejetees: preview.rejetees };
  report.applied = applied;
  report.replay = replay;
  report.collision = refused;
  report.closedYear = closed;
  report.observations = [
    'Normalisation lundi, 8h00 et dates françaises',
    'Aperçu sans écriture',
    'Deux créations et référence UUID inconnue rejetée',
    'Rejeu sans doublon',
    'Collision rejetée',
    'Année clôturée sans nouvelle écriture',
    'Une trace par création',
    'Rôle étudiant refusé',
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
        where: {
          entiteId: { in: [year.id, ...(slot ? slot.map((s) => s.id) : []), ...ss.map((s) => s.id)] },
        },
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
    report.limites = ['Fichiers historiques et parcours XLSX navigateur non qualifiés par cette recette'];
    fs.writeFileSync(
      '../audit/recommandations-2026-10-06/imports-creneaux-http.json',
      JSON.stringify(report, null, 2) + '\n',
    );
    await db.$disconnect();
    console.log(
      JSON.stringify({ statut: report.statut, erreur: report.erreur, fixturesRestantes: report.fixturesRestantes }),
    );
  });
