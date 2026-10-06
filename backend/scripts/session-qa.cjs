/** Sessions de fixture pour les recettes métier ; ne qualifie pas POST /auth/login. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
assert.ok(process.env.QA_ENV_FILE, 'QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(process.env.QA_ENV_FILE, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(env.PORT, '15041');
assert.equal(env.NODE_ENV, 'development');
Object.assign(process.env, env);
const { AuthService } = require('../dist/modules/auth/auth.service');
const { optionsJwt } = require('../dist/common/jwt-config.module');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const auth = new AuthService(prisma, new JwtService(optionsJwt({ get: key => env[key] })));
async function main() {
  const api = 'http://127.0.0.1:15041/api';
  const sessions = {};
  for (const sessionRole of ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT', 'ETUDIANT', 'ETUDIANT_AUTRE']) {
    const role = sessionRole === 'ETUDIANT_AUTRE' ? 'ETUDIANT' : sessionRole;
    const account = role === 'ADMIN'
      ? await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } })
      : role === 'ETUDIANT' ? await prisma.user.findUniqueOrThrow({ where: { email: sessionRole === 'ETUDIANT_AUTRE' ? 'etudiant2@university.gn' : 'etudiant1@university.gn' } })
        : await prisma.user.findFirstOrThrow({ where: { role, actif: true } });
    assert.equal(account.role, role);
    const result = await auth.login({ email: account.email, password: role === 'ETUDIANT' ? 'Etu#2026' : 'Passer@2026' }, 'QA-FIXTURE');
    const response = await fetch(api + '/auth/me', { headers: { Authorization: `Bearer ${result.token}` } });
    assert.equal(response.status, 200);
    const me = await response.json();
    assert.equal(me.id, account.id);
    assert.equal(me.role, role);
    sessions[sessionRole] = result.token;
  }
  const session = { api, database: database.pathname, token: sessions.ADMIN, sessions, fixtureSource: 'AuthService.login avec mots de passe QA vérifiés, identités contrôlées par GET /auth/me', httpLoginRouteQualifiedByThisFixture: false };
  const file = '/tmp/university-recommandations-qa-session.json';
  fs.writeFileSync(file, JSON.stringify(session), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(JSON.stringify({ fixtureFile: file, rolesVerified: Object.keys(sessions), tokenContentsPrinted: false, httpLoginRouteQualifiedByThisFixture: false, productionUntouched: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
