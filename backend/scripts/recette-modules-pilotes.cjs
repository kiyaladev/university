/** Recette HTTP sur base fictive explicite ; aucune connexion à l'exploitation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const envFile = process.env.QA_ENV_FILE;
if (!envFile) throw Error('QA_ENV_FILE privé obligatoire');
const env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/university_recommandations_20261006');
assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname));
assert.equal(env.PORT, '15041');
const api = 'http://127.0.0.1:15041/api';
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const checks = [];
const observations = {};
const created = {
  works: [],
  tickets: [],
  equipments: [],
  documents: [],
  assets: [],
  categories: [],
  letters: [],
  residences: [],
  rooms: [],
};
async function request(token, method, route, body, status = 200) {
  const response = await fetch(api + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${route}: ${text.slice(0, 350)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
async function login(email, password) {
  return (await request(null, 'POST', '/auth/login', { email, password }, 201)).token;
}
async function main() {
  // Vérifier aussi l'identité de la base derrière l'API avant toute écriture.
  const adminAccount = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@unipresence.gn' } });
  const admin = await login(adminAccount.email, 'Passer@2026');
  assert.equal((await request(admin, 'GET', '/auth/me')).id, adminAccount.id);
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: 'enseignant@unipresence.gn' } });
  const student = await prisma.user.findUniqueOrThrow({ where: { email: 'etudiant1@university.gn' } });
  const teacherToken = await login(teacher.email, 'Passer@2026');
  const studentToken = await login(student.email, 'Etu#2026');
  teacher.enseignantId = (await prisma.enseignant.findUniqueOrThrow({ where: { userId: teacher.id } })).id;
  student.etudiantId = (await prisma.etudiant.findUniqueOrThrow({ where: { userId: student.id } })).id;
  assert.ok(teacher.enseignantId && student.etudiantId);
  const tag = 'QA-' + randomUUID();
  const work = await request(
    studentToken,
    'POST',
    '/travaux-encadres',
    {
      intitule: tag,
      type: 'STAGE',
      etudiantId: student.etudiantId,
      encadrantId: teacher.enseignantId,
      statut: 'VALIDE',
    },
    201,
  );
  created.works.push(work.id);
  assert.equal(work.statut, 'PROPOSE');
  assert.equal(work.encadrantId, null);
  checks.push('proposition étudiante : propriétaire imposé, état et encadrant administratifs écartés');
  await request(admin, 'POST', `/travaux-encadres/${work.id}/transition`, { statut: 'VALIDE' }, 400);
  await request(studentToken, 'PUT', `/travaux-encadres/${work.id}`, { encadrantId: teacher.enseignantId }, 403);
  await request(admin, 'PUT', `/travaux-encadres/${work.id}`, { encadrantId: teacher.enseignantId });
  await request(teacherToken, 'POST', `/travaux-encadres/${work.id}/transition`, { statut: 'VALIDE' }, 201);
  await request(teacherToken, 'POST', `/travaux-encadres/${work.id}/transition`, { statut: 'EN_COURS' }, 201);
  await request(studentToken, 'POST', `/travaux-encadres/${work.id}/transition`, { statut: 'SOUTENU' }, 403);
  await request(admin, 'POST', '/soutenances', { travailEncadreId: work.id, date: new Date().toISOString() }, 400);
  checks.push('validation sans encadrant, réaffectation étudiante et soutenance sans rapport refusées');
  await request(teacherToken, 'PUT', `/travaux-encadres/${work.id}`, { rapportRendu: true });
  assert.equal((await prisma.travailEncadre.findUniqueOrThrow({ where: { id: work.id } })).rapportRendu, true);
  await request(teacherToken, 'PUT', `/travaux-encadres/${work.id}`, { rapportRendu: 'false' }, 400);
  const defense = await request(
    admin,
    'POST',
    '/soutenances',
    { travailEncadreId: work.id, date: new Date().toISOString(), presidentId: teacher.enseignantId },
    201,
  );
  await request(admin, 'POST', '/soutenances', { travailEncadreId: work.id, date: new Date().toISOString() }, 400);
  await request(teacherToken, 'PUT', `/soutenances/${defense.id}/hota`, { note: 15 }, 403);
  await request(admin, 'PUT', `/soutenances/${defense.id}/hota`, { note: 21 }, 400);
  await request(admin, 'PUT', `/soutenances/${defense.id}/hota`, { note: 15, mention: tag });
  const persisted = await prisma.travailEncadre.findUniqueOrThrow({
    where: { id: work.id },
    include: { soutenance: true },
  });
  assert.equal(persisted.statut, 'SOUTENU');
  assert.equal(persisted.soutenance.note, 15);
  await request(admin, 'DELETE', `/travaux-encadres/${work.id}`, null, 400);
  const html = await request(studentToken, 'GET', `/travaux-encadres/${work.id}/fiche`);
  assert.ok(html.includes(tag));
  const stranger = await prisma.travailEncadre.create({
    data: {
      intitule: tag + '-tiers',
      etudiantId: (await prisma.etudiant.findFirstOrThrow({ where: { id: { not: student.etudiantId } } })).id,
    },
  });
  created.works.push(stranger.id);
  await request(studentToken, 'GET', `/travaux-encadres/${stranger.id}`, null, 404);
  await request(studentToken, 'GET', `/travaux-encadres/${stranger.id}/fiche`, null, 404);
  checks.push(
    'rapport persisté, booléen strict, soutenance unique, note bornée et réservée au jury, fiche propriétaire',
  );
  const equipment = await request(admin, 'POST', '/equipements', { libelle: tag, emplacement: 'Salle QA' }, 201);
  created.equipments.push(equipment.id);
  assert.equal(equipment.codeQr, undefined);
  const qr = (await prisma.equipementCampus.findUniqueOrThrow({ where: { id: equipment.id } })).codeQr;
  const resolved = await request(null, 'GET', '/equipements/par-code/' + qr);
  assert.deepEqual(Object.keys(resolved).sort(), ['emplacement', 'id', 'libelle']);
  const ticket = await request(
    teacherToken,
    'POST',
    '/tickets',
    { equipementId: equipment.id, categorie: 'VIDEO', description: tag + '-panne' },
    201,
  );
  created.tickets.push(ticket.id);
  assert.equal(ticket.statut, 'OUVERT');
  await request(studentToken, 'GET', '/tickets/' + ticket.id, null, 404);
  assert.ok(!(await request(studentToken, 'GET', '/tickets?all=1')).data.some((row) => row.id === ticket.id));
  await request(teacherToken, 'POST', `/tickets/${ticket.id}/statut`, { statut: 'RESOLU' }, 403);
  await request(admin, 'POST', `/tickets/${ticket.id}/statut`, { statut: 'EN_COURS' }, 201);
  await request(admin, 'POST', `/tickets/${ticket.id}/statut`, { statut: 'RESOLU' }, 201);
  await request(admin, 'POST', `/tickets/${ticket.id}/statut`, { statut: 'EN_COURS' }, 400);
  const closed = await prisma.ticketSupport.findUniqueOrThrow({ where: { id: ticket.id } });
  assert.equal(closed.statut, 'RESOLU');
  assert.equal(closed.traiteParId, adminAccount.id);
  assert.ok(closed.traiteLe);
  await request(admin, 'PUT', '/equipements/' + equipment.id, { actif: false });
  await request(null, 'GET', '/equipements/par-code/' + qr, null, 404);
  await request(
    teacherToken,
    'POST',
    '/tickets',
    { equipementId: equipment.id, categorie: 'VIDEO', description: tag },
    400,
  );
  checks.push(
    'QR minimal, déclaration enseignant, refus tiers, prise en charge et résolution persistées, terminal protégé, équipement désactivé refusé',
  );
  const logs = await prisma.auditLog.findMany({
    where: { entiteId: { in: [work.id, ticket.id, equipment.id, defense.id] } },
  });
  for (const action of [
    'TRAVAIL_ENCADRE_CREE',
    'SOUTENANCE_CREEE',
    'SOUTENANCE_NOTEE',
    'TICKET_OUVERT',
    'TICKET_EN_COURS',
    'TICKET_RESOLU',
  ])
    assert.ok(
      logs.some((row) => row.action === action),
      action,
    );
  for (const log of logs.filter((row) => row.entite !== 'Equipement'))
    assert.ok(!log.details.includes(tag), 'Texte libre recopié dans le journal');
  checks.push('journal réel pour chaque étape ; textes des dossiers, tickets et mentions absents');
  const registrarToken = await login('scolarite@unipresence.gn', 'Passer@2026');
  const content = tag + '-contenu pédagogique fictif';
  const document = await request(
    registrarToken,
    'POST',
    '/documents',
    { titre: tag, fichier: 'data:text/plain;base64,' + Buffer.from(content).toString('base64'), public: false },
    201,
  );
  created.documents.push(document.id);
  assert.equal(document.fichier, undefined);
  assert.ok(!(await request(null, 'GET', '/documents?all=1')).data.some((row) => row.id === document.id));
  await request(null, 'GET', `/documents/${document.id}/fichier`, null, 404);
  await request(studentToken, 'GET', `/documents/${document.id}/fichier`, null, 404);
  await request(teacherToken, 'PUT', `/documents/${document.id}`, { public: true }, 403);
  await request(admin, 'GET', `/documents/${document.id}`);
  assert.equal(await request(registrarToken, 'GET', `/documents/${document.id}/fichier`), content);
  const directionToken = await login('direction@unipresence.gn', 'Passer@2026');
  await request(directionToken, 'PUT', `/documents/${document.id}`, { public: true }, 403);
  await request(directionToken, 'DELETE', `/documents/${document.id}`, null, 403);
  await request(registrarToken, 'PUT', `/documents/${document.id}`, { public: true });
  const publicRow = (await request(null, 'GET', '/documents?all=1')).data.find((row) => row.id === document.id);
  assert.ok(publicRow);
  assert.equal(publicRow.deposePar, undefined);
  assert.equal(publicRow.etudiant, undefined);
  assert.equal(publicRow.fichier, undefined);
  assert.equal(await request(null, 'GET', `/documents/${document.id}/fichier`), content);
  assert.equal((await prisma.documentDepot.findUniqueOrThrow({ where: { id: document.id } })).telechargements, 2);
  await request(registrarToken, 'PUT', `/documents/${document.id}`, { public: false });
  await request(null, 'GET', `/documents/${document.id}/fichier`, null, 404);
  const downloadLogs = await prisma.auditLog.findMany({
    where: { entiteId: document.id, action: 'DOCUMENT_DEPOT_TELECHARGE' },
  });
  assert.equal(downloadLogs.length, 1);
  await request(registrarToken, 'DELETE', `/documents/${document.id}`);
  assert.equal(await prisma.documentDepot.findUnique({ where: { id: document.id } }), null);
  const documentLogs = await prisma.auditLog.findMany({ where: { entiteId: document.id } });
  for (const action of [
    'DOCUMENT_DEPOT_CREE',
    'DOCUMENT_DEPOT_MODIFIE',
    'DOCUMENT_DEPOT_TELECHARGE',
    'DOCUMENT_DEPOT_SUPPRIME',
  ])
    assert.ok(
      documentLogs.some((row) => row.action === action),
      action,
    );
  assert.ok(documentLogs.every((row) => !row.details?.includes(tag)));
  checks.push(
    'bibliothèque : dépôt privé, refus visiteur/étudiant/enseignant et non-déposant, publication, octets téléchargés, compteur exact, retrait et suppression audités sans contenu',
  );
  const category = await request(
    admin,
    'POST',
    '/patrimoine/categories',
    { code: tag, libelle: 'Matériel QA', dureeAmortissement: 5 },
    201,
  );
  created.categories.push(category.id);
  const asset = await request(
    registrarToken,
    'POST',
    '/patrimoine/equipements',
    {
      numeroSerie: tag,
      numeroInventaire: tag,
      libelle: 'Projecteur QA',
      categorieId: category.id,
      valeurAcquisition: 100000,
    },
    201,
  );
  created.assets.push(asset.id);
  const assetQr = (await prisma.equipementPatrimoine.findUniqueOrThrow({ where: { id: asset.id } })).qrCode;
  const scanned = await request(null, 'GET', `/patrimoine/equipements/par-qr/${assetQr}`);
  for (const field of ['numeroSerie', 'numeroInventaire', 'valeurAcquisition', 'qrCode', 'reparations'])
    assert.equal(scanned[field], undefined);
  await request(studentToken, 'GET', `/patrimoine/equipements/${asset.id}`, null, 403);
  await request(admin, 'GET', '/patrimoine/reparations?statut=invalide', null, 400);
  await request(directionToken, 'POST', `/patrimoine/equipements/${asset.id}/reparation`, { description: tag }, 403);
  const repairText = 'Confidentiel-' + randomUUID();
  const declarations = await Promise.all(
    [1, 2].map(() =>
      fetch(api + `/patrimoine/equipements/${asset.id}/reparation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${registrarToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: repairText, prestataire: repairText, cout: 15000 }),
      }),
    ),
  );
  assert.deepEqual(
    declarations.map((r) => r.status).sort(),
    [201, 409],
    'Deux déclarations concurrentes doivent produire une seule réparation',
  );
  const repair = await prisma.reparationMateriel.findFirstOrThrow({ where: { equipementId: asset.id } });
  assert.equal(await prisma.reparationMateriel.count({ where: { equipementId: asset.id } }), 1);
  assert.equal((await prisma.equipementPatrimoine.findUniqueOrThrow({ where: { id: asset.id } })).enReparation, true);
  await request(admin, 'DELETE', `/patrimoine/equipements/${asset.id}`, null, 409);
  const resolutions = await Promise.all(
    [1, 2].map(() =>
      fetch(api + `/patrimoine/equipements/${asset.id}/reparation/resoudre`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${registrarToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteResolution: repairText }),
      }),
    ),
  );
  assert.deepEqual(
    resolutions.map((r) => r.status).sort(),
    [201, 400],
    'Une seule résolution concurrente doit être enregistrée',
  );
  await request(registrarToken, 'POST', `/patrimoine/equipements/${asset.id}/reparation/resoudre`, {}, 400);
  const repaired = await prisma.reparationMateriel.findUniqueOrThrow({ where: { id: repair.id } });
  assert.equal(repaired.statut, 'TERMINE');
  assert.ok(repaired.resoluParId && repaired.dateResolution);
  assert.equal((await prisma.equipementPatrimoine.findUniqueOrThrow({ where: { id: asset.id } })).enReparation, false);
  await request(registrarToken, 'POST', `/patrimoine/equipements/${asset.id}/qr`, {}, 201);
  await request(null, 'GET', `/patrimoine/equipements/par-qr/${assetQr}`, null, 404);
  const assetLogs = await prisma.auditLog.findMany({ where: { entiteId: repair.id } });
  for (const action of ['PATRIMOINE_REPARATION_DECLAREE', 'PATRIMOINE_REPARATION_RESOLUE'])
    assert.ok(
      assetLogs.some((row) => row.action === action),
      action,
    );
  assert.equal(assetLogs.filter((row) => row.action === 'PATRIMOINE_REPARATION_RESOLUE').length, 1);
  assert.ok(assetLogs.every((row) => !row.details?.includes(repairText) && !row.details?.includes(assetQr)));
  observations.patrimoine = {
    declarationStatuses: declarations.map((r) => r.status).sort(),
    resolutionStatuses: resolutions.map((r) => r.status).sort(),
    repairCount: 1,
    repairStatus: repaired.statut,
    equipmentInRepair: false,
    resolutionAuditCount: 1,
    publicQrFinancialFieldsAbsent: true,
    repairFreeTextAndQrAbsentFromAudit: true,
  };
  checks.push(
    'patrimoine : QR public réduit, rôles, deux déclarations concurrentes départagées, une fiche, résolution et état matériel atomiques, conservation historique, ancien QR révoqué, journal sans texte',
  );
  const letterText = 'Correspondance confidentielle-' + randomUUID();
  const letter = await request(
    registrarToken,
    'POST',
    '/courrier',
    {
      numero: tag,
      type: 'ENTRANT',
      objet: letterText,
      circuit: [
        { ordre: 1, roleValideur: 'Secrétariat' },
        { ordre: 2, roleValideur: 'Direction' },
        { ordre: 3, roleValideur: 'Archives' },
      ],
    },
    201,
  );
  created.letters.push(letter.id);
  await request(teacherToken, 'GET', '/courrier/' + letter.id, null, 403);
  await request(
    registrarToken,
    'POST',
    `/courrier/${letter.id}/parapher/${letter.circuits[2].id}`,
    { paraphe: letterText },
    400,
  );
  await request(registrarToken, 'PUT', '/courrier/' + letter.id, { statut: 'ARCHIVE' }, 403);
  const signatures = await Promise.all(
    [1, 2].map(() =>
      fetch(api + `/courrier/${letter.id}/parapher/${letter.circuits[0].id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${registrarToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paraphe: letterText }),
      }),
    ),
  );
  assert.deepEqual(signatures.map((r) => r.status).sort(), [201, 400]);
  await request(registrarToken, 'POST', `/courrier/${letter.id}/parapher/${letter.circuits[1].id}`, {}, 404);
  await request(
    directionToken,
    'POST',
    `/courrier/${letter.id}/parapher/${letter.circuits[1].id}`,
    { commentaire: letterText },
    201,
  );
  await request(
    registrarToken,
    'POST',
    `/courrier/${letter.id}/parapher/${letter.circuits[2].id}`,
    { paraphe: letterText },
    201,
  );
  assert.equal((await prisma.courrier.findUniqueOrThrow({ where: { id: letter.id } })).statut, 'TRAITE');
  await request(registrarToken, 'POST', `/courrier/${letter.id}/cloturer`, {}, 403);
  await request(admin, 'POST', `/courrier/${letter.id}/cloturer`, {}, 201);
  await request(admin, 'POST', `/courrier/${letter.id}/cloturer`, {}, 201);
  await request(admin, 'POST', `/courrier/${letter.id}/cloturer`, {}, 400);
  await request(admin, 'PUT', '/courrier/' + letter.id, { notes: letterText }, 400);
  assert.equal((await prisma.courrier.findUniqueOrThrow({ where: { id: letter.id } })).statut, 'ARCHIVE');
  const printLetter = await request(registrarToken, 'GET', `/courrier/${letter.id}/imprimer`);
  assert.ok(printLetter.includes(letterText));
  const letterLogs = await prisma.auditLog.findMany({ where: { entiteId: letter.id } });
  assert.equal(letterLogs.filter((row) => row.action === 'COURRIER_PARAPHE').length, 3);
  assert.equal(letterLogs.filter((row) => row.action === 'COURRIER_CLOTURE').length, 2);
  assert.ok(letterLogs.every((row) => !row.details?.includes(letterText)));
  observations.courrier = {
    signatureStatuses: signatures.map((r) => r.status).sort(),
    signatureAuditCount: 3,
    closureAuditCount: 2,
    finalStatus: 'ARCHIVE',
    freeTextAbsentFromAudit: true,
  };
  checks.push(
    'courrier : étapes dans l’ordre, paraphe unique concurrent, rôles des étapes, changement de statut par PUT refusé, classement/archivage ADMIN, archive figée, impression protégée, journal sans texte',
  );
  const year = await prisma.anneeAcademique.findFirstOrThrow({ where: { active: true, cloturee: false } });
  const housed = await prisma.attributionLogement.findMany({
    where: { anneeId: year.id, statut: 'ACCORDE' },
    select: { etudiantId: true },
  });
  const applicant = await prisma.etudiant.findFirstOrThrow({
    where: { id: { notIn: housed.map((row) => row.etudiantId) }, actif: true },
  });
  const residence = await request(admin, 'POST', '/residences', { code: tag, nom: 'Résidence QA', capacite: 2 }, 201);
  created.residences.push(residence.id);
  const rooms = [];
  for (const suffix of ['A', 'B']) {
    const room = await request(
      admin,
      'POST',
      '/chambres',
      { code: tag + suffix, residenceId: residence.id, lits: 1 },
      201,
    );
    created.rooms.push(room.id);
    rooms.push(room);
  }
  await request(studentToken, 'GET', '/attributions-logement', null, 403);
  const applications = [];
  for (const room of rooms)
    applications.push(
      await request(
        registrarToken,
        'POST',
        '/attributions-logement',
        { chambreId: room.id, etudiantId: applicant.id, anneeId: year.id, critereScore: 80 },
        201,
      ),
    );
  await request(admin, 'PUT', '/chambres/' + rooms[1].id, { statut: 'MAINTENANCE' });
  await request(
    directionToken,
    'PUT',
    `/attributions-logement/${applications[1].id}/decider`,
    { statut: 'ACCORDE' },
    400,
  );
  await request(admin, 'PUT', '/chambres/' + rooms[1].id, { statut: 'RESERVE' });
  await request(
    registrarToken,
    'PUT',
    `/attributions-logement/${applications[0].id}/decider`,
    { statut: 'ACCORDE' },
    403,
  );
  await request(directionToken, 'PUT', `/attributions-logement/${applications[0].id}/decider`, { statut: 'ACCORDE' });
  await request(
    directionToken,
    'PUT',
    `/attributions-logement/${applications[1].id}/decider`,
    { statut: 'ACCORDE' },
    400,
  );
  await request(admin, 'PUT', '/chambres/' + rooms[0].id, { statut: 'LIBRE' }, 400);
  // 409 et non 400 : la demande est licite, c'est l'état du parc qui la
  // refuse (la chambre porte une attribution, la résidence des chambres).
  await request(admin, 'DELETE', '/chambres/' + rooms[0].id, null, 409);
  await request(admin, 'DELETE', '/residences/' + residence.id, null, 409);
  await request(admin, 'PUT', `/attributions-logement/${applications[0].id}/retirer`, {
    motif: 'Départ fictif de recette',
  });
  assert.equal((await prisma.chambre.findUniqueOrThrow({ where: { id: rooms[0].id } })).statut, 'LIBRE');
  await request(directionToken, 'PUT', `/attributions-logement/${applications[1].id}/decider`, { statut: 'ACCORDE' });
  assert.equal((await prisma.chambre.findUniqueOrThrow({ where: { id: rooms[1].id } })).statut, 'OCCUPE');
  assert.equal(
    await prisma.attributionLogement.count({
      where: { etudiantId: applicant.id, anneeId: year.id, statut: 'ACCORDE' },
    }),
    1,
  );
  await request(admin, 'PUT', `/attributions-logement/${applications[1].id}/retirer`, {});
  await request(admin, 'PUT', `/attributions-logement/${applications[1].id}/retirer`, {}, 400);
  const renewed = [];
  for (const room of rooms)
    renewed.push(
      await request(
        registrarToken,
        'POST',
        '/attributions-logement',
        { chambreId: room.id, etudiantId: applicant.id, anneeId: year.id },
        201,
      ),
    );
  const decisions = await Promise.all(
    renewed.map((application) =>
      fetch(api + `/attributions-logement/${application.id}/decider`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${directionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'ACCORDE' }),
      }),
    ),
  );
  assert.equal(decisions.filter((r) => r.status === 200).length, 1);
  assert.ok(decisions.some((r) => [400, 409].includes(r.status)));
  const finalAllocations = await prisma.attributionLogement.count({
    where: { etudiantId: applicant.id, anneeId: year.id, statut: 'ACCORDE' },
  });
  assert.equal(finalAllocations, 1);
  observations.logements = {
    secondRoomRefused: true,
    maintenanceDecisionRefused: true,
    manualVacancyRefused: true,
    allocationCountBeforeDeparture: 1,
    roomsReleasedAfterWithdrawal: true,
    historicalDeletionRefused: true,
    concurrentDecisionStatuses: decisions.map((r) => r.status).sort(),
    finalAllocations,
  };
  checks.push(
    'logements : demande au guichet, décision direction, une chambre par étudiant/année, état occupé protégé, retrait libérant la chambre, historique conservé, accès étudiant au registre refusé',
  );
}
main()
  .then(() => {
    const report = {
      date: new Date().toISOString(),
      database: database.pathname.slice(1),
      checks,
      observations,
      productionUntouched: true,
    };
    if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.soutenance.deleteMany({ where: { travailEncadreId: { in: created.works } } });
    await prisma.travailEncadre.deleteMany({ where: { id: { in: created.works } } });
    await prisma.ticketSupport.deleteMany({ where: { id: { in: created.tickets } } });
    await prisma.equipementCampus.deleteMany({ where: { id: { in: created.equipments } } });
    await prisma.documentDepot.deleteMany({ where: { id: { in: created.documents } } });
    await prisma.reparationMateriel.deleteMany({ where: { equipementId: { in: created.assets } } });
    await prisma.equipementPatrimoine.deleteMany({ where: { id: { in: created.assets } } });
    await prisma.categoriePatrimoine.deleteMany({ where: { id: { in: created.categories } } });
    await prisma.circuitCourrier.deleteMany({ where: { courrierId: { in: created.letters } } });
    await prisma.courrier.deleteMany({ where: { id: { in: created.letters } } });
    await prisma.attributionLogement.deleteMany({ where: { chambreId: { in: created.rooms } } });
    await prisma.chambre.deleteMany({ where: { id: { in: created.rooms } } });
    await prisma.residence.deleteMany({ where: { id: { in: created.residences } } });
    await prisma.$disconnect();
  });
