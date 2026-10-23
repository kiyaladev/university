/** Qualification HTTP réelle, deux départements et fixtures exclusivement QA. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
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
Object.assign(process.env, env);
const { AuthService } = require('../dist/modules/auth/auth.service');
const { optionsJwt } = require('../dist/common/jwt-config.module');
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const auth = new AuthService(db, new JwtService(optionsJwt({ get: (k) => env[k] })));
const tag = 'QA-JUSTIFICATIFS-' + randomUUID();
const ids = {
  departement: [],
  user: [],
  enseignant: [],
  filiere: [],
  promotion: [],
  matiere: [],
  affectation: [],
  seance: [],
};
let year;
async function create(model, data) {
  const row = await db[model].create({ data });
  ids[model].push(row.id);
  return row;
}
async function call(token, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (expected !== null) assert.equal(r.status, expected, `${method} ${path}: ${text.slice(0, 200)}`);
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function main() {
  const admin = session.token,
    { DIRECTION: direction, SCOLARITE: school, ETUDIANT: student } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  year = await db.anneeAcademique.create({
    data: { libelle: tag, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), active: false },
  });
  const departments = [];
  for (let i = 0; i < 2; i++)
    departments.push(await create('departement', { code: tag + '-' + i, nom: 'Département QA ' + i }));
  const tokens = [],
    password = randomUUID();
  for (let i = 0; i < 5; i++) {
    const role = i < 3 ? 'CHEF_DEPARTEMENT' : 'ENSEIGNANT';
    const user = await create('user', {
      email: tag.toLowerCase() + '-' + i + '@example.invalid',
      password: await bcrypt.hash(password, 10),
      nom: 'Compte QA',
      prenom: String(i),
      role,
      departementId: i < 2 ? departments[i].id : undefined,
    });
    if (role === 'ENSEIGNANT')
      await create('enseignant', {
        userId: user.id,
        matricule: tag + '-' + i,
        nom: 'Professeur QA',
        prenom: String(i),
        departementId: departments[i === 3 ? 1 : 0].id,
      });
    tokens.push((await auth.login({ email: user.email, password }, 'QA-FIXTURE')).token);
    assert.equal((await call(tokens[i], 'GET', '/auth/me')).data.id, user.id);
  }
  const [headA, headB, headNone, teacherA, teacherB] = tokens;
  const courses = [];
  for (let i = 0; i < 2; i++) {
    const f = await create('filiere', { code: tag + '-' + i, nom: 'Filière QA', departementId: departments[i].id });
    const p = await create('promotion', { nom: tag + '-' + i, niveau: 'L1', filiereId: f.id, anneeId: year.id });
    const m = await create('matiere', {
      code: tag + '-' + i,
      intitule: 'Matière QA',
      departementId: departments[i].id,
    });
    courses.push(
      await create('affectation', {
        promotionId: p.id,
        matiereId: m.id,
        enseignantId: ids.enseignant[i],
        anneeId: year.id,
      }),
    );
  }
  async function lesson(course = 0) {
    return create('seance', {
      affectationId: courses[course].id,
      anneeId: year.id,
      date: new Date(Date.UTC(2026, 9, 6 + ids.seance.length)),
      heureDebut: '08:00',
      heureFin: '10:00',
    });
  }
  const piece = 'data:application/pdf;base64,UVEtUElFQ0UtUFJJVkVF';
  const motif = 'Motif médical fictif confidentiel';
  async function deposit(token, seance, expected = 201) {
    return call(token, 'POST', '/justificatifs', { seanceId: seance.id, type: 'MALADIE', motif, piece }, expected);
  }
  const a = await lesson(),
    b = await lesson(1);
  const ja = (await deposit(headA, a)).data,
    jb = (await deposit(admin, b)).data;
  if (process.argv.includes('--regression')) {
    assert.equal(ja.piece, piece);
    await call(admin, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'VALIDE' });
    await call(admin, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'REJETE' });
    const control = await db.controle.findUniqueOrThrow({ where: { seanceId: a.id } });
    assert.equal(control.statut, 'EXCUSE');
    const proof = {
      date: new Date().toISOString(),
      headDepositReturnsPrivatePiece: true,
      rejectedDecisionWithExcusedControl: true,
      productionUntouched: true,
    };
    fs.writeFileSync('../docs/audits/preuves/2026-10-06/justificatifs-regression.json', JSON.stringify(proof, null, 2));
    console.log(JSON.stringify(proof));
    return;
  }
  assert.equal(ja.piece, undefined);
  for (const token of [headA, teacherA]) {
    const detail = (await call(token, 'GET', '/justificatifs/' + ja.id)).data;
    assert.equal(detail.piece, undefined);
    const list = (
      await call(
        token,
        'GET',
        '/justificatifs?all=1&departementId=' + departments[1].id + '&enseignantId=' + ids.enseignant[1],
      )
    ).data;
    if (token === teacherA) assert.ok(list.data.some((j) => j.id === ja.id));
    assert.ok(!list.data.some((j) => j.id === jb.id));
    assert.ok(list.data.every((j) => j.piece === undefined));
  }
  for (const token of [headB, headNone, teacherB]) await call(token, 'GET', '/justificatifs/' + ja.id, null, 404);
  const outside = await lesson();
  await deposit(headB, outside, 400);
  await deposit(headNone, outside, 400);
  await deposit(teacherA, outside, 403);
  await call(headB, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'VALIDE' }, 404);
  await call(headNone, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'VALIDE' }, 404);
  await call(teacherA, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'VALIDE' }, 403);
  await call(school, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'VALIDE' }, 403);
  await call(student, 'GET', '/justificatifs/' + ja.id, null, 403);
  const listA = (await call(headA, 'GET', '/justificatifs?all=1&departementId=' + departments[1].id)).data;
  assert.ok(listA.data.some((j) => j.id === ja.id));
  assert.ok(!listA.data.some((j) => j.id === jb.id));
  assert.equal(listA.total, listA.data.length);
  for (const token of [admin, direction, school])
    assert.equal((await call(token, 'GET', '/justificatifs/' + ja.id)).data.piece, piece);
  await call(admin, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'EN_ATTENTE' }, 400);
  const validated = (await call(headA, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'VALIDE' })).data;
  assert.equal(validated.statut, 'VALIDE');
  assert.equal(validated.piece, undefined);
  assert.equal((await db.controle.findUniqueOrThrow({ where: { seanceId: a.id } })).statut, 'EXCUSE');
  await call(admin, 'PUT', `/justificatifs/${ja.id}/traiter`, { statut: 'REJETE' }, 400);
  await call(admin, 'DELETE', '/justificatifs/' + ja.id, null, 400);
  const refused = (await call(direction, 'PUT', `/justificatifs/${jb.id}/traiter`, { statut: 'REJETE' })).data;
  assert.equal(refused.statut, 'REJETE');
  assert.equal(await db.controle.count({ where: { seanceId: b.id } }), 0);
  const concurrentLesson = await lesson();
  const concurrent = (await deposit(admin, concurrentLesson)).data;
  const statuses = (
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        call(
          i % 2 ? headA : direction,
          'PUT',
          `/justificatifs/${concurrent.id}/traiter`,
          { statut: i % 2 ? 'REJETE' : 'VALIDE' },
          null,
        ),
      ),
    )
  ).map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 200).length, 1);
  assert.ok(
    statuses.every((s) => [200, 400, 409].includes(s)),
    JSON.stringify(statuses),
  );
  const final = await db.justificatif.findUniqueOrThrow({ where: { id: concurrent.id } });
  const excused = await db.controle.findUnique({ where: { seanceId: concurrentLesson.id } });
  assert.equal(excused?.statut === 'EXCUSE', final.statut === 'VALIDE');
  const events = await db.auditLog.findMany({ where: { entite: 'Justificatif', entiteId: concurrent.id } });
  assert.equal(events.filter((e) => ['JUSTIFICATIF_VALIDE', 'JUSTIFICATIF_REJETE'].includes(e.action)).length, 1);
  const pendingLesson = await lesson(),
    pending = (await deposit(admin, pendingLesson)).data;
  await call(admin, 'DELETE', '/justificatifs/' + pending.id);
  await call(admin, 'GET', '/justificatifs/' + pending.id, null, 404);
  const closedLesson = await lesson(),
    closed = (await deposit(admin, closedLesson)).data;
  await db.anneeAcademique.update({ where: { id: year.id }, data: { cloturee: true } });
  await call(admin, 'PUT', `/justificatifs/${closed.id}/traiter`, { statut: 'VALIDE' }, 400);
  await call(admin, 'DELETE', '/justificatifs/' + closed.id, null, 400);
  await deposit(admin, await lesson(), 400);
  const audits = await db.auditLog.findMany({
    where: {
      entite: 'Justificatif',
      entiteId: {
        in: (await db.justificatif.findMany({ where: { seanceId: { in: ids.seance } }, select: { id: true } })).map(
          (j) => j.id,
        ),
      },
    },
  });
  assert.ok(!JSON.stringify(audits).includes(motif));
  assert.ok(!JSON.stringify(audits).includes(piece));
  const proof = {
    date: new Date().toISOString(),
    passed: true,
    courseDepartmentScopeDespiteTeachersHomeDepartment: true,
    headAndTeacherPiecesOmittedIncludingDeposit: true,
    administrativeDetailKeepsPiece: true,
    otherDepartmentsAndUnassignedHeadRejected: true,
    depositAndDecisionRolesChecked: true,
    finalDecisionAndEvidenceRetained: true,
    validatedAbsenceExcusedRejectedAbsenceUnchanged: true,
    concurrentDecisionStatuses: statuses,
    singleDecisionAuditAndConsistentControl: true,
    pendingDeletion: true,
    closedYearMutationsRejected: true,
    auditWithoutMedicalText: true,
    fixtureSessionsSource: 'AuthService.login avec mots de passe QA vérifiés et /auth/me',
    httpLoginRouteQualified: false,
    productionUntouched: true,
  };
  fs.writeFileSync('../docs/audits/preuves/2026-10-06/justificatifs.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.justificatif.deleteMany({ where: { seanceId: { in: ids.seance } } });
    await db.controle.deleteMany({ where: { seanceId: { in: ids.seance } } });
    for (const model of [
      'seance',
      'affectation',
      'matiere',
      'promotion',
      'filiere',
      'enseignant',
      'user',
      'departement',
    ])
      await db[model].deleteMany({ where: { id: { in: ids[model] } } });
    if (year) await db.anneeAcademique.delete({ where: { id: year.id } });
    await db.$disconnect();
  });
