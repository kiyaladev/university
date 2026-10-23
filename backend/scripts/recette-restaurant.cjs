/** Recette restaurant sur base fictive explicitement identifiée. */
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
let userId, etudiantId;
async function request(token, method, route, body, status = 200) {
  const response = await fetch(api + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const content = await response.text();
  assert.equal(response.status, status, `${method} ${route}: ${content.slice(0, 300)}`);
  return JSON.parse(content);
}
async function login(email, password) {
  return (await request(null, 'POST', '/auth/login', { email, password }, 201)).token;
}
async function simultaneous(token, route, body) {
  return Promise.all(
    [1, 2].map(async () => {
      const response = await fetch(api + route, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }),
  );
}
async function main() {
  const adminAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const admin = await login(adminAccount.email, 'Passer@2026');
  assert.equal((await request(admin, 'GET', '/auth/me')).id, adminAccount.id);
  const seed = await prisma.user.findUniqueOrThrow({ where: { email: 'etudiant1@university.gn' } });
  const tag = 'QA-RESTO-' + randomUUID();
  const user = await prisma.user.create({
    data: {
      email: tag.toLowerCase() + '@example.invalid',
      password: seed.password,
      nom: 'Recette',
      prenom: 'Restaurant',
      role: 'ETUDIANT',
    },
  });
  userId = user.id;
  const student = await prisma.etudiant.create({
    data: { matricule: tag, nom: 'Recette', prenom: 'Restaurant', userId },
  });
  etudiantId = student.id;
  const studentToken = await login(user.email, 'Etu#2026');
  const wallet = await request(studentToken, 'GET', '/portail/resto/me');
  assert.equal(wallet.solde, 0);
  await request(studentToken, 'GET', '/resto/portefeuilles', null, 403);
  const cash = await request(
    admin,
    'POST',
    `/resto/portefeuilles/${wallet.id}/recharger`,
    { montant: 10000, mode: 'ESPECES' },
    201,
  );
  assert.equal(cash.solde, 10000);
  assert.equal(cash.recharge.statut, 'REUSSI');
  assert.equal(cash.paiement.statut, 'REUSSI');
  await request(null, 'GET', '/resto/carte/' + tag, null, 401);
  await request(studentToken, 'GET', '/resto/carte/' + tag, null, 403);
  const debits = await simultaneous(admin, '/resto/valider', { reference: tag, repas: 'DEJEUNER', montant: 7000 });
  assert.deepEqual(debits.map((r) => r.status).sort(), [201, 409]);
  const balance = () => prisma.portefeuilleResto.findUniqueOrThrow({ where: { id: wallet.id } });
  assert.equal((await balance()).solde, 3000);
  const meal = await prisma.consommationResto.findFirstOrThrow({
    where: { portefeuilleId: wallet.id, statut: 'VALIDEE' },
  });
  await request(studentToken, 'POST', `/resto/consommations/${meal.id}/annuler`, {}, 403);
  const refunds = await simultaneous(admin, `/resto/consommations/${meal.id}/annuler`, { motif: 'Annulation fictive' });
  assert.deepEqual(refunds.map((r) => r.status).sort(), [201, 400]);
  assert.equal((await balance()).solde, 10000);
  const pending = await request(
    studentToken,
    'POST',
    '/portail/resto/recharger',
    { montant: 5000, operateur: 'ORANGE_MONEY' },
    201,
  );
  assert.equal(pending.recharge.statut, 'EN_ATTENTE');
  assert.equal(pending.paiement.statut, 'EN_ATTENTE');
  assert.equal((await balance()).solde, 10000);
  await request(studentToken, 'POST', `/resto/recharges/${pending.recharge.id}/simuler`, { statut: 'REUSSI' }, 403);
  const confirmations = await simultaneous(admin, `/resto/recharges/${pending.recharge.id}/simuler`, {
    statut: 'REUSSI',
  });
  assert.ok(confirmations.some((r) => r.status === 201));
  assert.ok(confirmations.every((r) => [201, 400].includes(r.status)));
  await request(admin, 'POST', `/resto/recharges/${pending.recharge.id}/simuler`, { statut: 'REUSSI' }, 201);
  assert.equal((await balance()).solde, 15000);
  assert.equal((await prisma.paiement.findUniqueOrThrow({ where: { id: pending.paiement.id } })).statut, 'REUSSI');
  assert.equal(await prisma.auditLog.count({ where: { entiteId: meal.id, action: 'REPAS_ANNULE' } }), 1);
  assert.equal(
    await prisma.auditLog.count({ where: { entiteId: pending.recharge.id, action: 'RECHARGE_CONFIRMEE' } }),
    1,
  );
  const staffPending = await request(
    admin,
    'POST',
    `/resto/portefeuilles/${wallet.id}/recharger`,
    { montant: 1000, mode: 'MOBILE_MONEY', simuler: false },
    201,
  );
  assert.equal(staffPending.recharge.statut, 'EN_ATTENTE');
  const observations = {
    debitStatuses: debits.map((r) => r.status).sort(),
    refundStatuses: refunds.map((r) => r.status).sort(),
    confirmationStatuses: confirmations.map((r) => r.status).sort(),
    finalBalance: 15000,
    pendingResponseBalance: staffPending.solde,
    providerCalled: false,
  };
  // Le contrat doit conserver le solde existant lors d'une demande en attente.
  assert.equal(staffPending.solde, 15000, 'solde retourné lors de la recharge en attente');
  await request(
    admin,
    'POST',
    `/resto/portefeuilles/${wallet.id}/recharger`,
    { montant: 1000, mode: 'MOBILE_MONEY', simuler: 'false' },
    400,
  );
  assert.equal((await balance()).solde, 15000);
  const report = {
    date: new Date().toISOString(),
    database: database.pathname.slice(1),
    observations,
    checks: [
      'crédit espèces persisté',
      'débits concurrents sans découvert',
      'remboursement unique',
      'demande portail en attente sans crédit',
      'confirmation manuelle réservée à la caisse et crédit unique',
      'booléen de simulation strict',
      'accès guichet et registre réservés',
    ],
    productionUntouched: true,
    externalMobileMoneyAcceptancePending: true,
  };
  if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (etudiantId) await prisma.etudiant.delete({ where: { id: etudiantId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
