/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'), fs = require('node:fs');
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


const report = { date: new Date().toISOString(), statut: 'en_cours' }; let id;
async function call(token, method, path, body, expected = 200) {
 const r = await fetch(session.api + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const text = await r.text();
 if (expected !== null) assert.equal(r.status, expected, method + ' ' + path + ': ' + text.slice(0, 160));
 return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}

async function main() {
 const { ADMIN: admin, SCOLARITE: school, ENSEIGNANT: teacher, ETUDIANT: student, DIRECTION: direction } = session.sessions;
 assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
 id = (await call(school, 'POST', '/salles', { code: 'QA-QR-' + randomUUID(), nom: 'Salle QA', capacite: 20, latitude: 9.5, longitude: -13.7 }, 201)).data.id;
 const before = await db.salle.findUniqueOrThrow({ where: { id } });
 for (const token of [teacher, student, direction]) {
  const detail = (await call(token, 'GET', '/salles/' + id)).data;
  for (const key of ['qrToken', 'latitude', 'longitude', 'rayonMetres']) assert.equal(detail[key], undefined);
  await call(token, 'GET', '/impression/qr-salles?salleId=' + id, null, 403);
  await call(token, 'POST', '/salles/' + id + '/qr', {}, 403);
 }
 const print = (await call(school, 'GET', '/impression/qr-salles?salleId=' + id)).data;
 assert.ok(print.includes('<svg')); assert.ok(print.includes(before.qrToken));
 await call(admin, 'POST', '/salles/' + id + '/qr', {}, 201);
 const after = await db.salle.findUniqueOrThrow({ where: { id } });
 assert.notEqual(before.qrToken, after.qrToken);
 const newPrint = (await call(admin, 'GET', '/impression/qr-salles?salleId=' + id)).data;
 assert.ok(newPrint.includes(after.qrToken)); assert.ok(!newPrint.includes(before.qrToken));
 await call(admin, 'PUT', '/salles/' + id, { actif: false });
 const inactivePrint = (await call(admin, 'GET', '/impression/qr-salles?salleId=' + id)).data;
 assert.ok(!inactivePrint.includes(after.qrToken));
 const logs = await db.auditLog.findMany({ where: { entiteId: id } });
 assert.equal(logs.filter(l => l.action === 'IMPRESSION_QR_SALLES').length, 3);
 for (const l of logs) { assert.ok(!l.details.includes(before.qrToken)); assert.ok(!l.details.includes(after.qrToken)); }
 report.statut = 'valide'; report.observations = ['Lectures non gestion sans QR ni GPS', 'Affiches et rotation réservées ADMIN/SCOLARITE', 'SVG protégé contenant le jeton courant', 'Rotation persistée et nouvelle affiche sans ancien jeton', 'Salle inactive absente de l’affiche', 'Trois impressions auditées sans jeton'];
}
main().catch(e => { report.statut = 'echec'; report.erreur = e.message; process.exitCode = 1; }).finally(async () => {
 if (id) { await db.auditLog.deleteMany({ where: { entiteId: id } }); await db.salle.delete({ where: { id } }); }
 report.productionUntouched = true; report.physicalPrintAndScanPending = true;
 fs.writeFileSync('../audit/recommandations-2026-10-06/salles-qr-http.json', JSON.stringify(report, null, 2) + '\n');
 await db.$disconnect(); console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur }));
});
