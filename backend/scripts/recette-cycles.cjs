/** Cycles réels par HTTP, données isolées et supprimées en fin de recette. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const base = process.env.QA_API_URL || 'http://127.0.0.1:15031/api';
const dbUrl = new URL(process.env.DATABASE_URL);
if (
  !['localhost', '127.0.0.1'].includes(new URL(base).hostname) ||
  !['localhost', '127.0.0.1'].includes(dbUrl.hostname) ||
  !/^\/university_qa_\d+$/.test(dbUrl.pathname)
)
  throw Error('API et base QA locales obligatoires');
const db = new PrismaClient();
const checks = [];
const fixtures = { etudiants: [], paiements: [], demandes: [], reservations: [], reclamations: [] };
function check(name, value, expected) {
  assert.deepEqual(value, expected, name);
  checks.push({ name, result: 'OK' });
}
async function call(path, token, method = 'GET', body, expected) {
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
  if (expected) check(`${method} ${path}`, response.status, expected);
  else assert.ok(response.ok, `${method} ${path}: ${response.status} ${text.slice(0, 300)}`);
  return data;
}
async function login(email, password = 'Passer@2026') {
  return (await call('/auth/login', null, 'POST', { email, password })).token;
}
(async () => {
  try {
    const prefix = `QA-${Date.now()}`;
    const admin = await login('admin@unipresence.gn');
    const sco = await login('scolarite@unipresence.gn');
    const direction = await login('direction@unipresence.gn');
    const chef = await login('chef.info@unipresence.gn');
    const otherStudent = await login('etudiant1@university.gn', 'Etu#2026');
    const agent = await db.user.findUniqueOrThrow({ where: { email: 'scolarite@unipresence.gn' } });
    const chief = await db.user.findUniqueOrThrow({ where: { email: 'chef.info@unipresence.gn' } });
    const filiere = await db.filiere.findFirstOrThrow({ where: { departementId: { not: chief.departementId } } });
    const matiere = await db.matiere.findFirstOrThrow();
    const salle = await db.salle.findFirstOrThrow();
    fixtures.annee = await db.anneeAcademique.create({
      data: { libelle: prefix, dateDebut: new Date('2099-01-01'), dateFin: new Date('2099-12-31') },
    });
    fixtures.promotion = await db.promotion.create({
      data: { nom: prefix, niveau: 'L1', filiereId: filiere.id, anneeId: fixtures.annee.id },
    });
    const email = `${prefix.toLowerCase()}@example.test`;
    const etudiant = await call('/etudiants', sco, 'POST', {
      nom: prefix,
      prenom: 'Recette',
      email,
      creerCompte: true,
      motDePasse: 'QA-Cycles!2099',
    });
    fixtures.etudiants.push(etudiant.id);
    const student = await login(email, 'QA-Cycles!2099');
    const inscription = await call('/inscriptions', sco, 'POST', {
      etudiantId: etudiant.id,
      anneeId: fixtures.annee.id,
      promotionId: fixtures.promotion.id,
      montantFrais: 1000,
    });
    check('Inscription initiale en attente de paiement', inscription.statut, 'EN_ATTENTE_PAIEMENT');
    await call(`/inscriptions/${inscription.id}/valider`, sco, 'PUT', {}, 400);
    const paiement = await call('/paiements', sco, 'POST', {
      montant: inscription.montantFrais,
      mode: 'ESPECES',
      inscriptionId: inscription.id,
      etudiantId: etudiant.id,
    });
    fixtures.paiements.push(paiement.id);
    await call(`/paiements/${paiement.id}/simuler`, admin, 'POST', { statut: 'REUSSI' });
    check(
      'Paiement enregistré dans le dossier',
      (await db.inscription.findUniqueOrThrow({ where: { id: inscription.id } })).statut,
      'PAYEE',
    );
    const validee = await call(`/inscriptions/${inscription.id}/valider`, sco, 'PUT', {});
    check('Validation par scolarité', validee.statut, 'VALIDEE');
    await call(`/inscriptions/${inscription.id}/valider`, sco, 'PUT', {}, 200);
    const certificat = await call(`/inscriptions/${inscription.id}/attestation-inscription`, student);
    check('Certificat du propriétaire produit', typeof certificat === 'string' && certificat.includes(prefix), true);
    await call(`/inscriptions/${inscription.id}/attestation-inscription`, otherStudent, 'GET', undefined, 404);

    await call(
      '/documents-demande',
      otherStudent,
      'POST',
      { type: 'ATTESTATION_SCOLARITE', inscriptionId: inscription.id },
      404,
    );
    const demande = await call('/documents-demande', student, 'POST', {
      type: 'ATTESTATION_SCOLARITE',
      inscriptionId: inscription.id,
      motif: prefix,
    });
    fixtures.demandes.push(demande.id);
    check('Demande tarifée en attente', demande.statut, 'EN_ATTENTE_PAIEMENT');
    await call(`/documents-demande/${demande.id}/remettre`, sco, 'POST', {}, 400);
    const payDoc = await call(`/documents-demande/${demande.id}/payer`, student, 'POST', { mode: 'ESPECES' });
    fixtures.paiements.push(payDoc.paiementId);
    await call(`/documents-demande/${demande.id}/confirmer-paiement`, sco, 'POST', { paiementId: payDoc.paiementId });
    check(
      'Paiement confirmé et traitement démarré',
      (await call(`/documents-demande/${demande.id}`, student)).statut,
      'EN_TRAITEMENT',
    );
    await call(`/documents-demande/${demande.id}/prete`, sco, 'POST', {});
    check('Document prêt', (await call(`/documents-demande/${demande.id}`, student)).statut, 'PRETE');
    await call(`/documents-demande/${demande.id}/remettre`, sco, 'POST', { noteRemise: prefix });
    check('Document remis', (await call(`/documents-demande/${demande.id}`, student)).statut, 'REMISE');
    await call(`/documents-demande/${demande.id}`, otherStudent, 'GET', undefined, 404);

    const evaluation = await call('/evaluations', sco, 'POST', {
      intitule: prefix,
      type: 'EXAMEN',
      matiereId: matiere.id,
      promotionId: fixtures.promotion.id,
      anneeId: fixtures.annee.id,
    });
    await call(`/evaluations/${evaluation.id}`, chef, 'GET', undefined, 404);
    await call(`/notes/evaluation/${evaluation.id}`, chef, 'GET', undefined, 404);
    await call(
      '/notes/saisie',
      chef,
      'PUT',
      { evaluationId: evaluation.id, notes: [{ inscriptionId: inscription.id, note: 20 }] },
      404,
    );
    const saisie = await call('/notes/saisie', sco, 'PUT', {
      evaluationId: evaluation.id,
      notes: [{ inscriptionId: inscription.id, note: 16, present: true }],
    });
    check('Note enregistrée', saisie.n, 1);
    await call(`/evaluations/${evaluation.id}/cloturer`, sco, 'POST', {});
    await call(
      '/notes/saisie',
      sco,
      'PUT',
      { evaluationId: evaluation.id, notes: [{ inscriptionId: inscription.id, note: 2 }] },
      400,
    );
    const delib = await call('/deliberations', sco, 'POST', {
      anneeId: fixtures.annee.id,
      promotionId: fixtures.promotion.id,
      session: 'NORMALE',
    });
    const delibId = delib.id;
    const resultats = await call(`/deliberations/${delibId}`, sco);
    check('Moyenne délibérée', resultats.lignes[0].moyenne, 16);
    check('Décision du jury calculée', resultats.lignes[0].decision, 'ADMIS');
    await call(`/deliberations/${delibId}`, chef, 'GET', undefined, 404);
    await call(`/deliberations/${delibId}/imprimer`, chef, 'GET', undefined, 404);
    await call(`/deliberations/${delibId}/valider`, sco, 'POST', {}, 403);
    await call(`/deliberations/${delibId}/valider`, direction, 'POST', {});
    await call(`/deliberations/${delibId}/calculer`, sco, 'POST', {}, 400);
    check(
      'Bulletin individuel généré',
      (await call(`/deliberations/${delibId}/releve/${inscription.id}`, sco)).includes(prefix),
      true,
    );
    for (const path of ['/evaluations', '/notes', '/deliberations']) {
      const rows = await call(
        `${path}?all=true&${path === '/notes' ? 'evaluationId=' + evaluation.id : 'anneeId=' + fixtures.annee.id}`,
        chef,
      );
      check(
        `Résultats tiers absents de ${path}`,
        rows.data.some((row) => row.id === evaluation.id || row.id === delibId || row.evaluationId === evaluation.id),
        false,
      );
    }

    const reclamation = await call('/reclamations', student, 'POST', {
      type: 'SCOLARITE',
      sujet: prefix,
      description: 'Vérification du cycle de traitement en recette locale.',
    });
    fixtures.reclamations.push(reclamation.id);
    check('Réclamation ouverte', reclamation.statut, 'OUVERTE');
    await call(`/reclamations/${reclamation.id}`, otherStudent, 'GET', undefined, 404);
    await call(`/reclamations/${reclamation.id}/assigner`, sco, 'PUT', { assigneAId: agent.id });
    await call(`/reclamations/${reclamation.id}/messages`, student, 'POST', {
      contenu: 'Complément fourni par le demandeur.',
    });
    await call(`/reclamations/${reclamation.id}/statut`, sco, 'PUT', { statut: 'RESOLUE' }, 400);
    await call(`/reclamations/${reclamation.id}/statut`, sco, 'PUT', {
      statut: 'RESOLUE',
      commentaire: 'Demande traitée lors de la recette.',
    });
    await call(`/reclamations/${reclamation.id}/cloturer`, direction, 'POST', { noteCloture: prefix });
    check(
      'Réclamation résolue avec clôture',
      (await call(`/reclamations/${reclamation.id}`, student)).statut,
      'RESOLUE',
    );
    await call(`/reclamations/${reclamation.id}/messages`, student, 'POST', { contenu: 'Message après clôture' }, 400);

    const reservation = await call('/reservations', sco, 'POST', {
      salleId: salle.id,
      motif: prefix,
      dateJour: '2099-06-12',
      heureDebut: '09:00',
      heureFin: '10:00',
    });
    fixtures.reservations.push(reservation.id);
    await call(`/reservations/${reservation.id}/decider`, sco, 'POST', { statut: 'CONFIRMEE' }, 403);
    await call(`/reservations/${reservation.id}/decider`, direction, 'POST', { statut: 'CONFIRMEE' });
    check('Réservation confirmée', (await call(`/reservations/${reservation.id}`, sco)).statut, 'CONFIRMEE');
    const collision = await fetch(base + '/reservations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sco}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salleId: salle.id,
        motif: prefix,
        dateJour: '2099-06-12',
        heureDebut: '09:30',
        heureFin: '10:30',
      }),
    });
    check('Collision salle refusée', collision.status, 409);

    const teacher = await db.enseignant.findFirstOrThrow({ where: { statut: 'VACATAIRE' } });
    fixtures.affectation = await db.affectation.create({
      data: {
        enseignantId: teacher.id,
        matiereId: matiere.id,
        promotionId: fixtures.promotion.id,
        anneeId: fixtures.annee.id,
        volumeHorairePrevu: 10,
      },
    });
    fixtures.seance = await db.seance.create({
      data: {
        affectationId: fixtures.affectation.id,
        anneeId: fixtures.annee.id,
        salleId: salle.id,
        date: new Date('2099-01-12'),
        heureDebut: '09:00',
        heureFin: '11:00',
        statut: 'CONTROLEE',
        type: 'CM',
      },
    });
    await db.controle.create({
      data: {
        seanceId: fixtures.seance.id,
        controleurId: agent.id,
        statut: 'PRESENT',
        dureeMinutes: 120,
        methode: 'MANUEL',
      },
    });
    const feuille = await call('/feuilles-paie', admin, 'POST', { mois: 1, annee: 2099 });
    fixtures.feuille = feuille.id;
    const calc = await call(`/feuilles-paie/${feuille.id}/calculer`, sco, 'POST', {});
    const ligne = calc.lignes.find((row) => row.enseignantId === teacher.id);
    check('Paie : deux heures de service fait', ligne.heuresReelles, 2);
    check('Paie : montant calculé au taux du vacataire', ligne.montantNet, 2 * teacher.tauxHoraire);
    const recalcul = await call(`/feuilles-paie/${feuille.id}/calculer`, sco, 'POST', {});
    check('Recalcul idempotent de la paie', recalcul.montantTotal, calc.montantTotal);
    await call(`/feuilles-paie/${feuille.id}/valider`, direction, 'POST', {});
    await call(`/feuilles-paie/${feuille.id}/calculer`, sco, 'POST', {}, 400);
    await call(`/feuilles-paie/${feuille.id}/payer`, sco, 'POST', {}, 403);
    await call(`/feuilles-paie/${feuille.id}/payer`, admin, 'POST', {});
    check('Paie exécutée', (await call(`/feuilles-paie/${feuille.id}`, sco)).statut, 'PAYEE');
    await call(`/feuilles-paie/${feuille.id}`, student, 'GET', undefined, 403);
    fs.writeFileSync(
      process.env.QA_REPORT || '/tmp/university-cycles.json',
      JSON.stringify({ date: new Date().toISOString(), environment: 'QA locale', checks }, null, 2),
    );
    console.log(JSON.stringify({ checks: checks.length, result: 'OK' }));
  } finally {
    await db.reclamation.deleteMany({ where: { id: { in: fixtures.reclamations } } });
    await db.reservationSalle.deleteMany({ where: { id: { in: fixtures.reservations } } });
    await db.demandeDocument.deleteMany({ where: { id: { in: fixtures.demandes } } });
    await db.paiement.deleteMany({ where: { id: { in: fixtures.paiements.filter(Boolean) } } });
    if (fixtures.feuille) await db.feuillePaie.delete({ where: { id: fixtures.feuille } });
    if (fixtures.annee) await db.anneeAcademique.delete({ where: { id: fixtures.annee.id } });
    await db.user.deleteMany({ where: { etudiant: { id: { in: fixtures.etudiants } } } });
    await db.etudiant.deleteMany({ where: { id: { in: fixtures.etudiants } } });
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
