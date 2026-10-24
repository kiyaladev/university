/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { ecrirePreuve } = require('./preuves.cjs');
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

const tag = 'QA-IMPORT-' + randomUUID();
const report = { date: new Date().toISOString(), statut: 'en_cours', types: [] };
async function call(token, method, path, body, expected = 200) {
  const r = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (expected !== null) assert.equal(r.status, expected, method + ' ' + path + ': ' + text.slice(0, 160));
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}

async function main() {
  const { ADMIN: admin, SCOLARITE: school, ENSEIGNANT: teacher, ETUDIANT: student } = session.sessions;
  assert.equal((await call(admin, 'GET', '/auth/me')).data.role, 'ADMIN');
  const cases = [
    {
      type: 'enseignants',
      header: 'Matricule;Nom;Prénom;Actif',
      rows: [tag + ';Diallo;Aïssatou;oui', tag + ';Doublon;QA;oui', tag + '-B;Recette;Import;non'],
      model: 'enseignant',
      key: 'matricule',
    },
    {
      type: 'matieres',
      header: 'Code;Intitulé;Crédits',
      rows: [tag + ';Économie;3', tag + ';Doublon;3', tag + '-B;Recette;2'],
      model: 'matiere',
      key: 'code',
    },
    {
      type: 'salles',
      header: 'Code;Nom;Capacité;Actif',
      rows: [tag + ';Amphithéâtre;20;oui', tag + ';Doublon;20;oui', tag + '-B;Salle QA;10;non'],
      model: 'salle',
      key: 'code',
    },
  ];
  for (const c of cases) {
    const dto = { type: c.type, contenu: '\uFEFF' + c.header + '\n' + c.rows.join('\n') };
    await call(teacher, 'POST', '/imports/referentiels/previsualiser', dto, 403);
    await call(student, 'POST', '/imports/referentiels/appliquer', dto, 403);
    const preview = (await call(school, 'POST', '/imports/referentiels/previsualiser', dto, 201)).data;
    assert.equal(preview.lignesLues, 3);
    assert.equal(preview.valides, 2);
    assert.equal(preview.rejetees, 1);
    assert.equal(await db[c.model].count({ where: { [c.key]: { startsWith: tag } } }), 0);
    const applied = (await call(school, 'POST', '/imports/referentiels/appliquer', dto, 201)).data;
    assert.equal(applied.importees, 2);
    assert.equal(applied.rejetees, 1);
    assert.equal(await db[c.model].count({ where: { [c.key]: { startsWith: tag } } }), 2);
    const again = (await call(admin, 'POST', '/imports/referentiels/appliquer', dto, 201)).data;
    assert.equal(again.importees, 0);
    assert.equal(again.rejetees, 3);
    const records = await db[c.model].findMany({ where: { [c.key]: { startsWith: tag } } });
    if (c.type === 'enseignants') {
      assert.equal(records.find((r) => r.matricule === tag).prenom, 'Aïssatou');
      assert.equal(records.find((r) => r.matricule.endsWith('-B')).actif, false);
    }
    if (c.type === 'salles') assert.ok(records.every((r) => typeof r.qrToken === 'string' && r.qrToken.length > 10));
    for (const record of records) {
      const logs = await db.auditLog.findMany({ where: { entiteId: record.id } });
      assert.equal(logs.length, 1);
      assert.ok(logs.every((l) => !l.details.includes('Aïssatou') && !l.details.includes('Amphithéâtre')));
    }
    report.types.push({
      type: c.type,
      preview: { lues: preview.lignesLues, valides: preview.valides, rejetees: preview.rejetees },
      applied,
      replay: again,
    });
  }
  await call(
    school,
    'POST',
    '/imports/referentiels/previsualiser',
    { type: 'salles', contenu: 'Colonne inconnue\nvaleur' },
    400,
  );
  report.statut = 'valide';
}
main()
  .catch((e) => {
    report.statut = 'echec';
    report.erreur = e.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    report.fixturesRestantes = {};
    for (const [model, key] of [
      ['enseignant', 'matricule'],
      ['matiere', 'code'],
      ['salle', 'code'],
    ]) {
      const where = { [key]: { startsWith: tag } },
        records = await db[model].findMany({ where, select: { id: true } });
      await db.auditLog.deleteMany({ where: { entiteId: { in: records.map((r) => r.id) } } });
      await db[model].deleteMany({ where });
      report.fixturesRestantes[model] = await db[model].count({ where });
      assert.equal(report.fixturesRestantes[model], 0);
    }
    report.productionUntouched = true;
    report.limites = [
      'Import créneaux non qualifié par cette recette',
      'Fichiers historiques et décodeur XLSX navigateur à qualifier séparément',
    ];
    ecrirePreuve('imports-http.json', report);
    await db.$disconnect();
    console.log(
      JSON.stringify({ statut: report.statut, erreur: report.erreur, fixturesRestantes: report.fixturesRestantes }),
    );
  });
