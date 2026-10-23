/** Contrôles de validité sur des identités exclusivement fictives en QA. */
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
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
let studentId, cardId, attestationId, badgeId, userId;
const observations = {};
async function concurrent(token, route, body) {
  const results = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const response = await fetch('http://127.0.0.1:15041/api' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      await response.text();
      return response.status;
    }),
  );
  return results.sort();
}
async function request(token, method, route, body, status = 200) {
  const response = await fetch('http://127.0.0.1:15041/api' + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${route.split('?')[0]}: ${text.slice(0, 200)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
async function main() {
  const admin = (
    await request(null, 'POST', '/auth/login', { email: 'admin@unipresence.gn', password: 'Passer@2026' }, 201)
  ).token;
  const adminAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const user = await prisma.user.create({
    data: {
      email: `qa-identite-${randomUUID()}@example.test`,
      password: adminAccount.password,
      nom: 'Recette',
      prenom: 'Validite',
      role: 'ETUDIANT',
    },
  });
  userId = user.id;
  const student = await prisma.etudiant.create({
    data: { matricule: 'QA-IDENTITE-' + randomUUID(), nom: 'Recette', prenom: 'Validite', userId: user.id },
  });
  studentId = student.id;
  const owner = (await request(null, 'POST', '/auth/login', { email: user.email, password: 'Passer@2026' }, 201)).token;
  const otherStudent = (
    await request(null, 'POST', '/auth/login', { email: 'etudiant1@university.gn', password: 'Etu#2026' }, 201)
  ).token;
  const card = await request(
    admin,
    'POST',
    '/cartes-etudiantes',
    { etudiantId: student.id, nip: '1234', dateValidite: '2099-01-01T00:00:00Z' },
    201,
  );
  cardId = card.id;
  assert.ok(!Object.hasOwn(card, 'nip'));
  const nipRoute = `/cartes-etudiantes/${card.id}/verifier-nip`;
  const qrRoute = '/cartes-etudiantes/verifier?' + new URLSearchParams({ carte: card.id, k: card.qrToken });
  assert.deepEqual(await request(admin, 'POST', nipRoute, { nip: '1234' }, 201), { ok: true });
  assert.deepEqual(await request(admin, 'POST', nipRoute, { nip: '9876' }, 201), { ok: false });
  await request(owner, 'POST', nipRoute, { nip: '1234' }, 403);
  assert.equal((await request(owner, 'GET', '/cartes-etudiantes/me')).id, card.id);
  await request(otherStudent, 'GET', `/cartes-etudiantes/${card.id}/imprimer`, null, 404);
  assert.ok((await request(owner, 'GET', `/cartes-etudiantes/${card.id}/imprimer`)).includes('Recette'));
  await request(otherStudent, 'POST', `/cartes-etudiantes/${card.id}/nip`, { nip: '5678' }, 400);
  await request(owner, 'POST', `/cartes-etudiantes/${card.id}/nip`, { nip: '5678' }, 201);
  assert.deepEqual(await request(admin, 'POST', nipRoute, { nip: '5678' }, 201), { ok: true });
  assert.equal((await request(null, 'GET', qrRoute)).valide, true);
  await request(admin, 'PUT', `/cartes-etudiantes/${card.id}`, { dateValidite: '2000-01-01T00:00:00Z' });
  assert.deepEqual(await request(admin, 'POST', nipRoute, { nip: '5678' }, 201), { ok: false });
  assert.equal((await request(null, 'GET', qrRoute)).valide, false);
  assert.equal(await prisma.auditLog.count({ where: { entiteId: card.id, action: 'VERIF_CARTE_OK' } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entiteId: card.id, action: 'VERIF_CARTE_ECHEC' } }), 1);
  await request(null, 'GET', `/cartes-etudiantes/${card.id}/imprimer`, null, 401);
  assert.ok((await request(admin, 'GET', `/cartes-etudiantes/${card.id}/imprimer`)).includes('Recette'));
  observations.cardRevocations = await concurrent(admin, `/cartes-etudiantes/${card.id}/revoquer`, {
    motif: 'Révocation de recette',
  });
  observations.cardRevocationAudits = await prisma.auditLog.count({
    where: { entiteId: card.id, action: 'CARTE_ETUDIANTE_REVOQUEE' },
  });
  await request(owner, 'POST', `/cartes-etudiantes/${card.id}/nip`, { nip: '1234' }, 400);
  await request(admin, 'PUT', `/cartes-etudiantes/${card.id}`, { dateValidite: '2099-01-01T00:00:00Z' }, 400);
  const badge = await request(
    admin,
    'POST',
    '/badges',
    {
      type: 'VISITEUR',
      nom: 'Recette',
      prenom: 'Badge',
      dateValidite: '2099-01-01T00:00:00Z',
      telephone: 'QA-contact-prive',
      numeroPiece: 'QA-piece-privee',
    },
    201,
  );
  badgeId = badge.id;
  const badgeRoute = '/badges/verifier?' + new URLSearchParams({ badge: badge.id, k: badge.qrToken });
  const publicBadge = await request(null, 'GET', badgeRoute);
  assert.equal(publicBadge.valide, true);
  assert.ok(!JSON.stringify(publicBadge).includes('QA-contact-prive'));
  assert.ok(!JSON.stringify(publicBadge).includes('QA-piece-privee'));
  await request(null, 'GET', `/badges/${badge.id}/imprimer`, null, 401);
  await request(owner, 'GET', `/badges/${badge.id}/imprimer`, null, 403);
  assert.ok((await request(admin, 'GET', `/badges/${badge.id}/imprimer`)).includes('Recette'));
  await request(admin, 'PUT', `/badges/${badge.id}`, { dateValidite: '2000-01-01T00:00:00Z' });
  assert.equal((await request(null, 'GET', badgeRoute)).valide, false);
  await request(admin, 'POST', `/badges/${badge.id}/rallonger`, { dateValidite: '2099-01-01T00:00:00Z' }, 201);
  assert.equal((await request(null, 'GET', badgeRoute)).valide, true);
  observations.expiredBadgeRejectedAndExtensionRestoresValidity = true;
  observations.badgeCancellations = await concurrent(admin, `/badges/${badge.id}/annuler`, {
    motif: 'Annulation de recette',
  });
  observations.badgeCancellationAudits = await prisma.auditLog.count({
    where: { entiteId: badge.id, action: 'BADGE_ACCES_ANNULE' },
  });
  await request(admin, 'PUT', `/badges/${badge.id}`, { nom: 'Modification refusée' }, 400);
  await request(admin, 'POST', `/badges/${badge.id}/rallonger`, { dateValidite: '2099-01-01T00:00:00Z' }, 400);
  assert.equal((await request(null, 'GET', badgeRoute)).valide, false);
  const year = await prisma.anneeAcademique.findFirstOrThrow({ where: { active: true, cloturee: false } });
  const attestation = await request(
    admin,
    'POST',
    '/attestations',
    { etudiantId: student.id, anneeId: year.id, type: 'SCOLARITE' },
    201,
  );
  attestationId = attestation.id;
  await request(otherStudent, 'GET', `/attestations/${attestation.id}/imprimer`, null, 404);
  assert.ok((await request(owner, 'GET', `/attestations/${attestation.id}/imprimer`)).includes('Recette'));
  const attestationRoute =
    '/attestations/verifier?' + new URLSearchParams({ ref: attestation.numero, k: attestation.qrToken });
  assert.equal((await request(null, 'GET', attestationRoute)).valide, true);
  const motif = 'Information confidentielle de recette';
  observations.attestationRevocations = await concurrent(admin, `/attestations/${attestation.id}/revoquer`, {
    motifRevocation: motif,
  });
  observations.attestationRevocationAudits = await prisma.auditLog.count({
    where: { entiteId: attestation.id, action: 'ATTESTATION_REVOCATION' },
  });
  await request(admin, 'PUT', `/attestations/${attestation.id}`, { motif: 'Modification refusée' }, 400);
  const revoked = await request(null, 'GET', attestationRoute);
  assert.equal(revoked.valide, false);
  assert.ok(!JSON.stringify(revoked).includes(motif));
  const passed =
    JSON.stringify(observations.cardRevocations) === '[201,400,400,400]' &&
    observations.cardRevocationAudits === 1 &&
    JSON.stringify(observations.badgeCancellations) === '[201,400,400,400]' &&
    observations.badgeCancellationAudits === 1 &&
    JSON.stringify(observations.attestationRevocations) === '[201,400,400,400]' &&
    observations.attestationRevocationAudits === 1;
  const report = {
    date: new Date().toISOString(),
    passed,
    database: database.pathname.slice(1),
    observations: {
      ...observations,
      validCardNipAccepted: true,
      wrongNipRejected: true,
      expiredCardNipRejected: true,
      expiredQrRejectedAndAuditFailure: true,
      anonymousPrintRejected: true,
      adminPrintAllowed: true,
      ownerCardAndAttestationPrintAllowed: true,
      otherStudentPrintRejected: true,
      ownNipChangeAllowedOtherStudentRejected: true,
      studentNipVerificationRejected: true,
      revokedCardNipChangeRejected: true,
      revokedAttestationRejectedWithoutPrivateReason: true,
      cancelledBadgeCannotBeModifiedOrExtended: true,
      badgePublicIdentityMinimized: true,
    },
    productionUntouched: true,
    completeIdentityCycleAndPhysicalPrintPending: true,
  };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert.ok(passed, 'Les transitions concurrentes doivent écrire et journaliser une seule décision');
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (attestationId) {
      await prisma.verificationAttestation.deleteMany({ where: { attestationId } });
      await prisma.attestation.delete({ where: { id: attestationId } });
    }
    if (cardId) await prisma.carteEtudiante.delete({ where: { id: cardId } });
    if (badgeId) await prisma.badgeAcces.delete({ where: { id: badgeId } });
    if (studentId) await prisma.etudiant.delete({ where: { id: studentId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
