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

const report = { date: new Date().toISOString(), statut: 'en_cours' };
let equipmentId;
const tickets = [];
async function call(token, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (expected !== null) assert.equal(r.status, expected, method + ' ' + path + ': ' + text.slice(0, 160));
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function main() {
  const { ADMIN: admin, ENSEIGNANT: teacher, ETUDIANT: student } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  equipmentId = (
    await call(
      admin,
      'POST',
      '/equipements',
      { libelle: 'QA concurrence helpdesk ' + randomUUID(), emplacement: 'Salle QA' },
      201,
    )
  ).data.id;
  async function ticket() {
    const t = (
      await call(
        teacher,
        'POST',
        '/tickets',
        { equipementId: equipmentId, categorie: 'VIDEO', description: 'Description confidentielle QA' },
        201,
      )
    ).data;
    tickets.push(t.id);
    return t.id;
  }
  const id = await ticket();
  await call(student, 'GET', '/tickets/' + id, null, 404);
  await call(teacher, 'POST', '/tickets/' + id + '/statut', { statut: 'RESOLU' }, 403);
  const resolutions = await Promise.all(
    Array.from({ length: 4 }, () => call(admin, 'POST', '/tickets/' + id + '/statut', { statut: 'RESOLU' }, null)),
  );
  assert.deepEqual(resolutions.map((x) => x.status).sort(), [201, 400, 400, 400]);
  report.resolutions = resolutions.map((x) => x.status);
  assert.equal((await db.ticketSupport.findUniqueOrThrow({ where: { id } })).statut, 'RESOLU');
  await call(admin, 'POST', '/tickets/' + id + '/statut', { statut: 'EN_COURS' }, 400);
  const raceId = await ticket();
  const race = await Promise.all(
    ['RESOLU', 'EN_COURS'].map((statut) => call(admin, 'POST', '/tickets/' + raceId + '/statut', { statut }, null)),
  );
  assert.equal(race[0].status, 201);
  assert.ok([201, 400].includes(race[1].status));
  const final = await db.ticketSupport.findUniqueOrThrow({ where: { id: raceId } });
  assert.equal(final.statut, 'RESOLU');
  assert.ok(final.traiteLe);
  report.resolutionEtPriseEnCharge = race.map((x) => x.status);
  for (const ticketId of tickets) {
    const logs = await db.auditLog.findMany({ where: { entiteId: ticketId } });
    assert.equal(logs.filter((l) => l.action === 'TICKET_RESOLU').length, 1);
    for (const l of logs) assert.ok(!l.details.includes('Description confidentielle QA'));
  }
  report.statut = 'valide';
  report.observations = [
    'Une résolution parmi quatre demandes simultanées',
    'Résolution et prise en charge concurrentes : état terminal RESOLU conservé',
    'Une seule trace de résolution par ticket',
    'Lecture tiers et traitement enseignant refusés',
    'Description absente du journal',
  ];
}
main()
  .catch((e) => {
    report.statut = 'echec';
    report.erreur = e.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.auditLog.deleteMany({ where: { entiteId: { in: [...tickets, ...(equipmentId ? [equipmentId] : [])] } } });
    await db.ticketSupport.deleteMany({ where: { id: { in: tickets } } });
    if (equipmentId) await db.equipementCampus.delete({ where: { id: equipmentId } });
    report.fixturesRestantes = await db.ticketSupport.count({ where: { id: { in: tickets } } });
    assert.equal(report.fixturesRestantes, 0);
    report.productionUntouched = true;
    fs.writeFileSync(
      '../audit/recommandations-2026-10-06/helpdesk-concurrence-http.json',
      JSON.stringify(report, null, 2) + '\n',
    );
    await db.$disconnect();
    console.log(
      JSON.stringify({ statut: report.statut, erreur: report.erreur, fixturesRestantes: report.fixturesRestantes }),
    );
  });
