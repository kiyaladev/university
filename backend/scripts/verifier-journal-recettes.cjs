/** Vérification en lecture seule des recettes du journal, exclusivement QA. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
assert.ok(process.env.QA_ENV_FILE, 'QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const root = path.resolve(__dirname, '../../audit/recommandations-2026-10-06');
const report = { date: new Date().toISOString(), scope: 'Fixtures et preuves des recettes récentes du journal uniquement', database: database.pathname, readOnly: true, checks: [], proofs: [], productionUntouched: true };
(async () => {
 try {
  const prefix = { startsWith: 'Contenu confidentiel QA ' };
  const fixtures = [
   ['coursVOD', { titre: prefix }], ['courrier', { objet: prefix }],
   ['ticketSupport', { description: prefix }], ['equipementCampus', { libelle: prefix }],
   ['election', { titre: prefix }], ['reservationSalle', { motif: prefix }],
   ['reparationMateriel', { description: prefix }], ['formation', { titre: prefix }],
   ['travailEncadre', { intitule: prefix }], ['documentDepot', { titre: prefix }],
   ['salle', { OR: [{ code: { startsWith: 'QA-JOURNAL-' } }, { nom: { startsWith: 'QA Journal ' } }] }],
  ];
  report.checks = await Promise.all(fixtures.map(async ([model, where]) => ({ model, remaining: await prisma[model].count({ where }) })));
  assert.ok(report.checks.every(row => row.remaining === 0), 'Fixtures journal encore présentes');
  const coverage = JSON.parse(fs.readFileSync(path.join(root, 'journal-couverture-interface.json'), 'utf8'));
  for (const proof of coverage.proofs) {
   assert.equal(path.basename(proof.file), proof.file);
   const result = JSON.parse(fs.readFileSync(path.join(root, proof.file), 'utf8'));
   assert.equal(result.statut, 'valide', proof.file);
   assert.equal(result.checks.length, proof.checks, proof.file);
   assert.equal(result.productionUntouched, true, proof.file);
   report.proofs.push({ file: proof.file, checks: result.checks.length, validated: true });
  }
  report.realEventConfigurations = report.proofs.reduce((sum, row) => sum + row.checks, 0);
  assert.equal(report.realEventConfigurations, coverage.realEventConfigurations);
  report.statut = 'valide';
 } catch (error) {
  report.statut = 'echec'; report.erreur = error.message; process.exitCode = 1;
 } finally {
  fs.writeFileSync(path.join(root, 'journal-nettoyage-qa.json'), JSON.stringify(report, null, 2) + '\n');
  await prisma.$disconnect();
  console.log(JSON.stringify({ statut: report.statut, erreur: report.erreur, models: report.checks.length, proofs: report.proofs.length, configurations: report.realEventConfigurations }));
 }
})();
