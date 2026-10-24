/** Rattachement et unicité métier des attestations sur la seule base QA. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
assert.ok(process.env.QA_ENV_FILE, 'QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname));
assert.equal(env.PORT, '15041');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
let studentId, inscriptionId, otherYearId, otherPromotionId;
async function request(token, method, route, body) {
  const response = await fetch('http://127.0.0.1:15041/api' + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text,
  };
}
async function main() {
  const login = await request(null, 'POST', '/auth/login', { email: 'admin@unipresence.gn', password: 'Passer@2026' });
  assert.equal(login.status, 201);
  const token = login.body.token;
  const year = await prisma.anneeAcademique.findFirstOrThrow({ where: { active: true, cloturee: false } });
  const promotion = await prisma.promotion.findFirstOrThrow({ where: { anneeId: year.id } });
  const other = await prisma.inscription.findFirstOrThrow({ where: { anneeId: year.id, statut: 'VALIDE' } });
  const tag = 'QA-RATTACHEMENT-' + randomUUID();
  const otherYear = await prisma.anneeAcademique.create({
    data: { libelle: tag, dateDebut: year.dateDebut, dateFin: year.dateFin },
  });
  otherYearId = otherYear.id;
  const otherPromotion = await prisma.promotion.create({
    data: { nom: tag, niveau: promotion.niveau, filiereId: promotion.filiereId, anneeId: year.id },
  });
  otherPromotionId = otherPromotion.id;
  const student = await prisma.etudiant.create({ data: { matricule: tag, nom: 'Recette', prenom: 'Rattachement' } });
  studentId = student.id;
  const inscription = await prisma.inscription.create({
    data: { numero: tag, etudiantId: student.id, anneeId: year.id, promotionId: promotion.id, statut: 'VALIDE' },
  });
  inscriptionId = inscription.id;
  const base = { etudiantId: student.id, anneeId: year.id };
  const mismatched = await request(token, 'POST', '/attestations', {
    ...base,
    type: 'DIPLOME',
    inscriptionId: other.id,
  });
  const missing = await request(token, 'POST', '/attestations', {
    ...base,
    type: 'ASSIDUITE',
    inscriptionId: randomUUID(),
  });
  const mismatchedYear = await request(token, 'POST', '/attestations', {
    ...base,
    anneeId: otherYear.id,
    type: 'DIPLOME',
    inscriptionId: inscription.id,
  });
  const mismatchedPromotion = await request(token, 'POST', '/attestations', {
    ...base,
    promotionId: otherPromotion.id,
    type: 'DIPLOME',
    inscriptionId: inscription.id,
  });
  const emissions = await Promise.all(
    Array.from({ length: 4 }, () =>
      request(token, 'POST', '/attestations', {
        etudiantId: student.id,
        type: 'SCOLARITE',
        inscriptionId: inscription.id,
      }),
    ),
  );
  const issued = emissions.find((r) => r.status === 201);
  assert.ok(issued, 'Une émission doit réussir');
  const persisted = await prisma.attestation.findUniqueOrThrow({ where: { id: issued.body.id } });
  const second = await request(token, 'POST', '/attestations', {
    ...base,
    type: 'SITUATION',
    inscriptionId: inscription.id,
  });
  assert.equal(second.status, 201);
  const typeChange = await request(token, 'PUT', `/attestations/${second.body.id}`, { type: 'SCOLARITE' });
  const ownerChange = await request(token, 'PUT', `/attestations/${second.body.id}`, {
    motif: 'Correction de recette',
    etudiantId: other.etudiantId,
  });
  const observations = {
    mismatchedStudentInscription: mismatched.status,
    nonexistentInscription: missing.status,
    mismatchedYear: mismatchedYear.status,
    mismatchedPromotion: mismatchedPromotion.status,
    concurrentEmissions: emissions.map((r) => r.status).sort(),
    activeSchoolCertificates: await prisma.attestation.count({
      where: { etudiantId: student.id, anneeId: year.id, type: 'SCOLARITE', statut: 'EMIS' },
    }),
    promotionDerivedFromInscription: persisted.promotionId === promotion.id,
    yearDerivedFromInscription: persisted.anneeId === year.id,
    typeChangeToExistingCertificate: typeChange.status,
    immutableOwnerRejectedByDto: ownerChange.status,
  };
  const third = await request(token, 'POST', '/attestations', {
    ...base,
    type: 'ASSIDUITE',
    inscriptionId: inscription.id,
  });
  assert.equal(third.status, 201);
  const concurrentTypeChanges = await Promise.all(
    [second.body.id, third.body.id].map((id) => request(token, 'PUT', `/attestations/${id}`, { type: 'REUSSITE' })),
  );
  observations.concurrentTypeChanges = concurrentTypeChanges.map((r) => r.status).sort();
  observations.activeSuccessCertificates = await prisma.attestation.count({
    where: { etudiantId: student.id, anneeId: year.id, type: 'REUSSITE', statut: 'EMIS' },
  });
  const revocation = await request(token, 'POST', `/attestations/${issued.body.id}/revoquer`, {
    motifRevocation: 'Remplacement de recette',
  });
  assert.equal(revocation.status, 201);
  const replacement = await request(token, 'POST', '/attestations', {
    ...base,
    type: 'SCOLARITE',
    inscriptionId: inscription.id,
  });
  observations.reissueAfterRevocation = replacement.status;
  const oldQr = await request(
    null,
    'GET',
    '/attestations/verifier?' + new URLSearchParams({ ref: issued.body.numero, k: issued.body.qrToken }),
  );
  observations.revokedCertificateStillInvalid = oldQr.body.valide === false;
  const passed =
    observations.mismatchedStudentInscription === 400 &&
    observations.nonexistentInscription === 400 &&
    JSON.stringify(observations.concurrentEmissions) === '[201,409,409,409]' &&
    observations.activeSchoolCertificates === 1 &&
    observations.promotionDerivedFromInscription &&
    observations.yearDerivedFromInscription &&
    observations.mismatchedYear === 400 &&
    observations.mismatchedPromotion === 400 &&
    observations.typeChangeToExistingCertificate === 409 &&
    observations.immutableOwnerRejectedByDto === 400 &&
    JSON.stringify(observations.concurrentTypeChanges) === '[200,409]' &&
    observations.activeSuccessCertificates === 1 &&
    observations.reissueAfterRevocation === 201 &&
    observations.revokedCertificateStillInvalid;
  const report = {
    date: new Date().toISOString(),
    database: database.pathname.slice(1),
    passed,
    observations,
    productionUntouched: true,
  };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert.ok(passed, 'Le rattachement et le dédoublonnage doivent rester cohérents');
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (studentId) {
      await prisma.verificationAttestation.deleteMany({ where: { attestation: { etudiantId: studentId } } });
      await prisma.attestation.deleteMany({ where: { etudiantId: studentId } });
    }
    if (inscriptionId) await prisma.inscription.delete({ where: { id: inscriptionId } });
    if (studentId) await prisma.etudiant.delete({ where: { id: studentId } });
    if (otherPromotionId) await prisma.promotion.delete({ where: { id: otherPromotionId } });
    if (otherYearId) await prisma.anneeAcademique.delete({ where: { id: otherYearId } });
    await prisma.$disconnect();
  });
