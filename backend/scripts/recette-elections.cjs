/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { ecrirePreuve } = require('./preuves.cjs');
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

const report = { date: new Date().toISOString(), base: url.pathname, statut: 'en_cours', scenarios: [] };
let electionId;
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
  const { ADMIN: admin, SCOLARITE: school, ETUDIANT: student, ENSEIGNANT: teacher } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  const now = Date.now();
  const dto = {
    titre: 'QA Élections concurrence',
    type: 'CLUB',
    dateOuverture: new Date(now - 60000).toISOString(),
    dateCloture: new Date(now + 3600000).toISOString(),
    nbSieges: 1,
  };
  electionId = (await call(admin, 'POST', '/elections', dto, 201)).data.id;
  await call(student, 'PUT', '/elections/' + electionId, { titre: 'Modification tiers' }, 403);
  await call(admin, 'PUT', '/elections/' + electionId, { dateCloture: new Date(now - 120000).toISOString() }, 400);
  await call(school, 'POST', '/elections/' + electionId + '/ouvrir', {}, 400);
  const candidates = [];
  for (let i = 0; i < 2; i++)
    candidates.push(
      (
        await call(
          admin,
          'POST',
          '/elections/' + electionId + '/candidats',
          { nom: 'Recette', prenom: 'Candidat ' + i },
          201,
        )
      ).data,
    );
  const opening = await Promise.all(
    Array.from({ length: 4 }, () => call(school, 'POST', '/elections/' + electionId + '/ouvrir', {}, null)),
  );
  assert.deepEqual(opening.map((x) => x.status).sort(), [201, 400, 400, 400]);
  report.ouvertures = opening.map((x) => x.status);
  await call(admin, 'GET', '/elections/' + electionId + '/resultats', null, 404);
  await call(admin, 'POST', '/elections/' + electionId + '/candidats', { nom: 'Tardif', prenom: 'Recette' }, 400);
  const vote = { electionId, bulletin: [{ candidatId: candidates[0].id }] };
  await call(student, 'POST', '/elections/vote', { electionId, bulletin: [] }, 400);
  await call(
    student,
    'POST',
    '/elections/vote',
    { electionId, bulletin: candidates.map((c) => ({ candidatId: c.id })) },
    400,
  );
  const deposits = await Promise.all(
    Array.from({ length: 4 }, () => call(student, 'POST', '/elections/vote', vote, null)),
  );
  assert.deepEqual(deposits.map((x) => x.status).sort(), [201, 409, 409, 409]);
  report.depots = deposits.map((x) => x.status);
  await call(teacher, 'POST', '/elections/vote', vote, 201);
  const closures = await Promise.all(
    Array.from({ length: 4 }, () => call(admin, 'POST', '/elections/' + electionId + '/clore', {}, null)),
  );
  assert.deepEqual(closures.map((x) => x.status).sort(), [201, 400, 400, 400]);
  report.clotures = closures.map((x) => x.status);
  await call(session.sessions.ETUDIANT_AUTRE, 'POST', '/elections/vote', vote, 400);
  const proclamations = await Promise.all(
    Array.from({ length: 4 }, () => call(school, 'POST', '/elections/' + electionId + '/proclamer', {}, null)),
  );
  assert.deepEqual(proclamations.map((x) => x.status).sort(), [201, 400, 400, 400]);
  report.proclamations = proclamations.map((x) => x.status);
  const results = (await call(student, 'GET', '/elections/' + electionId + '/resultats')).data;
  assert.equal(await db.voteElection.count({ where: { electionId } }), 2);
  assert.equal((await db.election.findUnique({ where: { id: electionId } })).statut, 'PROCLAME');
  const logs = await db.auditLog.findMany({ where: { entiteId: electionId } });
  for (const action of ['ELECTION_OUVERTE', 'ELECTION_CLOSE', 'ELECTION_PROCLAMEE'])
    assert.equal(logs.filter((l) => l.action === action).length, 1);
  for (const l of logs)
    for (const key of ['electeurId', 'scrutinId', 'ipAppareil', 'candidatId'])
      assert.ok(!l.details.includes('"' + key + '"'));
  report.resultats = results;
  report.scenarios = [
    'Dates modifiées incohérentes refusées',
    'Ouverture sans candidat refusée',
    'Rôle étudiant interdit aux modifications',
    'Transitions concurrentes : une seule écriture et trace',
    'Bulletin vide et trop de choix refusés',
    'Un seul bulletin pour quatre dépôts simultanés',
    'Vote enseignant autorisé selon la règle existante',
    'Vote après clôture refusé',
    'Deux voix persistées et résultat proclamé',
    'Journal des transitions sans identité ni choix électoral',
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
    if (electionId) {
      const candidates = await db.candidatElection.findMany({ where: { electionId }, select: { id: true } });
      await db.voteElection.deleteMany({ where: { electionId } });
      await db.auditLog.deleteMany({ where: { entiteId: { in: [electionId, ...candidates.map((c) => c.id)] } } });
      await db.candidatElection.deleteMany({ where: { electionId } });
      await db.election.delete({ where: { id: electionId } });
      assert.equal(await db.election.count({ where: { id: electionId } }), 0);
      report.fixturesSupprimees = true;
    }
    report.limites = [
      'Pas de scrutin réel ni validation humaine des règles électorales',
      'Impression physique non qualifiée',
      'Route HTTP de connexion non qualifiée par cette fixture',
    ];
    ecrirePreuve('elections.json', report);
    await db.$disconnect();
    console.log(
      JSON.stringify({ statut: report.statut, erreur: report.erreur, fixturesSupprimees: report.fixturesSupprimees }),
    );
  });
