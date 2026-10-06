/** Recette des examens/tirages sur base fictive locale exclusivement. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
if (!process.env.QA_ENV_FILE) throw Error('QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname));
assert.equal(env.PORT, '15041');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const exams = [], failures = [];
async function call(token, method, route, body) {
  const r = await fetch(api + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function request(token, method, route, body, status = 200) {
  const r = await call(token, method, route, body);
  assert.equal(r.status, status, `${method} ${route}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body;
}
async function login(email, password) { return (await request(null, 'POST', '/auth/login', { email, password }, 201)).token; }
async function main() {
  const adminAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const admin = await login(adminAccount.email, 'Passer@2026');
  assert.equal((await request(admin, 'GET', '/auth/me')).id, adminAccount.id);
  const teacherAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'enseignant@unipresence.gn' } });
  const teacher = await login(teacherAccount.email, 'Passer@2026');
  const student = await login('etudiant1@university.gn', 'Etu#2026');
  const inscription = await prisma.inscription.findFirstOrThrow({ where: { statut: 'VALIDEE', annee: { active: true, cloturee: false } }, include: { etudiant: true } });
  const matiere = await prisma.matiere.findFirstOrThrow();
  const tag = 'QA-EXAM-' + randomUUID();
  const dto = { intitule: tag, codeExamen: tag, type: 'FINAL', matiereId: matiere.id, promotionId: inscription.promotionId, anneeId: inscription.anneeId, dateExamen: '2026-10-06', heureDebut: '09:00', heureFin: '11:00', surveillantId: teacherAccount.id };
  const exam = await request(admin, 'POST', '/examens', dto, 201);
  exams.push(exam.id);
  const other = await request(admin, 'POST', '/examens', { ...dto, codeExamen: tag + '-other', surveillantId: adminAccount.id }, 201);
  exams.push(other.id);
  await request(student, 'GET', '/examens', null, 403);
  await request(teacher, 'GET', '/examens/' + other.id, null, 404);
  await request(teacher, 'POST', '/examens/scan', { examenId: other.id, reference: inscription.etudiant.matricule }, 404);
  await request(teacher, 'POST', '/examens/scan', { examenId: exam.id, reference: inscription.etudiant.matricule }, 400);
  const starts = await Promise.all([1, 2].map(() => call(admin, 'POST', `/examens/${exam.id}/demarrer`, {})));
  assert.deepEqual(starts.map(r => r.status).sort(), [201, 400]);
  const nbInscrits = await prisma.inscription.count({ where: { promotionId: inscription.promotionId, anneeId: inscription.anneeId, statut: 'VALIDEE' } });
  assert.equal((await prisma.examen.findUniqueOrThrow({ where: { id: exam.id } })).nbInscrits, nbInscrits);
  const scans = await Promise.all([1, 2].map(() => request(teacher, 'POST', '/examens/scan', { examenId: exam.id, reference: inscription.etudiant.matricule, scanneurId: adminAccount.id }, 201)));
  assert.equal(scans[0].id, scans[1].id);
  assert.ok(scans.some(s => s.dejaEnregistre));
  assert.equal(scans[0].scanneurId, teacherAccount.id);
  const unknown = await request(teacher, 'POST', '/examens/scan', { examenId: exam.id, reference: tag + '-unknown' }, 201);
  assert.equal(unknown.valide, false);
  const stats = await request(admin, 'GET', `/examens/${exam.id}/stats`);
  assert.equal(stats.scansValides, 1);
  assert.equal(stats.scansRejetes, 1);
  assert.equal(stats.nbPresents, 1);
  await request(teacher, 'GET', `/examens/${exam.id}/scans`, null, 403);
  const ends = await Promise.all([1, 2].map(() => call(admin, 'POST', `/examens/${exam.id}/terminer`, {})));
  assert.deepEqual(ends.map(r => r.status).sort(), [201, 400]);
  await request(teacher, 'POST', '/examens/scan', { examenId: exam.id, reference: inscription.etudiant.matricule }, 400);
  await request(admin, 'PUT', `/examens/${exam.id}/statut`, { statut: 'PLANIFIE' }, 400);
  const source = createHash('sha256').update('Épreuve fictive QA').digest('hex');
  const tirageDto = { examenId: other.id, dateTirage: '2026-10-06', nbExemplaires: 2, empreinteSource: source };
  const tirage = await request(admin, 'POST', '/tirage', tirageDto, 201);
  const bypass = await request(admin, 'POST', '/tirage', tirageDto, 201);
  const bypassResponse = await call(admin, 'POST', `/tirage/${bypass.id}/mettre-sous-pli`, { stade: 'IMPRIME' });
  if (bypassResponse.status !== 400) failures.push('empreinte contournée par la route mettre-sous-pli');
  await request(student, 'GET', '/tirage/' + tirage.id, null, 403);
  await request(admin, 'POST', `/tirage/${tirage.id}/distribuer`, { stade: 'DISTRIBUE' }, 400);
  await request(admin, 'POST', `/tirage/${tirage.id}/imprimer`, { empreinteSource: '0'.repeat(64) }, 400);
  const prints = await Promise.all([1, 2].map(() => call(admin, 'POST', `/tirage/${tirage.id}/imprimer`, { empreinteSource: source })));
  const printStatuses = prints.map(r => r.status).sort();
  if (JSON.stringify(printStatuses) !== '[201,400]') failures.push('double impression acceptée');
  await request(admin, 'POST', `/tirage/${tirage.id}/annuler`, {}, 400);
  await request(admin, 'POST', `/tirage/${tirage.id}/mettre-sous-pli`, { stade: 'MIS_SOUS_PLI' }, 201);
  await request(admin, 'POST', `/tirage/${tirage.id}/distribuer`, { stade: 'DISTRIBUE' }, 201);
  await request(admin, 'POST', `/tirage/${tirage.id}/recuperer`, { stade: 'RECUPERE' }, 201);
  await request(admin, 'POST', `/tirage/${tirage.id}/recuperer`, { stade: 'RECUPERE' }, 400);
  await request(null, 'GET', `/tirage/${tirage.id}/imprimer-bordereau`, null, 401);
  await request(student, 'GET', `/tirage/${tirage.id}/imprimer-bordereau`, null, 403);
  assert.ok((await request(admin, 'GET', `/tirage/${tirage.id}/imprimer-bordereau`)).includes(tag));
  const invalidHash = await call(admin, 'POST', '/tirage', { ...tirageDto, empreinteSource: 'abc' });
  if (invalidHash.status !== 400) failures.push('empreinte non SHA-256 acceptée');
  const scanAudits = await prisma.auditLog.count({ where: { entiteId: scans[0].id, action: 'EXAMEN_SCAN_VALIDE' } });
  assert.equal(scanAudits, 1);
  const report = { date: new Date().toISOString(), database: database.pathname.slice(1), passed: failures.length === 0, failures, observations: { startStatuses: starts.map(r => r.status).sort(), endStatuses: ends.map(r => r.status).sort(), validScans: 1, rejectedScans: 1, uniqueScanAuditCount: scanAudits, scannerIdentityImposed: true, printStatuses, bypassStatus: bypassResponse.status, invalidHashStatus: invalidHash.status, finalPrintingStage: 'RECUPERE', protectedReceiptRead: true }, productionUntouched: true, physicalPrintingAndIdentityCheckPending: true };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await prisma.tirage.deleteMany({ where: { examenId: { in: exams } } });
  await prisma.scanExamen.deleteMany({ where: { examenId: { in: exams } } });
  await prisma.examen.deleteMany({ where: { id: { in: exams } } });
  await prisma.$disconnect();
});
