/** Recette avec écritures, exclusivement sur une base QA et une API locales. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');

const base = process.env.QA_API_URL || 'http://127.0.0.1:15031/api';
const database = new URL(process.env.DATABASE_URL);
if (
  !['localhost', '127.0.0.1'].includes(new URL(base).hostname) ||
  !['localhost', '127.0.0.1'].includes(database.hostname) ||
  !/^\/university_qa_\d+$/.test(database.pathname)
) {
  throw new Error('Une API locale et une base university_qa_<nombre> sont obligatoires.');
}
const prisma = new PrismaClient();
const checks = [];
async function request(path, token, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push({ name, result: 'OK' });
}
async function login(email, password = 'Passer@2026') {
  const result = await request('/auth/login', null, 'POST', { email, password });
  check(`Connexion ${email.split('@')[0]}`, result.status, 201);
  assert.ok(result.data.token, 'Jeton absent');
  return result.data.token;
}

(async () => {
  let election;
  try {
    const admin = await login('admin@unipresence.gn');
    const teacher = await login('enseignant@unipresence.gn');
    const student = await login('etudiant1@university.gn', 'Etu#2026');
    const chef = await login('chef.info@unipresence.gn');
    check('Journal autorisé à l’administrateur', (await request('/controles/audit', admin)).status, 200);
    for (const [role, token] of [
      ['étudiant', student],
      ['enseignant', teacher],
      ['chef', chef],
    ]) {
      check(`Journal interdit au rôle ${role}`, (await request('/controles/audit', token)).status, 403);
    }
    const adminAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
    const journal = await request(
      `/controles/audit?action=LOGIN&entite=User&acteur=${encodeURIComponent(adminAccount.nom)}`,
      admin,
    );
    check('Filtres journal action/entité/acteur', journal.status, 200);
    assert.ok(journal.data.data.length);
    check(
      'Journal limité aux opérations filtrées',
      journal.data.data.every(
        (row) => row.action === 'LOGIN' && row.entite === 'User' && row.user.nom === adminAccount.nom,
      ),
      true,
    );
    const profile = await prisma.etudiant.findFirstOrThrow({ where: { user: { email: 'etudiant1@university.gn' } } });
    const foreign = await prisma.etudiant.findFirstOrThrow({ where: { id: { not: profile.id } } });
    check('Profil étudiant propre accessible', (await request(`/etudiants/${profile.id}`, student)).status, 200);
    check('Profil étudiant tiers inaccessible', (await request(`/etudiants/${foreign.id}`, student)).status, 404);
    const ownRegistration = await prisma.inscription.findFirstOrThrow({ where: { etudiantId: profile.id } });
    const foreignRegistration = await prisma.inscription.findFirstOrThrow({
      where: { etudiantId: { not: profile.id } },
    });
    check(
      'Attestation inscription propre imprimable',
      (await request(`/inscriptions/${ownRegistration.id}/attestation-inscription`, student)).status,
      200,
    );
    check(
      'Attestation inscription tierce inaccessible',
      (await request(`/inscriptions/${foreignRegistration.id}/attestation-inscription`, student)).status,
      404,
    );
    const teacherRows = (await request('/enseignants?all=1', student)).data.data;
    assert.ok(Array.isArray(teacherRows) && teacherRows.length);
    check(
      'Aucun salaire ni coordonnées privées dans le référentiel étudiant',
      teacherRows.some((row) =>
        ['tauxHoraire', 'telephone', 'email', 'empreinteTemplate', 'codePin'].some((key) => key in row),
      ),
      false,
    );
    check('Paiement interdit au chef', (await request('/rapports/etat-paiement', chef)).status, 403);
    check('Rapports interdits à l’étudiant', (await request('/rapports/dashboard', student)).status, 403);
    check(
      'Écriture présence interdite à l’enseignant',
      (await request('/controles?redirect=/api/elections/vote', teacher, 'POST', {})).status,
      403,
    );
    const created = await request('/elections', admin, 'POST', {
      titre: 'Recette de concurrence locale',
      type: 'SYNDICAT',
      nbSieges: 1,
      dateOuverture: new Date(Date.now() - 3600000).toISOString(),
      dateCloture: new Date(Date.now() + 86400000).toISOString(),
    });
    check('Création scrutin', created.status, 201);
    election = created.data.id;
    const candidates = [];
    for (const nom of ['Candidat A', 'Candidat B']) {
      const result = await request(`/elections/${election}/candidats`, admin, 'POST', { nom, prenom: 'QA' });
      check(`Création ${nom}`, result.status, 201);
      candidates.push(result.data.id);
    }
    check('Ouverture scrutin', (await request(`/elections/${election}/ouvrir`, admin, 'POST', {})).status, 201);
    const votes = await Promise.all(
      candidates.map((candidatId) =>
        request('/elections/vote', teacher, 'POST', { electionId: election, bulletin: [{ candidatId }] }),
      ),
    );
    check('Deux votes simultanés : un seul accepté', votes.map((v) => v.status).sort(), [201, 409]);
    check('Un bulletin persisté', await prisma.voteElection.count({ where: { electionId: election } }), 1);
    check(
      'Nouveau dépôt refusé',
      (
        await request('/elections/vote', teacher, 'POST', {
          electionId: election,
          bulletin: [{ candidatId: candidates[0] }],
        })
      ).status,
      409,
    );
    check('Électeur informé de son vote', (await request(`/elections/${election}/mon-vote`, teacher)).data.aVote, true);
    const print = `/elections/${election}/imprimer-bulletin`;
    check('Impression sans identité refusée', (await request(print)).status, 401);
    check('Impression par Authorization', (await request(print, teacher)).status, 200);
    check('Impression par jeton d’URL', (await request(`${print}?token=${encodeURIComponent(teacher)}`)).status, 200);
    const account = await prisma.user.findUniqueOrThrow({ where: { email: 'enseignant@unipresence.gn' } });
    try {
      await prisma.user.update({ where: { id: account.id }, data: { actif: false } });
      check('Impression refusée après désactivation', (await request(print, teacher)).status, 401);
    } finally {
      await prisma.user.update({ where: { id: account.id }, data: { actif: account.actif } });
    }
    try {
      await prisma.user.update({
        where: { id: account.id },
        data: { motDePasseModifieLe: new Date(Date.now() + 1000) },
      });
      check('Impression refusée après révocation', (await request(print, teacher)).status, 401);
    } finally {
      await prisma.user.update({
        where: { id: account.id },
        data: { motDePasseModifieLe: account.motDePasseModifieLe },
      });
    }
    const output = { date: new Date().toISOString(), environment: 'QA locale isolée', checks };
    if (process.env.QA_REPORT) fs.writeFileSync(process.env.QA_REPORT, JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
  } finally {
    if (election) {
      await prisma.voteElection.deleteMany({ where: { electionId: election } });
      await prisma.candidatElection.deleteMany({ where: { electionId: election } });
      await prisma.election.delete({ where: { id: election } });
    }
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
