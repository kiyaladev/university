/** Régie : émissions, encaissements et indicateurs sur la seule base QA. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
assert.ok(process.env.QA_ENV_FILE, 'QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(env.PORT, '15041');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const tag = 'QA-REGIE-' + randomUUID();
const ids = [],
  payments = [];
async function request(token, method, route, body, status = 200) {
  const response = await fetch(api + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${route}: ${text.slice(0, 200)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
async function main() {
  const session = process.env.QA_SESSION_FILE ? JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE, 'utf8')) : null;
  if (session) {
    assert.equal(session.api, api);
    assert.equal(session.database, database.pathname);
  }
  const admin =
    session?.token ??
    (await request(null, 'POST', '/auth/login', { email: 'admin@unipresence.gn', password: 'Passer@2026' }, 201)).token;
  const account = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  assert.equal((await request(admin, 'GET', '/auth/me')).id, account.id);
  if (!session) {
    fs.writeFileSync(
      '/tmp/university-recommandations-qa-session.json',
      JSON.stringify({ api, database: database.pathname, token: admin, fixtureSource: 'POST /auth/login' }),
      { mode: 0o600 },
    );
    fs.chmodSync('/tmp/university-recommandations-qa-session.json', 0o600);
  }
  await request(null, 'GET', '/recettes/dashboard', null, 401);
  const before = await request(admin, 'GET', '/recettes/dashboard');
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    type: 'AUTRE',
    date: today,
    libelle: 'Prestation fictive',
    client: 'Client QA privé',
    description: 'Description QA privée',
  };
  async function create(suffix, montant, fields = {}) {
    const receipt = await request(
      admin,
      'POST',
      '/recettes',
      { ...base, numero: tag + suffix, montant, ...fields },
      201,
    );
    ids.push(receipt.id);
    return receipt;
  }
  const cash = await create('-CASH', 1000);
  const unpaid = await create('-UNPAID', 500);
  const roleChecks = {};
  if (session?.sessions) {
    const { DIRECTION: direction, SCOLARITE: scolarite, ETUDIANT: student } = session.sessions;
    assert.ok(direction && scolarite && student);
    await request(student, 'GET', '/recettes', null, 403);
    await request(student, 'GET', '/recettes/dashboard', null, 403);
    await request(scolarite, 'GET', '/recettes/dashboard', null, 403);
    await request(direction, 'GET', '/recettes/dashboard');
    await request(direction, 'POST', '/recettes', { ...base, numero: tag + '-INTERDIT', montant: 250 }, 403);
    await request(direction, 'POST', `/recettes/${unpaid.id}/encaisser`, {}, 403);
    const roleReceipt = await request(
      scolarite,
      'POST',
      '/recettes',
      { ...base, numero: tag + '-SCOLARITE', montant: 250, date: `${new Date().getUTCFullYear() - 1}-01-01` },
      201,
    );
    ids.push(roleReceipt.id);
    const roleCollection = await request(scolarite, 'POST', `/recettes/${roleReceipt.id}/encaisser`, {}, 201);
    payments.push(roleCollection.paiementId);
    Object.assign(roleChecks, {
      studentReadsRejected: true,
      scolariteDashboardRejected: true,
      directionDashboardAllowed: true,
      directionCreationAndCollectionRejected: true,
      scolariteCreationAndCollectionAllowed: true,
    });
  }
  await create('-USD', 9000, { devise: 'USD' });
  await create('-PAST', 8000, { date: `${new Date().getUTCFullYear() - 1}-01-01` });
  await request(admin, 'POST', '/recettes', { ...base, numero: cash.numero, montant: 1000 }, 409);
  const afterEmission = await request(admin, 'GET', '/recettes/dashboard');
  assert.equal(afterEmission.totalAnnee, before.totalAnnee + 1500);
  assert.equal(afterEmission.totalMois, before.totalMois + 1500);
  assert.equal(
    afterEmission.parMois.reduce((n, row) => n + row.total, 0),
    afterEmission.totalAnnee,
  );
  await request(admin, 'PUT', `/recettes/${cash.id}`, { montant: 1250 });
  const statuses = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const response = await fetch(api + `/recettes/${cash.id}/encaisser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
        body: '{}',
      });
      await response.text();
      return response.status;
    }),
  );
  assert.deepEqual(statuses.sort(), [201, 409, 409, 409]);
  const persisted = await prisma.recetteExterne.findUniqueOrThrow({
    where: { id: cash.id },
    include: { paiement: true },
  });
  payments.push(persisted.paiementId);
  assert.equal(persisted.paiement.montant, 1250);
  assert.equal(persisted.paiement.devise, 'GNF');
  assert.equal(persisted.paiement.statut, 'REUSSI');
  assert.equal(persisted.paiement.mode, 'ESPECES');
  assert.equal(persisted.paiement.creeParId, account.id);
  assert.equal(
    await prisma.paiement.count({ where: { motif: { startsWith: 'Recette externe ' + cash.numero + ' —' } } }),
    1,
  );
  for (const fields of [
    { montant: 2000 },
    { devise: 'USD' },
    { type: 'LOCATION_AMPHI' },
    { date: `${new Date().getUTCFullYear() - 1}-01-01` },
  ]) {
    await request(admin, 'PUT', `/recettes/${cash.id}`, fields, 409);
  }
  await request(admin, 'PUT', `/recettes/${cash.id}`, { description: 'Correction documentaire privée' });
  await request(admin, 'POST', `/paiements/${persisted.paiementId}/annuler`, { motif: 'Annulation de recette' }, 400);
  const toCollect = await request(
    admin,
    'GET',
    '/recettes?' + new URLSearchParams({ search: tag, paiementStatut: 'A_ENCAISSER', all: '1' }),
  );
  assert.ok(toCollect.data.some((r) => r.id === unpaid.id));
  assert.ok(!toCollect.data.some((r) => r.id === cash.id));
  const collected = await request(
    admin,
    'GET',
    '/recettes?' + new URLSearchParams({ search: tag, paiementStatut: 'REUSSI', all: '1' }),
  );
  assert.ok(collected.data.some((r) => r.id === cash.id));
  assert.ok(collected.data.every((r) => r.paiement.statut === 'REUSSI'));
  const afterCollection = await request(admin, 'GET', '/recettes/dashboard');
  assert.equal(afterCollection.totalAnnee, before.totalAnnee + 1750);
  assert.equal(afterCollection.totalMois, before.totalMois + 1750);
  const audits = await prisma.auditLog.findMany({ where: { entiteId: cash.id } });
  assert.equal(audits.filter((a) => a.action === 'RECETTE_ENCAISSEE').length, 1);
  assert.ok(
    audits.every(
      (a) => !a.details?.includes('Client QA privé') && !a.details?.includes('Correction documentaire privée'),
    ),
  );
  const report = {
    date: new Date().toISOString(),
    database: database.pathname.slice(1),
    passed: true,
    observations: {
      ...roleChecks,
      emittedGnFDelta: 1500,
      emittedGnFDeltaAfterAmountChange: 1750,
      otherCurrencyAndYearExcluded: true,
      monthlySumMatchesYear: true,
      concurrentCollectionStatuses: statuses,
      successfulLinkedPaymentsForConcurrentReceipt: 1,
      collectionAudits: 1,
      noOrphanPayment: true,
      accountingFieldsFrozen: true,
      documentaryCorrectionAllowed: true,
      cancellationOfSuccessfulPaymentRejected: true,
      paidAndUnpaidFiltersAgree: true,
      auditOmitsPrivateClientAndDescription: true,
    },
    sessionSource: session?.fixtureSource ?? 'POST /auth/login',
    indicatorDefinition: 'recettes émises, encaissées ou non, en GNF sur l’année civile de leur émission',
    cashMovementAndAccountingValidationPending: true,
    productionUntouched: true,
  };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.recetteExterne.deleteMany({ where: { numero: { startsWith: tag } } });
    await prisma.paiement.deleteMany({
      where: { OR: [{ id: { in: payments.filter(Boolean) } }, { motif: { startsWith: 'Recette externe ' + tag } }] },
    });
    await prisma.$disconnect();
  });
