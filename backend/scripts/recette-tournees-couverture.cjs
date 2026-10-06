/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'), fs = require('node:fs');
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
const controllers = [];
let year, department, filiere, promotion, teacher, subject, assignment, room, slot;
async function call(token, method, path, body, expected = 200) {
 const r = await fetch(session.api + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const text = await r.text();
 if (expected !== null) assert.equal(r.status, expected, method + ' ' + path + ': ' + text.slice(0, 180));
 return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function main() {
 const { ADMIN: admin, SCOLARITE: school, ETUDIANT: student, ENSEIGNANT: teacherToken } = session.sessions;
 assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
 year = await db.anneeAcademique.create({ data: { libelle: tag, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') } });
 department = await db.departement.create({ data: { code: tag, nom: tag } });
 filiere = await db.filiere.create({ data: { code: tag, nom: tag, departementId: department.id } });
 promotion = await db.promotion.create({ data: { nom: tag, niveau: 'L1', filiereId: filiere.id, anneeId: year.id } });
 teacher = await db.enseignant.create({ data: { matricule: tag, nom: 'Recette', prenom: 'Planning', departementId: department.id } });
 subject = await db.matiere.create({ data: { code: tag, intitule: 'Planning QA', departementId: department.id } });
 assignment = await db.affectation.create({ data: { enseignantId: teacher.id, matiereId: subject.id, promotionId: promotion.id, anneeId: year.id } });
 room = await db.salle.create({ data: { code: tag, nom: 'Salle QA', qrToken: randomUUID() } });
 const bcrypt = require('bcryptjs');
 for (let i = 0; i < 2; i++) {
  const u = await db.user.create({ data: { email: 'qa-tournee-' + randomUUID() + '@example.invalid', password: await bcrypt.hash(randomUUID(), 10), nom: 'Controleur QA', prenom: String(i), role: 'CONTROLEUR', departementId: department.id } }); controllers.push(u.id);
 }
 const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-20', '2026-10-04'];
 const rows = [];
 for (const date of dates) rows.push(await db.seance.create({ data: { affectationId: assignment.id, anneeId: year.id, date: new Date(date), heureDebut: '08:00', heureFin: '10:00' } }));
 for (let i = 0; i < 4; i++) await call(school, 'PUT', '/seances/' + rows[i].id + '/controleur', { controleurId: controllers[0] });
 await db.controle.create({ data: { seanceId: rows[0].id, controleurId: controllers[0], statut: 'ABSENT' } });
 await db.controle.create({ data: { seanceId: rows[1].id, controleurId: controllers[1], statut: 'ABSENT' } });
 const path = '/rapports/couverture-controleurs?dateDebut=2026-10-01&dateFin=2026-10-31&departementId=' + department.id;
 await call(student, 'GET', path, null, 403); await call(teacherToken, 'GET', path, null, 403);
 const coverage = (await call(school, 'GET', path)).data;
 const c = coverage.lignes.find(r => r.controleurId === controllers[0]);
 assert.ok(c); for (const [key, expected] of Object.entries({ seancesPlanifiees: 4, seancesPassees: 3, visitees: 2, nonVisitees: 1, realiseesParAssigne: 1, realiseesParUnAutre: 1, tauxCouverture: 66.67, tauxParAssigne: 33.33 })) assert.equal(c[key], expected, key);
 assert.equal(coverage.nonAffectees.seancesPassees, 1);
 const dto = { dateDebut: '2026-10-01', dateFin: '2026-10-31', controleurId: controllers[0], departementId: department.id };
 const preview = (await call(school, 'GET', '/seances/tournee-apercu?' + new URLSearchParams(dto))).data;
 assert.equal(preview.seancesAffectables, 1);
 await call(school, 'POST', '/seances/tournee', dto, 201);
 assert.equal((await db.seance.findUniqueOrThrow({ where: { id: rows[4].id } })).controleurAssigneId, controllers[0]);
 await call(school, 'PUT', '/seances/' + rows[4].id + '/controleur', { controleurId: (await call(admin, 'GET', '/auth/me')).data.id }, 400);
 report.coverage = coverage; report.assignmentPreview = preview;
 report.observations = ['Affectation individuelle persistée', 'Trois séances passées et une future', 'Une visite par agent prévu et une par collègue', 'Taux couverture 66,67 et réalisation assignée 33,33', 'Une séance non affectée puis affectation groupée', 'Agent non contrôleur rejeté', 'Lectures étudiant et enseignant refusées'];
 report.statut = 'valide';
}
main().catch(e => { report.statut = 'echec'; report.erreur = e.message; process.exitCode = 1; }).finally(async () => {
 if (year) {
  const ss = await db.seance.findMany({ where: { anneeId: year.id }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { entiteId: { in: [year.id, ...(slot ? [slot.id] : []), ...ss.map(s => s.id)] } } });
  await db.controle.deleteMany({ where: { seance: { anneeId: year.id } } });
  await db.seance.deleteMany({ where: { anneeId: year.id } });
  if (assignment) { await db.creneau.deleteMany({ where: { affectationId: assignment.id } }); await db.affectation.delete({ where: { id: assignment.id } }); }
  if (promotion) await db.promotion.delete({ where: { id: promotion.id } });
  if (filiere) await db.filiere.delete({ where: { id: filiere.id } });
  if (teacher) await db.enseignant.delete({ where: { id: teacher.id } });
  if (subject) await db.matiere.delete({ where: { id: subject.id } });
  await db.user.deleteMany({ where: { id: { in: controllers } } });
  if (department) await db.departement.delete({ where: { id: department.id } });
  if (room) await db.salle.delete({ where: { id: room.id } });
  await db.anneeAcademique.delete({ where: { id: year.id } });
  report.fixturesRestantes = await db.anneeAcademique.count({ where: { id: year.id } }); assert.equal(report.fixturesRestantes, 0);
 }
 report.productionUntouched = true;
 report.limites = ['Tournées réelles, validation humaine et appareil terrain non qualifiés'];
 fs.writeFileSync('../audit/recommandations-2026-10-06/tournees-couverture-http.json', JSON.stringify(report, null, 2) + '\n');
 await db.$disconnect(); console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur, fixturesRestantes: report.fixturesRestantes }));
});
