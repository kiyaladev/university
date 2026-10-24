/** Cycle réel exclusivement sur fixtures QA ; règles comptables inchangées. */
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { ecrirePreuve } = require('./preuves.cjs');
assert.ok(process.env.QA_ENV_FILE && process.env.QA_SESSION_FILE);
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE)),
  session = JSON.parse(fs.readFileSync(process.env.QA_SESSION_FILE));
const url = new URL(env.DATABASE_URL);
assert.equal(url.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(session.api, 'http://127.0.0.1:15041/api');
assert.equal(session.database, url.pathname);
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const own = {};
const report = { date: new Date().toISOString(), statut: 'en_cours', productionUntouched: true };
async function call(role, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${session.sessions[role]}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(r.status, expected, `${method} ${path}`);
  return r;
}
async function main() {
  const start = new Date('2088-01-01'),
    end = new Date('2088-01-31');
  assert.equal(await db.feuillePaie.count({ where: { annee: 2088, mois: 1 } }), 0);
  assert.equal(await db.seance.count({ where: { date: { gte: start, lte: end } } }), 0);
  const tag = 'QA-PAIE-' + randomUUID();
  own.department = await db.departement.create({ data: { code: tag, nom: tag } });
  own.year = await db.anneeAcademique.create({ data: { libelle: tag, dateDebut: start, dateFin: end } });
  own.filiere = await db.filiere.create({ data: { code: tag, nom: tag, departementId: own.department.id } });
  own.promotion = await db.promotion.create({
    data: { nom: tag, niveau: 'L1', filiereId: own.filiere.id, anneeId: own.year.id },
  });
  own.teacher = await db.enseignant.create({
    data: {
      matricule: tag,
      nom: tag,
      prenom: 'Recette',
      statut: 'VACATAIRE',
      tauxHoraire: 15000,
      departementId: own.department.id,
    },
  });
  own.subject = await db.matiere.create({ data: { code: tag, intitule: tag, departementId: own.department.id } });
  own.assignment = await db.affectation.create({
    data: {
      enseignantId: own.teacher.id,
      matiereId: own.subject.id,
      promotionId: own.promotion.id,
      anneeId: own.year.id,
      volumeHorairePrevu: 10,
    },
  });
  const actor = await (await call('ADMIN', 'GET', '/auth/me')).json();
  for (const [index, minutes, status] of [
    [0, 75, 'PRESENT'],
    [1, 50, 'PRESENT'],
    [2, 120, 'ABSENT'],
  ]) {
    const seance = await db.seance.create({
      data: {
        affectationId: own.assignment.id,
        anneeId: own.year.id,
        date: new Date(`2088-01-${12 + index}`),
        heureDebut: '09:00',
        heureFin: '11:00',
        statut: 'CONTROLE',
        type: 'CM',
      },
    });
    await db.controle.create({
      data: { seanceId: seance.id, controleurId: actor.id, statut: status, dureeMinutes: minutes, methode: 'MANUEL' },
    });
  }
  for (const role of ['ETUDIANT', 'ENSEIGNANT']) await call(role, 'GET', '/feuilles-paie', null, 403);
  await call('ADMIN', 'POST', '/feuilles-paie', { mois: 13, annee: 2088 }, 400);
  own.sheet = await (await call('ADMIN', 'POST', '/feuilles-paie', { mois: 1, annee: 2088 }, 201)).json();
  const path = '/feuilles-paie/' + own.sheet.id;
  await call('ADMIN', 'POST', path + '/payer', {}, 400);
  await call('DIRECTION', 'POST', path + '/valider', {}, 400);
  const calc = await (await call('SCOLARITE', 'POST', path + '/calculer', {}, 201)).json();
  assert.equal(calc.lignes.length, 1);
  const line = calc.lignes[0];
  assert.equal(line.enseignantId, own.teacher.id);
  assert.equal(line.heuresReelles, 2);
  assert.equal(line.volumePrevu, 10);
  assert.equal(line.retenue, 0);
  assert.equal(line.montantNet, 30000);
  assert.equal(calc.montantTotal, 30000);
  const again = await (await call('SCOLARITE', 'POST', path + '/calculer', {}, 201)).json();
  assert.equal(again.montantTotal, 30000);
  assert.equal(again.lignes.length, 1);
  await call('DIRECTION', 'POST', path + '/valider', {}, 201);
  await call('SCOLARITE', 'POST', path + '/calculer', {}, 400);
  await call('SCOLARITE', 'POST', path + '/payer', {}, 403);
  await call('ADMIN', 'POST', path + '/payer', {}, 201);
  await call('ADMIN', 'POST', path + '/payer', {}, 400);
  await call('ADMIN', 'DELETE', path, null, 400);
  assert.equal((await db.feuillePaie.findUniqueOrThrow({ where: { id: own.sheet.id } })).statut, 'PAYE');
  const html = await (await call('SCOLARITE', 'GET', path + '/imprimer')).text();
  assert.ok(html.includes(tag));
  await call('ETUDIANT', 'GET', path + '/imprimer', null, 403);
  const logs = await db.auditLog.findMany({ where: { entiteId: own.sheet.id } });
  assert.equal(logs.length, 5);
  for (const log of logs) {
    const details = JSON.parse(log.details);
    assert.ok('avant' in details && 'apres' in details);
    assert.ok(!log.details.includes(tag));
  }
  assert.equal(logs.filter((x) => x.action === 'PAIE_PAYEE').length, 1);
  report.calculation = {
    presentMinutes: 125,
    absentMinutesExcluded: 120,
    billedHours: 2,
    hourlyRate: 15000,
    net: 30000,
    withholding: 0,
    ruleObserved:
      'Heures entières par enseignant, Math.floor(total minutes / 60) ; retenue zéro. Validation comptable requise.',
  };
  report.transitions = 'BROUILLON → VALIDE → PAYE';
  report.idempotentRecalculation = true;
  report.protectedPrint = true;
  report.auditEvents = 5;
  report.statut = 'valide';
}
main()
  .catch((e) => {
    report.statut = 'echec';
    report.erreur = e.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    if (own.sheet) {
      await db.auditLog.deleteMany({ where: { entiteId: own.sheet.id } });
      await db.feuillePaie.delete({ where: { id: own.sheet.id } });
    }
    if (own.assignment) {
      const seances = await db.seance.findMany({ where: { affectationId: own.assignment.id }, select: { id: true } });
      await db.controle.deleteMany({ where: { seanceId: { in: seances.map((x) => x.id) } } });
      await db.seance.deleteMany({ where: { affectationId: own.assignment.id } });
      await db.affectation.delete({ where: { id: own.assignment.id } });
    }
    for (const [key, model] of [
      ['teacher', 'enseignant'],
      ['subject', 'matiere'],
      ['promotion', 'promotion'],
      ['filiere', 'filiere'],
      ['year', 'anneeAcademique'],
      ['department', 'departement'],
    ])
      if (own[key]) await db[model].delete({ where: { id: own[key].id } });
    report.fixturesRemoved = true;
    ecrirePreuve('paie-http.json', report);
    await db.$disconnect();
    console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur, calculation: report.calculation }));
  });
