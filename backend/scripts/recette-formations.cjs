/** Inscription et confirmation manuelle sur la base QA fictive uniquement. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
let formationId;
const failures = [];
async function call(token, method, route, body) {
  const response = await fetch(api + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const content = await response.text();
  return {
    status: response.status,
    body: response.headers.get('content-type')?.includes('json') ? JSON.parse(content) : content,
  };
}
async function request(token, method, route, body, status = 200) {
  const r = await call(token, method, route, body);
  assert.equal(r.status, status, `${method} ${route}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body;
}
async function login(email, password) {
  return (await request(null, 'POST', '/auth/login', { email, password }, 201)).token;
}
async function main() {
  const account = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const admin = await login(account.email, 'Passer@2026');
  assert.equal((await request(admin, 'GET', '/auth/me')).id, account.id);
  const student = await login('etudiant1@university.gn', 'Etu#2026');
  const tag = 'QA-FORMATION-' + randomUUID();
  const formation = await request(
    admin,
    'POST',
    '/formations',
    { titre: tag, prix: 5000, capacite: 1, dureeHeures: 8 },
    201,
  );
  formationId = formation.id;
  await request(null, 'GET', '/formations/publiques/' + formationId, null, 404);
  await request(student, 'POST', `/formations/${formationId}/publier`, {}, 403);
  const publications = await Promise.all(
    [1, 2].map(() => call(admin, 'POST', `/formations/${formationId}/publier`, {})),
  );
  const publicationStatuses = publications.map((r) => r.status).sort();
  if (JSON.stringify(publicationStatuses) !== '[201,400]') failures.push('double publication acceptée');
  const publicFormation = await request(null, 'GET', '/formations/publiques/' + formationId);
  assert.equal(publicFormation.placesRestantes, 1);
  assert.equal(publicFormation.creeParId, undefined);
  const candidates = [];
  for (const suffix of ['A', 'B', 'C'])
    candidates.push(
      await request(
        null,
        'POST',
        `/formations/${formationId}/inscription`,
        { nomComplet: tag + '-' + suffix, telephone: '+224600000000' },
        201,
      ),
    );
  await request(student, 'GET', `/formations/${formationId}/inscriptions`, null, 403);
  await request(null, 'GET', `/formations/${candidates[0].inscriptionId}/certificat`, null, 401);
  await request(admin, 'GET', `/formations/${candidates[0].inscriptionId}/certificat`, null, 400);
  await request(student, 'POST', `/formations/inscriptions/${candidates[0].inscriptionId}/confirmer`, {}, 403);
  const confirmations = await Promise.all(
    candidates.slice(0, 2).map((c) => call(admin, 'POST', `/formations/inscriptions/${c.inscriptionId}/confirmer`, {})),
  );
  const confirmationStatuses = confirmations.map((r) => r.status).sort();
  assert.deepEqual(confirmationStatuses, [201, 409]);
  const accepted = candidates[confirmations.findIndex((r) => r.status === 201)];
  const rejected = candidates[confirmations.findIndex((r) => r.status === 409)];
  assert.equal(await prisma.inscriptionFormation.count({ where: { formationId, statut: 'CONFIRME' } }), 1);
  await request(admin, 'POST', `/formations/inscriptions/${accepted.inscriptionId}/confirmer`, {}, 201);
  const paid = await prisma.inscriptionFormation.findUniqueOrThrow({
    where: { id: accepted.inscriptionId },
    include: { paiement: true },
  });
  assert.equal(paid.paiement.statut, 'REUSSI');
  assert.equal(paid.paiement.montant, 5000);
  assert.equal((await request(null, 'GET', '/formations/publiques/' + formationId)).placesRestantes, 0);
  const certificate = await request(admin, 'GET', `/formations/${accepted.inscriptionId}/certificat`);
  assert.ok(certificate.includes(accepted.numero));
  assert.ok(certificate.includes("Confirmation d'inscription"));
  assert.ok(!certificate.includes('a suivi'));
  await request(student, 'GET', `/formations/${accepted.inscriptionId}/certificat`, null, 403);
  await request(admin, 'PUT', '/formations/' + formationId, { prix: 10000 }, 409);
  await request(admin, 'POST', `/formations/inscriptions/${accepted.inscriptionId}/annuler`, {}, 409);
  await request(admin, 'DELETE', '/formations/' + formationId, null, 403);
  const cancellations = await Promise.all(
    [1, 2].map(() => call(admin, 'POST', `/formations/inscriptions/${rejected.inscriptionId}/annuler`, {})),
  );
  assert.deepEqual(cancellations.map((r) => r.status).sort(), [201, 409]);
  const closures = await Promise.all([1, 2].map(() => call(admin, 'POST', `/formations/${formationId}/cloturer`, {})));
  const closureStatuses = closures.map((r) => r.status).sort();
  if (JSON.stringify(closureStatuses) !== '[201,400]') failures.push('double clôture acceptée');
  await request(admin, 'POST', `/formations/inscriptions/${candidates[2].inscriptionId}/confirmer`, {}, 409);
  await request(null, 'GET', '/formations/publiques/' + formationId, null, 404);
  await request(admin, 'PUT', '/formations/' + formationId, { lieu: 'Autre lieu' }, 400);
  await request(admin, 'POST', `/formations/${formationId}/publier`, {}, 400);
  const dashboard = await request(admin, 'GET', '/formations/dashboard');
  assert.equal(dashboard.parFormation.find((f) => f.id === formationId).recette, 5000);
  const journal = await prisma.auditLog.findMany({
    where: { entiteId: { in: [formationId, ...candidates.map((c) => c.inscriptionId)] } },
  });
  const freeTextAbsent = journal.every((row) => !row.details.includes(tag) && !row.details.includes('+224600000000'));
  if (!freeTextAbsent) failures.push('nom ou contenu libre recopié dans le journal');
  const confirmationAuditCount = journal.filter((row) => row.action === 'FORMATION_CONFIRMEE').length;
  assert.equal(confirmationAuditCount, 1);
  const report = {
    date: new Date().toISOString(),
    database: database.pathname.slice(1),
    passed: failures.length === 0,
    failures,
    observations: {
      publicationStatuses,
      confirmationStatuses,
      closureStatuses,
      confirmationAuditCount,
      finalConfirmedCount: 1,
      paidAmount: 5000,
      revenue: 5000,
      freeTextAbsent,
      protectedCertificateRead: true,
    },
    productionUntouched: true,
    operatorCalled: false,
    educationalCompletionAcceptancePending: true,
  };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (failures.length) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (formationId) {
      const inscriptions = await prisma.inscriptionFormation.findMany({
        where: { formationId },
        select: { paiementId: true },
      });
      await prisma.inscriptionFormation.deleteMany({ where: { formationId } });
      await prisma.paiement.deleteMany({
        where: { id: { in: inscriptions.map((i) => i.paiementId).filter(Boolean) } },
      });
      await prisma.formation.delete({ where: { id: formationId } });
    }
    await prisma.$disconnect();
  });
