/** Cloisonnement du courrier sur deux départements fictifs, API/base QA uniquement. */
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
const tag = 'QA-COURRIER-DEPARTEMENTS-' + randomUUID();
const departments = [],
  accounts = [],
  letters = [];
async function call(token, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (expected !== null) assert.equal(r.status, expected, method + ' ' + path + ': ' + text.slice(0, 200));
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function main() {
  assert.equal((await call(session.token, 'GET', '/auth/me')).data.role, 'ADMIN');
  const password = randomUUID();
  const tokens = [];
  for (let i = 0; i < 3; i++) {
    let departementId;
    if (i < 2) {
      const d = await db.departement.create({ data: { code: tag + '-' + i, nom: 'Département fictif ' + i } });
      departments.push(d.id);
      departementId = d.id;
    }
    const u = await db.user.create({
      data: {
        email: tag.toLowerCase() + '-' + i + '@example.invalid',
        password: await bcrypt.hash(password, 10),
        nom: 'Chef QA',
        prenom: String(i),
        role: 'CHEF_DEPARTEMENT',
        departementId,
      },
    });
    accounts.push(u.id);
    const login = await auth.login({ email: u.email, password }, 'QA-FIXTURE');
    tokens.push(login.token);
    assert.equal((await call(login.token, 'GET', '/auth/me')).data.id, u.id);
  }
  const regression = process.argv.includes('--regression');
  const body = {
    numero: tag,
    type: 'ENTRANT',
    objet: 'Objet privé fictif',
    circuit: [{ ordre: 1, roleValideur: 'Chef département' }],
  };
  const created = (
    await call(
      regression ? tokens[0] : session.token,
      'POST',
      '/courrier',
      { ...body, ...(regression ? {} : { departementId: departments[0] }) },
      201,
    )
  ).data;
  letters.push(created.id);
  if (regression) {
    const other = await call(tokens[1], 'GET', '/courrier/' + created.id, null, null);
    assert.equal(other.status, 200, 'Le défaut initial doit être effectivement reproduit');
    const proof = {
      date: new Date().toISOString(),
      crossDepartmentDetailStatus: other.status,
      confidentialityViolationReproduced: true,
      productionUntouched: true,
    };
    fs.writeFileSync(
      '../audit/recommandations-2026-10-06/courrier-departements-regression.json',
      JSON.stringify(proof, null, 2),
    );
    console.log(JSON.stringify(proof));
    return;
  }
  assert.equal(created.departementId, departments[0]);
  await call(tokens[0], 'GET', '/courrier/' + created.id);
  for (const token of [tokens[1], tokens[2]]) {
    await call(token, 'GET', '/courrier/' + created.id, null, 404);
    await call(token, 'GET', '/courrier/' + created.id + '/imprimer', null, 404);
    await call(token, 'POST', `/courrier/${created.id}/parapher/${created.circuits[0].id}`, {}, 404);
    const list = (await call(token, 'GET', '/courrier?search=' + encodeURIComponent(tag))).data;
    assert.equal(list.total, 0);
    assert.equal(list.data.length, 0);
  }
  await call(
    tokens[1],
    'POST',
    '/courrier',
    { ...body, numero: tag + '-INTERDIT', departementId: departments[0] },
    403,
  );
  await call(tokens[2], 'POST', '/courrier', { ...body, numero: tag + '-SANS-DEP' }, 403);
  await call(
    session.token,
    'POST',
    '/courrier',
    { ...body, numero: tag + '-INCONNU', departementId: randomUUID() },
    400,
  );
  const own = (await call(tokens[1], 'POST', '/courrier', { ...body, numero: tag + '-PROPRE' }, 201)).data;
  letters.push(own.id);
  assert.equal(own.departementId, departments[1]);
  const ownList = (await call(tokens[0], 'GET', '/courrier?search=' + encodeURIComponent(tag))).data;
  assert.equal(ownList.total, 1);
  assert.equal(ownList.data[0].id, created.id);
  await call(session.token, 'PUT', '/courrier/' + created.id, { departementId: departments[1] });
  await call(tokens[0], 'GET', '/courrier/' + created.id, null, 404);
  await call(tokens[1], 'GET', '/courrier/' + created.id);
  await call(tokens[1], 'POST', `/courrier/${created.id}/parapher/${created.circuits[0].id}`, {}, 201);
  await call(session.token, 'PUT', '/courrier/' + created.id, { departementId: departments[0] }, 400);
  const central = (await call(session.token, 'POST', '/courrier', { ...body, numero: tag + '-CENTRAL' }, 201)).data;
  letters.push(central.id);
  await call(tokens[0], 'GET', '/courrier/' + central.id, null, 404);
  await call(tokens[1], 'GET', '/courrier/' + central.id, null, 404);
  await call(session.token, 'GET', '/courrier/' + central.id);
  const race = (
    await call(
      session.token,
      'POST',
      '/courrier',
      { ...body, numero: tag + '-CONCURRENT', departementId: departments[0] },
      201,
    )
  ).data;
  letters.push(race.id);
  const concurrent = await Promise.all([
    call(session.token, 'PUT', '/courrier/' + race.id, { departementId: departments[1] }, null),
    call(tokens[0], 'POST', `/courrier/${race.id}/parapher/${race.circuits[0].id}`, {}, null),
  ]);
  const statuses = concurrent.map((r) => r.status);
  assert.ok(
    JSON.stringify(statuses) === '[200,404]' || JSON.stringify(statuses) === '[400,201]',
    JSON.stringify(statuses),
  );
  const finalRace = await db.courrier.findUniqueOrThrow({ where: { id: race.id }, include: { circuits: true } });
  if (statuses[0] === 200) {
    assert.equal(finalRace.departementId, departments[1]);
    assert.equal(finalRace.circuits[0].valideurId, null);
  } else {
    assert.equal(finalRace.departementId, departments[0]);
    assert.equal(finalRace.circuits[0].valideurId, accounts[0]);
  }
  const audit = await db.auditLog.findMany({
    where: { entite: 'Courrier', entiteId: created.id },
    orderBy: { createdAt: 'asc' },
  });
  assert.ok(audit.some((a) => JSON.parse(a.details).apres.departementId === departments[1]));
  assert.ok(!JSON.stringify(audit).includes(body.objet));
  const proof = {
    date: new Date().toISOString(),
    passed: true,
    twoDepartments: true,
    unassignedHeadRejected: true,
    detailListCountPrintApprovalScoped: true,
    ownDepartmentCreation: true,
    wrongDepartmentCreationRejected: true,
    unknownDepartmentRejected: true,
    reroutingBeforeApprovalRevokesFormerAccess: true,
    reroutingAfterApprovalRejected: true,
    concurrentReroutingAndApprovalStatuses: statuses,
    concurrentRecipientAndApproverConsistent: true,
    centralMailNotBroadcastToHeads: true,
    auditWithoutFreeText: true,
    sessionsSource: session.fixtureSource,
    httpLoginRouteQualified: false,
    productionUntouched: true,
  };
  fs.writeFileSync('../audit/recommandations-2026-10-06/courrier-departements.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.courrier.deleteMany({ where: { id: { in: letters } } });
    await db.user.deleteMany({ where: { id: { in: accounts } } });
    await db.departement.deleteMany({ where: { id: { in: departments } } });
    await db.$disconnect();
  });
