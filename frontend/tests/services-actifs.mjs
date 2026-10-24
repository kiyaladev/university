/** Écrit seulement dans une recette locale dont la base QA est explicite. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const api = process.argv[2] || 'http://127.0.0.1:15041/api';
if (
  !['127.0.0.1', 'localhost'].includes(new URL(api).hostname) ||
  process.env.QA_DATABASE !== 'university_recommandations_20261006'
)
  throw Error('API locale et base QA dédiée obligatoires');
const checks = [];
async function request(path, token, method = 'GET', body) {
  return fetch(api + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(email, password) {
  const response = await request('/auth/login', '', 'POST', { email, password });
  assert.equal(response.status, 201);
  return (await response.json()).token;
}
const admin = await login('admin@unipresence.gn', 'Passer@2026');
const student = await login('etudiant1@university.gn', 'Etu#2026');
const previous = await (await request('/services-actifs')).json();
try {
  assert.ok(Array.isArray(previous) && previous.length >= 20);
  assert.equal(
    (await request('/services-actifs', student, 'PUT', { services: [{ id: 'vod', actif: false }] })).status,
    403,
  );
  for (const services of [
    [{ id: 'presence', actif: false }],
    [{ id: 'vod', actif: 'false' }],
    [{ id: 'inconnu', actif: false }],
    [
      { id: 'vod', actif: true },
      { id: 'vod', actif: false },
    ],
  ]) {
    assert.equal((await request('/services-actifs', admin, 'PUT', { services })).status, 400);
  }
  checks.push('ADMIN seul ; services essentiels, inconnus, doublons et faux booléens refusés par HTTP');
  assert.equal(
    (
      await request('/services-actifs', admin, 'PUT', {
        services: [
          { id: 'vod', actif: false },
          { id: 'bibliotheque', actif: false },
          { id: 'restauration', actif: false },
        ],
      })
    ).status,
    200,
  );
  assert.equal((await request('/vod', admin)).status, 404);
  assert.equal((await request('/documents')).status, 404);
  assert.equal((await request('/portail/resto/me', student)).status, 404);
  assert.equal((await request('/portail/me', student)).status, 200);
  checks.push('API privée et publique désactivées ; portail étudiant conservé');
  assert.equal(
    (await request('/parametres', admin, 'PUT', { parametres: [{ cle: 'SERVICE_ACTIF_vod', valeur: 'true' }] })).status,
    400,
  );
  checks.push('Endpoint générique incapable de contourner la configuration dédiée');
} finally {
  assert.equal(
    (await request('/services-actifs', admin, 'PUT', { services: previous.map(({ id, actif }) => ({ id, actif })) }))
      .status,
    200,
  );
}
assert.equal((await request('/vod', admin)).status, 200);
checks.push('Réactivation effective, paramètres QA restaurés');
const report = { date: new Date().toISOString(), api: 'API/base QA locales réelles', checks };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
