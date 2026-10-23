/** Rattrapage réel sur fixtures exclusivement QA ; aucune donnée d'exploitation modifiée. */
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { JwtService } = require('@nestjs/jwt');
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
Object.assign(process.env, env);
const { AuthService } = require('../dist/modules/auth/auth.service');
const { optionsJwt } = require('../dist/common/jwt-config.module');
const auth = new AuthService(db, new JwtService(optionsJwt({ get: (k) => env[k] })));

const { createHash } = require('node:crypto');
const departments = [],
  users = [],
  numbers = [];
let year;
const teachers = [],
  subjects = [],
  filieres = [],
  promotions = [],
  assignments = [];
const report = {
  date: new Date().toISOString(),
  statut: 'en_cours',
  scope: 'Relevé avec deux séances propres, une présence et une séance étrangère exclue',
};
async function call(token, body, expected) {
  const r = await fetch(session.api + '/impression/releve-hebdomadaire', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, expected);
  return r;
}
async function main() {
  const password = randomUUID(),
    tokens = [];
  for (let i = 0; i < 2; i++) {
    const d = await db.departement.create({ data: { code: 'QA-PDF-' + randomUUID(), nom: 'Département PDF QA' } });
    departments.push(d.id);
    const u = await db.user.create({
      data: {
        email: 'qa-pdf-' + randomUUID() + '@example.invalid',
        password: await bcrypt.hash(password, 10),
        nom: 'Recette',
        prenom: 'Chef PDF',
        role: 'CHEF_DEPARTEMENT',
        departementId: d.id,
      },
    });
    users.push(u.id);
    const token = (await auth.login({ email: u.email, password }, 'QA-FIXTURE')).token;
    const me = await (await fetch(session.api + '/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
    assert.equal(me.id, u.id);
    tokens.push(token);
  }
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  year = await db.anneeAcademique.create({
    data: { libelle: 'QA-PDF-' + randomUUID(), dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
  });
  for (let i = 0; i < 2; i++) {
    const tag = 'QA-PDF-' + randomUUID();
    const f = await db.filiere.create({ data: { code: tag, nom: tag, departementId: departments[i] } });
    filieres.push(f.id);
    const p = await db.promotion.create({
      data: { nom: 'Promotion PDF ' + i, niveau: 'L1', filiereId: f.id, anneeId: year.id },
    });
    promotions.push(p.id);
    const e = await db.enseignant.create({
      data: {
        matricule: tag,
        nom: i === 0 ? 'PROPREPDF' : 'ETRANGERPDF',
        prenom: 'Recette',
        departementId: departments[i],
      },
    });
    teachers.push(e.id);
    const m = await db.matiere.create({
      data: { code: tag, intitule: 'Matiere PDF ' + i, departementId: departments[i] },
    });
    subjects.push(m.id);
    const a = await db.affectation.create({
      data: { enseignantId: e.id, matiereId: m.id, promotionId: p.id, anneeId: year.id },
    });
    assignments.push(a.id);
    const seance = await db.seance.create({
      data: {
        affectationId: a.id,
        anneeId: year.id,
        date: new Date('2026-10-05'),
        heureDebut: '08:00',
        heureFin: '10:00',
      },
    });
    await db.controle.create({
      data: {
        seanceId: seance.id,
        controleurId: users[0],
        statut: 'PRESENT',
        heureArrivee: '08:00',
        dureeMinutes: 120,
        signatureBase64: 'data:image/png;base64,' + png.toString('base64'),
      },
    });
    if (i === 0)
      await db.seance.create({
        data: {
          affectationId: a.id,
          anneeId: year.id,
          date: new Date('2026-10-06'),
          heureDebut: '14:00',
          heureFin: '16:00',
        },
      });
  }
  const dto = {
    departementId: departments[0],
    dateDebut: '2026-10-05',
    dateFin: '2026-10-11',
    signatureBase64: 'data:image/png;base64,' + png.toString('base64'),
  };
  await call(tokens[1], dto, 403);
  for (const role of ['ADMIN', 'SCOLARITE', 'ETUDIANT']) await call(session.sessions[role], dto, 403);
  await call(tokens[0], { ...dto, dateDebut: '2026-10-06' }, 400);
  await call(tokens[0], { ...dto, signatureBase64: 'data:image/png;base64,AAAA' }, 400);
  report.documents = [];
  for (let i = 0; i < 2; i++) {
    const r = await call(tokens[0], dto, 201),
      pdf = Buffer.from(await r.arrayBuffer());
    assert.equal(r.headers.get('content-type').split(';')[0], 'application/pdf');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const { spawnSync } = require('node:child_process');
    const extraction = spawnSync('pdftotext', ['-layout', '-', '-'], { input: pdf, encoding: 'utf8' });
    assert.equal(extraction.status, 0);
    const text = extraction.stdout;
    assert.ok(text.includes('PROPREPDF'));
    assert.ok(!text.includes('ETRANGERPDF'));
    assert.match(text, /Séances\s*:\s*2/);
    assert.match(text, /Contrôlées\s*:\s*1/);
    assert.match(text, /Heures constatées\s*:\s*2/);
    report.contentVerified = {
      ownTeacherIncluded: true,
      otherDepartmentExcluded: true,
      planned: 2,
      controlled: 1,
      hours: 2,
    };
    const hash = createHash('sha256').update(pdf).digest('hex');
    assert.equal(r.headers.get('x-document-sha256'), hash);
    const filename = r.headers.get('content-disposition').match(/filename="(.*)\.pdf"/)[1];
    numbers.push(filename);
    const logs = await db.auditLog.findMany({ where: { entiteId: filename, action: 'RAPPORT_HEBDOMADAIRE_SIGNE' } });
    assert.equal(logs.length, 1);
    const details = JSON.parse(logs[0].details);
    assert.equal(details.pdfHash, hash);
    assert.equal(details.signatureHash, createHash('sha256').update(png).digest('hex'));
    assert.ok(!logs[0].details.includes(dto.signatureBase64));
    assert.equal(logs[0].userId, users[0]);
    report.documents.push({ numero: filename, bytes: pdf.length, hashMatches: true, auditMatches: true });
  }
  assert.notEqual(numbers[0], numbers[1]);
  report.statut = 'valide';
}
main()
  .catch((e) => {
    report.statut = 'echec';
    report.erreur = e.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    if (year) {
      await db.controle.deleteMany({ where: { seance: { anneeId: year.id } } });
      await db.seance.deleteMany({ where: { anneeId: year.id } });
      await db.affectation.deleteMany({ where: { id: { in: assignments } } });
      await db.promotion.deleteMany({ where: { id: { in: promotions } } });
      await db.filiere.deleteMany({ where: { id: { in: filieres } } });
      await db.enseignant.deleteMany({ where: { id: { in: teachers } } });
      await db.matiere.deleteMany({ where: { id: { in: subjects } } });
      await db.anneeAcademique.delete({ where: { id: year.id } });
    }
    await db.auditLog.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.departement.deleteMany({ where: { id: { in: departments } } });
    report.fixturesRestantes = await db.user.count({ where: { id: { in: users } } });
    report.physicalAndHumanValidationPending = true;
    report.productionUntouched = true;
    fs.writeFileSync(
      '../audit/recommandations-2026-10-06/releve-pdf-http.json',
      JSON.stringify(report, null, 2) + '\n',
    );
    await db.$disconnect();
    console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur }));
  });
