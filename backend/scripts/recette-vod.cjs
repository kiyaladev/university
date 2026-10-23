/** Recette VOD sur base fictive ; médias externes jamais téléchargés. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
if (!process.env.QA_ENV_FILE) throw Error('QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname));
assert.equal(env.PORT, '15041');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const created = [],
  failures = [];
async function call(token, method, route, body) {
  const response = await fetch(api + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
async function request(token, method, route, body, status = 200) {
  const response = await call(token, method, route, body);
  assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(response.body).slice(0, 250)}`);
  return response.body;
}
async function login(email, password) {
  return (await request(null, 'POST', '/auth/login', { email, password }, 201)).token;
}
async function main() {
  const account = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const admin = await login(account.email, 'Passer@2026');
  assert.equal((await request(admin, 'GET', '/auth/me')).id, account.id);
  const teacher = await login('enseignant@unipresence.gn', 'Passer@2026');
  const student = await login('etudiant1@university.gn', 'Etu#2026');
  const studentProfile = await request(student, 'GET', '/auth/me');
  const etudiant = await prisma.etudiant.findUniqueOrThrow({ where: { userId: studentProfile.id } });
  const inscription = await prisma.inscription.findFirstOrThrow({ where: { etudiantId: etudiant.id } });
  const otherInscription = await prisma.inscription.findFirstOrThrow({ where: { etudiantId: { not: etudiant.id } } });
  assert.notEqual(inscription.etudiantId, otherInscription.etudiantId);
  const tag = 'QA-VOD-' + randomUUID();
  const data = {
    titre: tag,
    description: 'Description fictive confidentielle',
    transcription: 'Transcription fictive confidentielle',
    type: 'VIDEO',
    url: 'https://example.invalid/media.mp4?token=QA-SECRET',
    dureeSecondes: 100,
    public: false,
    inscriptionId: inscription.id,
  };
  const create = async (token, body) => {
    const vod = await request(token, 'POST', '/vod', body, 201);
    created.push(vod.id);
    return vod;
  };
  const own = await create(teacher, data);
  const foreign = await create(admin, { ...data, titre: tag + '-foreign', inscriptionId: otherInscription.id });
  const publicCourse = await create(teacher, {
    ...data,
    titre: tag + '-public',
    inscriptionId: undefined,
    public: true,
  });
  assert.equal(own.statut, 'BROUILLON');
  await request(null, 'GET', '/vod/' + own.id, null, 401);
  await request(student, 'GET', '/vod/' + own.id, null, 404);
  await request(student, 'POST', '/vod', data, 403);
  await request(teacher, 'PUT', '/vod/' + foreign.id, { titre: tag + '-forbidden' }, 403);
  await request(teacher, 'GET', `/vod/${foreign.id}/stats`, null, 404);
  const publications = await Promise.all([1, 2].map(() => call(teacher, 'POST', `/vod/${own.id}/publier`, {})));
  const publicationStatuses = publications.map((r) => r.status).sort();
  if (JSON.stringify(publicationStatuses) !== '[201,400]') failures.push('double publication acceptée');
  await request(teacher, 'POST', `/vod/${publicCourse.id}/publier`, {}, 201);
  await request(admin, 'POST', `/vod/${foreign.id}/publier`, {}, 201);
  await request(student, 'GET', '/vod/' + own.id);
  await request(student, 'GET', '/vod/' + foreign.id, null, 404);
  const catalogue = await request(student, 'GET', '/vod/ma-collecte');
  assert.ok(catalogue.some((v) => v.id === own.id) && catalogue.some((v) => v.id === publicCourse.id));
  assert.ok(!catalogue.some((v) => v.id === foreign.id));
  const search = await request(student, 'GET', '/vod/recherche?q=' + encodeURIComponent(tag));
  assert.ok(search.some((v) => v.id === own.id) && !search.some((v) => v.id === foreign.id));
  await request(student, 'GET', `/vod/${own.id}/stats`, null, 403);
  await request(
    student,
    'POST',
    `/vod/${own.id}/vue`,
    { positionSecondes: 20, dureeSecondes: 100, termine: false },
    201,
  );
  await request(student, 'POST', `/vod/${own.id}/vue`, { positionSecondes: 95, dureeSecondes: 100 }, 201);
  const progression = (await request(student, 'GET', '/vod/ma-collecte')).find((v) => v.id === own.id);
  assert.equal(progression.dernierePosition, 95);
  assert.equal(progression.termine, true);
  const concurrentViews = await Promise.all(
    [40, 50].map((positionSecondes) =>
      request(student, 'POST', `/vod/${own.id}/vue`, { positionSecondes, dureeSecondes: 100 }, 201),
    ),
  );
  const stats = await request(teacher, 'GET', `/vod/${own.id}/stats`);
  assert.equal(stats.vod.nbVues, 4);
  assert.equal(stats.calcules.nbVues, 4);
  assert.equal(stats.vod.nbComplets, 1);
  assert.equal(stats.calcules.nbComplets, 1);
  const badView = await call(student, 'POST', `/vod/${own.id}/vue`, {
    positionSecondes: 10,
    dureeSecondes: 100,
    termine: 'false',
  });
  if (badView.status !== 400) failures.push('chaîne de fin de lecture acceptée');
  const badPublic = await call(teacher, 'POST', '/vod', { ...data, titre: tag + '-bool', public: 'false' });
  if (badPublic.status === 201) created.push(badPublic.body.id);
  if (badPublic.status !== 400) failures.push('chaîne de confidentialité acceptée');
  const archives = await Promise.all(
    [1, 2].map(() => call(teacher, 'POST', `/vod/${own.id}/archiver`, { motif: 'Motif fictif confidentiel' })),
  );
  const archiveStatuses = archives.map((r) => r.status).sort();
  if (JSON.stringify(archiveStatuses) !== '[201,400]') failures.push('double archivage accepté');
  await request(student, 'GET', '/vod/' + own.id, null, 404);
  await request(student, 'POST', `/vod/${own.id}/vue`, { positionSecondes: 99, dureeSecondes: 100 }, 404);
  await request(teacher, 'POST', `/vod/${own.id}/publier`, {}, 400);
  const archiveEdit = await call(teacher, 'PUT', '/vod/' + own.id, { titre: tag + '-after-archive' });
  if (archiveEdit.status !== 400) failures.push('archive modifiable');
  const journal = await prisma.auditLog.findMany({ where: { entiteId: { in: created } } });
  for (const row of journal)
    for (const text of [tag, 'confidentielle', 'QA-SECRET', 'media.mp4', 'Motif fictif', studentProfile.id])
      assert.ok(!row.details.includes(text), 'contenu ou lecteur dans le journal');
  const publicationAuditCount = journal.filter((row) => row.entiteId === own.id && row.action === 'VOD_PUBLIE').length;
  const archiveAuditCount = journal.filter((row) => row.entiteId === own.id && row.action === 'VOD_ARCHIVE').length;
  if (publicationAuditCount !== 1 || archiveAuditCount !== 1) failures.push('traces de transition dupliquées');
  const report = {
    date: new Date().toISOString(),
    database: database.pathname.slice(1),
    passed: failures.length === 0,
    failures,
    observations: {
      publicationStatuses,
      archiveStatuses,
      publicationAuditCount,
      archiveAuditCount,
      stringBooleanStatuses: [badPublic.status, badView.status],
      archivedEditStatus: archiveEdit.status,
      viewsBeforeMalformedRequest: stats.calcules.nbVues,
      completeViewsBeforeMalformedRequest: stats.calcules.nbComplets,
      concurrentViewCounts: concurrentViews.map((v) => v.nbVues).sort(),
      latestPositionBeforeConcurrentViews: progression.dernierePosition,
      privateForeignResourceAbsent: true,
      journalContentAbsent: true,
    },
    productionUntouched: true,
    mediaDownloaded: false,
    realMediaAndHumanAcceptancePending: true,
  };
  if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (failures.length) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.coursVOD.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });
