/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
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
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
Object.assign(process.env, env);
const { AuthService } = require('../dist/modules/auth/auth.service');
const { optionsJwt } = require('../dist/common/jwt-config.module');
const auth = new AuthService(db, new JwtService(optionsJwt({ get: (k) => env[k] })));
const tag = 'QA-RATTRAPAGE-' + randomUUID();
const ids = { etudiant: [], inscription: [], evaluation: [], deliberation: [] };
let year, department, otherDepartment, filiere, promotion, subject, secondSubject;
const heads = [];
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
  const {
    ADMIN: admin,
    DIRECTION: direction,
    SCOLARITE: school,
    ETUDIANT: student,
    ENSEIGNANT: teacher,
  } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  year = await db.anneeAcademique.create({
    data: { libelle: tag, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
  });
  department = await db.departement.create({ data: { code: tag, nom: 'Département de recette' } });
  otherDepartment = await db.departement.create({ data: { code: tag + '-AUTRE', nom: 'Autre département QA' } });
  const headTokens = [],
    password = randomUUID();
  for (const d of [department, otherDepartment]) {
    const u = await db.user.create({
      data: {
        email: 'qa-rattrapage-' + randomUUID() + '@example.invalid',
        password: await bcrypt.hash(password, 10),
        nom: 'Chef QA',
        prenom: 'Rattrapage',
        role: 'CHEF_DEPARTEMENT',
        departementId: d.id,
      },
    });
    heads.push(u.id);
    const token = (await auth.login({ email: u.email, password }, 'QA-FIXTURE')).token;
    assert.equal((await call(token, 'GET', '/auth/me')).data.id, u.id);
    headTokens.push(token);
  }
  filiere = await db.filiere.create({ data: { code: tag, nom: tag, departementId: department.id } });
  promotion = await db.promotion.create({ data: { nom: tag, niveau: 'L1', filiereId: filiere.id, anneeId: year.id } });
  subject = await db.matiere.create({
    data: { code: tag, intitule: 'UE de recette', credits: 3, departementId: department.id },
  });
  for (let i = 0; i < 4; i++) {
    const e = await db.etudiant.create({
      data: {
        matricule: tag + '-' + i,
        nom: 'Recette',
        prenom: ['Ajourné', 'Admis', 'Défaillant', 'Second ajourné'][i],
      },
    });
    ids.etudiant.push(e.id);
    const inscription = await db.inscription.create({
      data: { numero: tag + '-' + i, etudiantId: e.id, promotionId: promotion.id, anneeId: year.id, statut: 'VALIDE' },
    });
    ids.inscription.push(inscription.id);
  }
  const base = { anneeId: year.id, promotionId: promotion.id };
  await call(admin, 'POST', '/deliberations', { ...base, session: 'RATTRAPAGE' }, 400);
  for (const type of ['EXAMEN', 'RATTRAPAGE']) {
    const evaluation = (
      await call(
        school,
        'POST',
        '/evaluations',
        {
          ...base,
          matiereId: subject.id,
          intitule: tag + '-' + type,
          type,
          coefficient: type === 'RATTRAPAGE' ? 3 : 1,
        },
        201,
      )
    ).data;
    ids.evaluation.push(evaluation.id);
    await call(school, 'PUT', '/notes/saisie', {
      evaluationId: evaluation.id,
      notes: [0, 1, 3].map((i) => ({
        inscriptionId: ids.inscription[i],
        note: type === 'EXAMEN' ? [8, 16, null, 7][i] : [20, 20, null, 10][i],
        present: true,
      })),
    });
    await call(school, 'POST', '/evaluations/' + evaluation.id + '/cloturer', {}, 201);
  }
  secondSubject = await db.matiere.create({
    data: { code: tag + '-UE2', intitule: 'Deuxième UE de recette', credits: 1, departementId: department.id },
  });
  const secondExam = (
    await call(
      school,
      'POST',
      '/evaluations',
      { ...base, matiereId: secondSubject.id, intitule: tag + '-UE2', type: 'EXAMEN', coefficient: 1 },
      201,
    )
  ).data;
  ids.evaluation.push(secondExam.id);
  await call(school, 'PUT', '/notes/saisie', {
    evaluationId: secondExam.id,
    notes: [0, 1, 3].map((i) => ({ inscriptionId: ids.inscription[i], note: [8, 16, null, 7][i], present: true })),
  });
  await call(school, 'POST', '/evaluations/' + secondExam.id + '/cloturer', {}, 201);
  const normal = (await call(school, 'POST', '/deliberations', { ...base, session: 'NORMALE' }, 201)).data;
  ids.deliberation.push(normal.id);
  assert.equal(normal.lignes.find((l) => l.inscriptionId === ids.inscription[0]).moyenne, 8);
  assert.equal(normal.lignes.find((l) => l.inscriptionId === ids.inscription[0]).decision, 'AJOURNE');
  assert.equal(normal.lignes.find((l) => l.inscriptionId === ids.inscription[1]).decision, 'ADMIS');
  assert.equal(normal.lignes.find((l) => l.inscriptionId === ids.inscription[2]).decision, 'DEFAILLANT');
  assert.equal(normal.lignes.find((l) => l.inscriptionId === ids.inscription[3]).decision, 'AJOURNE');
  await call(school, 'POST', `/deliberations/${normal.id}/valider`, {}, 403);
  const normalValidation = (
    await Promise.all(
      Array.from({ length: 4 }, () => call(direction, 'POST', `/deliberations/${normal.id}/valider`, {}, null)),
    )
  )
    .map((r) => r.status)
    .sort();
  assert.deepEqual(normalValidation, [201, 400, 400, 400]);
  assert.equal(await db.auditLog.count({ where: { entiteId: normal.id, action: 'DELIBERATION_VALIDEE' } }), 1);
  const catchup = (await call(school, 'POST', '/deliberations', { ...base, session: 'RATTRAPAGE' }, 201)).data;
  ids.deliberation.push(catchup.id);
  assert.equal(catchup.lignes.length, 2);
  assert.equal(catchup.lignes[0].inscriptionId, ids.inscription[0]);
  assert.equal(catchup.lignes[0].moyenne, 14.75);
  assert.equal(catchup.lignes[0].decision, 'ADMIS');
  assert.equal(catchup.lignes[0].mention, 'Bien');
  assert.equal(catchup.lignes[0].rang, 1);
  assert.equal(catchup.lignes[1].inscriptionId, ids.inscription[3]);
  assert.equal(catchup.lignes[1].moyenne, 8.69);
  assert.equal(catchup.lignes[1].decision, 'AJOURNE');
  assert.equal(catchup.lignes[1].mention, null);
  assert.equal(catchup.lignes[1].rang, 2);
  await call(admin, 'POST', '/deliberations', { ...base, session: 'RATTRAPAGE' }, 409);
  await call(student, 'GET', '/deliberations/' + catchup.id, null, 403);
  await call(teacher, 'POST', `/deliberations/${catchup.id}/calculer`, {}, 403);
  await call(school, 'POST', `/deliberations/${catchup.id}/calculer`, {}, 201);
  const competition = (
    await Promise.all([
      call(admin, 'POST', `/deliberations/${catchup.id}/valider`, {}, null),
      call(school, 'POST', `/deliberations/${catchup.id}/calculer`, {}, null),
    ])
  ).map((r) => r.status);
  assert.equal(competition[0], 201);
  assert.ok([201, 400].includes(competition[1]));
  await call(school, 'POST', `/deliberations/${catchup.id}/calculer`, {}, 400);
  const frozen = await db.deliberationLigne.findMany({ where: { deliberationId: catchup.id } });
  await call(
    school,
    'PUT',
    '/notes/saisie',
    { evaluationId: ids.evaluation[1], notes: [{ inscriptionId: ids.inscription[0], note: 0 }] },
    400,
  );
  assert.deepEqual(await db.deliberationLigne.findMany({ where: { deliberationId: catchup.id } }), frozen);
  const printed = (await call(school, 'GET', `/deliberations/${catchup.id}/releve/${ids.inscription[0]}`)).data;
  assert.ok(printed.includes('Session de rattrapage'));
  assert.ok(printed.includes('14,75'));
  assert.ok(printed.includes('Bien'));
  await call(student, 'GET', `/deliberations/${catchup.id}/releve/${ids.inscription[0]}`, null, 403);
  await call(headTokens[0], 'GET', '/deliberations/' + catchup.id);
  await call(headTokens[0], 'GET', `/deliberations/${catchup.id}/releve/${ids.inscription[0]}`);
  await call(headTokens[1], 'GET', '/deliberations/' + catchup.id, null, 404);
  await call(headTokens[1], 'GET', `/deliberations/${catchup.id}/releve/${ids.inscription[0]}`, null, 404);
  const visible = (await call(headTokens[1], 'GET', '/deliberations?anneeId=' + year.id)).data;
  assert.equal(visible.total, 0);
  assert.deepEqual(visible.data, []);
  const persisted = await db.deliberation.findUniqueOrThrow({ where: { id: catchup.id } });
  assert.equal(persisted.tauxReussite, 50);
  const proof = {
    date: new Date().toISOString(),
    passed: true,
    normalWithoutCatchupGrades: true,
    normalDecisions: ['AJOURNE', 'ADMIS', 'DEFAILLANT', 'AJOURNE'],
    normalValidationStatuses: normalValidation,
    singleValidationAudit: true,
    onlyNormalAdjournedSelected: true,
    unequalExamCoefficients: [1, 3],
    unequalUeCredits: [3, 1],
    catchupUeAverages: [
      [17, 8],
      [9.25, 7],
    ],
    normalAndCatchupWeightedAverages: [14.75, 8.69],
    decisions: ['ADMIS', 'AJOURNE'],
    mentions: ['Bien', null],
    ranks: [1, 2],
    successRate: 50,
    duplicateSessionRejected: true,
    recalculationAndClosedGradesFrozen: true,
    concurrentValidationAndCalculationStatuses: competition,
    protectedHtmlBulletin: true,
    roleRefusals: true,
    headDepartmentListDetailAndBulletinScope: true,
    physicalPrintingAndHumanRulesValidationPending: true,
    sessionSource: session.fixtureSource,
    httpLoginRouteQualified: false,
    productionUntouched: true,
  };
  fs.writeFileSync('../docs/audits/preuves/2026-10-06/rattrapage.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (promotion) {
      await db.deliberation.deleteMany({ where: { promotionId: promotion.id } });
      await db.evaluation.deleteMany({ where: { promotionId: promotion.id } });
    }
    await db.inscription.deleteMany({ where: { id: { in: ids.inscription } } });
    await db.etudiant.deleteMany({ where: { id: { in: ids.etudiant } } });
    if (subject) await db.matiere.delete({ where: { id: subject.id } });
    if (secondSubject) await db.matiere.delete({ where: { id: secondSubject.id } });
    if (promotion) await db.promotion.delete({ where: { id: promotion.id } });
    if (filiere) await db.filiere.delete({ where: { id: filiere.id } });
    await db.user.deleteMany({ where: { id: { in: heads } } });
    if (otherDepartment) await db.departement.delete({ where: { id: otherDepartment.id } });
    if (department) await db.departement.delete({ where: { id: department.id } });
    if (year) await db.anneeAcademique.delete({ where: { id: year.id } });
    await db.$disconnect();
  });
