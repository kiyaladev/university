/** Consolidation et instantané MESRS sur données QA fictives. */
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
let studentId, snapshotId;
async function request(token, method, route, body, status = 200) {
  const response = await fetch(api + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${route}: ${text.slice(0, 200)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
async function login(email, password) {
  return (await request(null, 'POST', '/auth/login', { email, password }, 201)).token;
}
async function main() {
  const account = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const admin = await login(account.email, 'Passer@2026');
  assert.equal((await request(admin, 'GET', '/auth/me')).id, account.id);
  const directionAccount = await prisma.user.findFirstOrThrow({ where: { role: 'DIRECTION', actif: true } });
  const direction = await login(directionAccount.email, 'Passer@2026');
  const studentToken = await login('etudiant1@university.gn', 'Etu#2026');
  const year = await prisma.anneeAcademique.findFirstOrThrow({ where: { active: true, cloturee: false } });
  const promotion = await prisma.promotion.findFirstOrThrow({ where: { anneeId: year.id } });
  const route = '/rectorat/chiffres?anneeId=' + year.id;
  await request(null, 'GET', route, null, 401);
  await request(studentToken, 'GET', route, null, 403);
  const before = await request(admin, 'GET', route);
  const tag = 'QA-RECTORAT-' + randomUUID();
  const student = await prisma.etudiant.create({ data: { matricule: tag, nom: 'Recette', prenom: 'Consolidation' } });
  studentId = student.id;
  const inscription = await prisma.inscription.create({
    data: { numero: tag, etudiantId: student.id, anneeId: year.id, promotionId: promotion.id, statut: 'VALIDE' },
  });
  const current = await request(direction, 'GET', route);
  assert.equal(current.effectifTotal, before.effectifTotal + 1);
  assert.equal(
    current.effectifParPromotion.reduce((n, p) => n + p.effectif, 0),
    current.effectifTotal,
  );
  await request(direction, 'POST', '/rectorat/bilan-mesrs/generer', { anneeId: year.id }, 403);
  const snapshot = await request(admin, 'POST', '/rectorat/bilan-mesrs/generer', { anneeId: year.id }, 201);
  snapshotId = snapshot.id;
  assert.equal(snapshot.donnees.effectifTotal, current.effectifTotal);
  assert.equal(snapshot.genereParId, account.id);
  await prisma.inscription.update({ where: { id: inscription.id }, data: { statut: 'ANNULE' } });
  const after = await request(admin, 'GET', route);
  assert.equal(after.effectifTotal, before.effectifTotal);
  const persisted = await prisma.statistiqueMesrs.findUniqueOrThrow({ where: { id: snapshot.id } });
  assert.equal(persisted.donnees.effectifTotal, current.effectifTotal);
  assert.notEqual(persisted.donnees.effectifTotal, after.effectifTotal);
  const list = await request(direction, 'GET', '/rectorat/bilan-mesrs?anneeId=' + year.id);
  assert.ok(list.some((s) => s.id === snapshot.id));
  const printRoute = `/rectorat/bilan-mesrs/${snapshot.id}/imprimer`;
  await request(null, 'GET', printRoute, null, 401);
  await request(studentToken, 'GET', printRoute, null, 403);
  const document = await request(direction, 'GET', printRoute);
  assert.ok(document.includes(year.libelle));
  assert.equal(
    await prisma.auditLog.count({ where: { entiteId: snapshot.id, action: 'BILAN_MESRS_GENERE', userId: account.id } }),
    1,
  );
  const report = {
    date: new Date().toISOString(),
    database: database.pathname.slice(1),
    passed: true,
    observations: {
      initialHeadcount: before.effectifTotal,
      snapshotHeadcount: current.effectifTotal,
      currentHeadcountAfterCancellation: after.effectifTotal,
      snapshotUnchanged: true,
      promotionTotalsAgree: true,
      generatorRoleRestricted: true,
      printRolesRestricted: true,
      generationAuditCount: 1,
    },
    productionUntouched: true,
    ministryTransmissionAndBusinessDefinitionsPending: true,
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
    if (snapshotId) await prisma.statistiqueMesrs.delete({ where: { id: snapshotId } });
    if (studentId) await prisma.etudiant.delete({ where: { id: studentId } });
    await prisma.$disconnect();
  });
