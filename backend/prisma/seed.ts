/**
 * Jeu de données de démonstration : une faculté guinéenne type, son emploi du
 * temps, et six semaines de contrôles déjà effectués.
 *
 *   bun run seed        (ou : npx ts-node prisma/seed.ts)
 */
import {
  AttestationMode,
  MethodeVerification,
  ModePaiement,
  Niveau,
  PrismaClient,
  Role,
  StatutEnseignant,
  StatutInscription,
  StatutPaiement,
  StatutPresence,
  StatutSeance,
  TypeCours,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { chiffrer } from '../src/common/coffre';

const prisma = new PrismaClient();

/** Générateur pseudo-aléatoire déterministe (même jeu de données à chaque seed). */
let graine = 42;
const alea = () => {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
};
const piocher = <T>(liste: T[]): T => liste[Math.floor(alea() * liste.length)];

/** Fausse signature manuscrite (SVG en data-url) pour rendre le registre réaliste. */
const signatureDemo = (graine: number) => {
  const p = Array.from({ length: 6 }, (_, i) => {
    const x = 10 + i * 22;
    const y = 30 + Math.sin(graine + i * 1.7) * 14;
    return `${i ? 'S' : 'M'}${x},${y} ${x + 11},${y + (i % 2 ? 12 : -12)}`;
  }).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="60"><path d="${p}" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const heure = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function main() {
  console.log('→ Nettoyage…');
  // Modules récents : suppression en cascade pour idempotence
  await prisma.vueVOD.deleteMany();
  await prisma.coursVOD.deleteMany();
  await prisma.voteElection.deleteMany();
  await prisma.candidatElection.deleteMany();
  await prisma.election.deleteMany();
  await prisma.badgeAcces.deleteMany();
  await prisma.carteEtudiante.deleteMany();
  await prisma.messageReclamation.deleteMany();
  await prisma.reclamation.deleteMany();
  await prisma.tarifDemande.deleteMany();
  await prisma.demandeDocument.deleteMany();
  await prisma.recetteExterne.deleteMany();
  await prisma.tirage.deleteMany();
  await prisma.scanExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.circuitCourrier.deleteMany();
  await prisma.courrier.deleteMany();
  await prisma.reparationMateriel.deleteMany();
  await prisma.equipementPatrimoine.deleteMany();
  await prisma.categoriePatrimoine.deleteMany();
  await prisma.statistiqueMesrs.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.suspicionPlagiat.deleteMany();
  await prisma.documentDepot.deleteMany();
  // Modules principaux
  await prisma.auditLog.deleteMany();
  await prisma.justificatif.deleteMany();
  await prisma.controle.deleteMany();
  await prisma.seance.deleteMany();
  await prisma.creneau.deleteMany();
  await prisma.affectation.deleteMany();
  await prisma.matiere.deleteMany();
  await prisma.ticketSupport.deleteMany();
  await prisma.equipementCampus.deleteMany();
  await prisma.recharge.deleteMany();
  await prisma.consommationResto.deleteMany();
  await prisma.portefeuilleResto.deleteMany();
  await prisma.attributionLogement.deleteMany();
  await prisma.chambre.deleteMany();
  await prisma.residence.deleteMany();
  await prisma.lignePaie.deleteMany();
  await prisma.feuillePaie.deleteMany();
  await prisma.attestation.deleteMany();
  await prisma.deliberationLigne.deleteMany();
  await prisma.deliberation.deleteMany();
  await prisma.note.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.paiement.deleteMany();
  await prisma.inscription.deleteMany();
  await prisma.inscriptionFormation.deleteMany();
  await prisma.formation.deleteMany();
  await prisma.soutenance.deleteMany();
  await prisma.travailEncadre.deleteMany();
  await prisma.reservationSalle.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.filiere.deleteMany();
  await prisma.enseignant.deleteMany();
  await prisma.etudiant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.departement.deleteMany();
  await prisma.salle.deleteMany();
  await prisma.anneeAcademique.deleteMany();
  await prisma.parametre.deleteMany();

  // ------------------------------------------------------------- paramétrage
  await prisma.parametre.createMany({
    data: [
      { cle: 'NOM_ETABLISSEMENT', valeur: 'Université Gamal Abdel Nasser de Conakry' },
      { cle: 'TOLERANCE_RETARD_MIN', valeur: '15' },
      { cle: 'ABSENCE_APRES_MIN', valeur: '30' },
      { cle: 'DUREE_MIN_VALIDE', valeur: '30' },
      { cle: 'QR_OBLIGATOIRE', valeur: 'false' },
      { cle: 'GEOLOC_OBLIGATOIRE', valeur: 'false' },
      { cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'true' },
      { cle: 'SIGNATURE_OBLIGATOIRE', valeur: 'false' },
      { cle: 'EMPREINTE_SCORE_MIN', valeur: '60' },
      { cle: 'EFFECTIF_OBLIGATOIRE', valeur: 'true' },
    ],
  });

  // --------------------------------------------------------- année académique
  const annee = await prisma.anneeAcademique.create({
    data: {
      libelle: '2025-2026',
      dateDebut: dateOnly('2025-10-01'),
      dateFin: dateOnly('2026-07-31'),
      active: true,
    },
  });

  // ------------------------------------------------------------- départements
  const departements = await Promise.all(
    [
      { code: 'INFO', nom: 'Informatique', faculte: 'Sciences & Techniques' },
      { code: 'MATH', nom: 'Mathématiques', faculte: 'Sciences & Techniques' },
      { code: 'GC', nom: 'Génie Civil', faculte: 'Sciences & Techniques' },
      { code: 'ECO', nom: 'Sciences Économiques', faculte: 'Sciences Économiques et Gestion' },
    ].map((d) => prisma.departement.create({ data: d })),
  );
  const [info, math, gc, eco] = departements;

  // -------------------------------------------------------------------- salles
  const salles = await Promise.all(
    [
      { code: 'AMPHI-A', nom: 'Amphithéâtre A', batiment: 'Bloc pédagogique', capacite: 350 },
      { code: 'AMPHI-B', nom: 'Amphithéâtre B', batiment: 'Bloc pédagogique', capacite: 250 },
      { code: 'S101', nom: 'Salle 101', batiment: 'Bloc A', capacite: 60 },
      { code: 'S102', nom: 'Salle 102', batiment: 'Bloc A', capacite: 60 },
      { code: 'S204', nom: 'Salle 204', batiment: 'Bloc B', capacite: 45 },
      { code: 'LAB-INFO', nom: 'Laboratoire informatique', batiment: 'Bloc C', capacite: 30 },
    ].map((s, i) =>
      prisma.salle.create({
        data: {
          ...s,
          qrToken: `UP-${randomBytes(9).toString('base64url')}`,
          // Campus de Dixinn, Conakry
          latitude: 9.5335 + i * 0.0002,
          longitude: -13.6875 + i * 0.0002,
          rayonMetres: 80,
        },
      }),
    ),
  );

  // ------------------------------------------------------------------ filières
  const filieres = await Promise.all([
    prisma.filiere.create({ data: { code: 'GL', nom: 'Génie Logiciel', departementId: info.id } }),
    prisma.filiere.create({ data: { code: 'RT', nom: 'Réseaux & Télécoms', departementId: info.id } }),
    prisma.filiere.create({ data: { code: 'MA', nom: 'Mathématiques Appliquées', departementId: math.id } }),
    prisma.filiere.create({ data: { code: 'BTP', nom: 'Bâtiment & Travaux Publics', departementId: gc.id } }),
    prisma.filiere.create({ data: { code: 'GES', nom: 'Gestion des Entreprises', departementId: eco.id } }),
  ]);

  // ---------------------------------------------------------------- promotions
  const promotions = await Promise.all(
    [
      { nom: 'L1 Génie Logiciel', niveau: Niveau.L1, effectif: 120, filiere: filieres[0] },
      { nom: 'L2 Génie Logiciel', niveau: Niveau.L2, effectif: 84, filiere: filieres[0] },
      { nom: 'L3 Génie Logiciel', niveau: Niveau.L3, effectif: 61, filiere: filieres[0] },
      { nom: 'L2 Réseaux & Télécoms', niveau: Niveau.L2, effectif: 73, filiere: filieres[1] },
      { nom: 'M1 Mathématiques Appliquées', niveau: Niveau.M1, effectif: 32, filiere: filieres[2] },
      { nom: 'L3 Bâtiment & Travaux Publics', niveau: Niveau.L3, effectif: 55, filiere: filieres[3] },
      { nom: 'L1 Gestion des Entreprises', niveau: Niveau.L1, effectif: 210, filiere: filieres[4] },
    ].map((p) =>
      prisma.promotion.create({
        data: {
          nom: p.nom,
          niveau: p.niveau,
          effectif: p.effectif,
          filiereId: p.filiere.id,
          anneeId: annee.id,
        },
      }),
    ),
  );

  // --------------------------------------------------------------- enseignants
  const donneesEnseignants = [
    ['ENS-001', 'CAMARA', 'Mamadou', 'Maître de conférences', StatutEnseignant.PERMANENT, 0, info],
    ['ENS-002', 'DIALLO', 'Aïssatou', 'Maître-assistant', StatutEnseignant.PERMANENT, 0, info],
    ['ENS-003', 'BAH', 'Ousmane', 'Assistant', StatutEnseignant.VACATAIRE, 75000, info],
    ['ENS-004', 'SOW', 'Fatoumata', 'Professeur', StatutEnseignant.PERMANENT, 0, math],
    ['ENS-005', 'BARRY', 'Alpha', 'Maître-assistant', StatutEnseignant.VACATAIRE, 65000, math],
    ['ENS-006', 'CONDÉ', 'Sékou', 'Assistant', StatutEnseignant.CONTRACTUEL, 55000, gc],
    ['ENS-007', 'TOURÉ', 'Mariama', 'Maître de conférences', StatutEnseignant.PERMANENT, 0, gc],
    ['ENS-008', 'KEÏTA', 'Ibrahima', 'Maître-assistant', StatutEnseignant.VACATAIRE, 70000, eco],
    ['ENS-009', 'SYLLA', 'Kadiatou', 'Assistant', StatutEnseignant.VACATAIRE, 60000, eco],
    ['ENS-010', 'BALDÉ', 'Thierno', 'Maître-assistant', StatutEnseignant.PERMANENT, 0, info],
  ] as const;

  // Code personnel de démonstration commun (à changer en production) et
  // empreinte enrôlée pour les quatre premiers enseignants.
  const codePinDemo = await bcrypt.hash('2468', 10);

  const enseignants = await Promise.all(
    donneesEnseignants.map(([matricule, nom, prenom, grade, statut, taux, dep], i) =>
      prisma.enseignant.create({
        data: {
          matricule,
          nom,
          prenom,
          grade,
          statut,
          tauxHoraire: taux,
          departementId: dep.id,
          email: `${prenom.toLowerCase()}.${nom.toLowerCase().replace(/[^a-z]/g, '')}@univ-conakry.gn`,
          telephone: `+224 62${Math.floor(1000000 + alea() * 8999999)}`,
          codePin: codePinDemo,
          codePinDefiniLe: new Date(),
          ...(i < 4
            ? {
                // Chiffré comme en production : le seed ne doit pas être le
                // seul endroit où de la biométrie traîne en clair.
                empreinteTemplate: chiffrer(
                  `SIMU-${matricule}-${Buffer.from(matricule).toString('base64url')}`,
                ),
                empreinteDoigt: 'index droit',
                empreinteEnroleeLe: new Date(),
                empreinteConsentementLe: new Date(),
                empreinteConsentementPar: 'Scolarité (données de démonstration)',
              }
            : {}),
        },
      }),
    ),
  );

  // ------------------------------------------------------------------ comptes
  const motDePasse = await bcrypt.hash('Passer@2026', 10);
  const comptes = [
    ['admin@unipresence.gn', 'ADMIN', 'Système', Role.ADMIN, null],
    ['direction@unipresence.gn', 'BANGOURA', 'Lansana', Role.DIRECTION, null],
    ['scolarite@unipresence.gn', 'DOUMBOUYA', 'Hawa', Role.SCOLARITE, null],
    ['controleur1@unipresence.gn', 'SOUMAH', 'Facinet', Role.CONTROLEUR, null],
    ['controleur2@unipresence.gn', 'KOUROUMA', 'Nènè', Role.CONTROLEUR, null],
    ['chef.info@unipresence.gn', 'CAMARA', 'Mamadou', Role.CHEF_DEPARTEMENT, info.id],
  ] as const;

  const users = await Promise.all(
    comptes.map(([email, nom, prenom, role, departementId]) =>
      prisma.user.create({
        data: { email, nom, prenom, role, departementId, password: motDePasse },
      }),
    ),
  );
  const controleurs = users.filter((u) => u.role === Role.CONTROLEUR);

  // Compte enseignant rattaché à sa fiche
  const compteEnseignant = await prisma.user.create({
    data: {
      email: 'enseignant@unipresence.gn',
      nom: 'DIALLO',
      prenom: 'Aïssatou',
      role: Role.ENSEIGNANT,
      departementId: info.id,
      password: motDePasse,
    },
  });
  await prisma.enseignant.update({
    where: { id: enseignants[1].id },
    data: { userId: compteEnseignant.id },
  });

  // ------------------------------------------------------------------ matières
  const donneesMatieres = [
    ['INF101', 'Algorithmique et programmation', 60, 6, info],
    ['INF201', 'Bases de données', 45, 4, info],
    ['INF301', 'Génie logiciel', 45, 4, info],
    ['INF302', 'Systèmes d’exploitation', 40, 4, info],
    ['RES201', 'Réseaux informatiques', 50, 5, info],
    ['MAT101', 'Analyse mathématique', 60, 6, math],
    ['MAT301', 'Probabilités et statistiques', 45, 4, math],
    ['GC301', 'Résistance des matériaux', 50, 5, gc],
    ['GC302', 'Topographie', 40, 4, gc],
    ['ECO101', 'Introduction à l’économie', 45, 4, eco],
    ['GES201', 'Comptabilité générale', 50, 5, eco],
  ] as const;

  const matieres = await Promise.all(
    donneesMatieres.map(([code, intitule, volume, credits, dep]) =>
      prisma.matiere.create({
        data: {
          code,
          intitule,
          volumeHoraireTotal: volume,
          credits,
          departementId: dep.id,
        },
      }),
    ),
  );

  // --------------------------------------------------------------- affectations
  const plan: Array<[number, number, number]> = [
    // [enseignant, matière, promotion]
    [0, 0, 0], [1, 1, 1], [0, 2, 2], [9, 3, 2], [2, 4, 3],
    [3, 5, 0], [4, 6, 4], [6, 7, 5], [5, 8, 5], [7, 9, 6], [8, 10, 6],
    [1, 0, 6], [9, 1, 3],
  ];

  const affectations = await Promise.all(
    plan.map(([e, m, p]) =>
      prisma.affectation.create({
        data: {
          enseignantId: enseignants[e].id,
          matiereId: matieres[m].id,
          promotionId: promotions[p].id,
          anneeId: annee.id,
          volumeHorairePrevu: matieres[m].volumeHoraireTotal,
        },
      }),
    ),
  );

  // ------------------------------------------------------------- emploi du temps
  const plagesHoraires = [
    ['08:00', '10:00'],
    ['10:15', '12:15'],
    ['13:00', '15:00'],
    ['15:15', '17:15'],
  ];

  const creneaux = await Promise.all(
    affectations.map((a, i) =>
      prisma.creneau.create({
        data: {
          affectationId: a.id,
          jourSemaine: (i % 5) + 1, // du lundi au vendredi
          heureDebut: plagesHoraires[Math.floor(i / 5) % 4][0],
          heureFin: plagesHoraires[Math.floor(i / 5) % 4][1],
          type: piocher([TypeCours.CM, TypeCours.TD, TypeCours.TP]),
          salleId: salles[i % salles.length].id,
        },
      }),
    ),
  );

  // ---------------------------------------- séances des 6 dernières semaines + 2 à venir
  const aujourdhui = new Date();
  const debut = new Date(aujourdhui);
  debut.setUTCDate(debut.getUTCDate() - 42);
  const fin = new Date(aujourdhui);
  fin.setUTCDate(fin.getUTCDate() + 14);

  const themes = [
    'Introduction et plan du cours',
    'Étude de cas pratique',
    'Correction des travaux dirigés',
    'Chapitre 2 : approfondissement',
    'Exercices d’application',
    'Évaluation continue',
    'Travaux pratiques encadrés',
  ];

  let creees = 0;
  let controles = 0;

  for (let d = new Date(debut); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    const jour = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    const jourIso = isoDate(d);
    const passe = jourIso < isoDate(aujourdhui);

    for (const c of creneaux.filter((c) => c.jourSemaine === jour)) {
      const seance = await prisma.seance.create({
        data: {
          affectationId: c.affectationId,
          creneauId: c.id,
          anneeId: annee.id,
          date: dateOnly(jourIso),
          heureDebut: c.heureDebut,
          heureFin: c.heureFin,
          type: c.type,
          salleId: c.salleId,
          thematique: piocher(themes),
          statut: StatutSeance.PLANIFIEE,
        },
      });
      creees++;
      if (!passe) continue;

      // 12 % des séances passées échappent au contrôle (contrôleur absent)
      if (alea() < 0.12) continue;

      const tirage = alea();
      const statut =
        tirage < 0.72
          ? StatutPresence.PRESENT
          : tirage < 0.85
            ? StatutPresence.RETARD
            : tirage < 0.93
              ? StatutPresence.ABSENT
              : tirage < 0.97
                ? StatutPresence.REMPLACE
                : StatutPresence.DEPART_ANTICIPE;

      const present = statut !== StatutPresence.ABSENT;
      const retardMin =
        statut === StatutPresence.RETARD ? 18 + Math.floor(alea() * 20) : Math.floor(alea() * 10);
      const arrivee = heure(minutes(c.heureDebut) + retardMin);
      const finReelle =
        statut === StatutPresence.DEPART_ANTICIPE
          ? heure(minutes(c.heureFin) - (25 + Math.floor(alea() * 30)))
          : heure(minutes(c.heureFin) - Math.floor(alea() * 8));

      const duree = present ? minutes(finReelle) - minutes(arrivee) : 0;
      const promotion = promotions.find(
        (p) => p.id === affectations.find((a) => a.id === c.affectationId)!.promotionId,
      )!;

      // Modalité d'attestation utilisée par l'enseignant présent
      const tirageAttestation = alea();
      const modeAttestation = !present
        ? AttestationMode.AUCUNE
        : tirageAttestation < 0.5
          ? AttestationMode.SIGNATURE
          : tirageAttestation < 0.78
            ? AttestationMode.CODE_PIN
            : AttestationMode.EMPREINTE;

      await prisma.controle.create({
        data: {
          seanceId: seance.id,
          controleurId: piocher(controleurs).id,
          statut,
          attestation: modeAttestation,
          attestationValide: present,
          attestationLe: present ? new Date(`${jourIso}T${arrivee}:00.000Z`) : null,
          signatureBase64:
            modeAttestation === AttestationMode.SIGNATURE ? signatureDemo(alea() * 10) : null,
          empreinteScore:
            modeAttestation === AttestationMode.EMPREINTE
              ? 62 + Math.floor(alea() * 36)
              : null,
          heureArrivee: present ? arrivee : null,
          heureFinReelle: present ? finReelle : null,
          dureeMinutes: Math.max(0, duree),
          effectifPresent: present
            ? Math.floor(promotion.effectif * (0.45 + alea() * 0.45))
            : null,
          thematiqueTraitee: present ? piocher(themes) : null,
          observation:
            statut === StatutPresence.ABSENT
              ? 'Enseignant non présent en salle à l’heure du passage'
              : statut === StatutPresence.RETARD
                ? `Séance démarrée avec ${retardMin} minutes de retard`
                : statut === StatutPresence.REMPLACE
                  ? 'Cours assuré par un collègue du département'
                  : null,
          methode: piocher([
            MethodeVerification.QR_SALLE,
            MethodeVerification.MANUEL,
            MethodeVerification.SIGNATURE,
            MethodeVerification.GEOLOCALISATION,
          ]),
          qrSalleValide: alea() < 0.6,
          enseignantRemplacantId:
            statut === StatutPresence.REMPLACE ? piocher(enseignants).id : null,
          horodatage: new Date(`${jourIso}T${arrivee}:00.000Z`),
        },
      });

      await prisma.seance.update({
        where: { id: seance.id },
        data: {
          statut: present ? StatutSeance.CONTROLEE : StatutSeance.NON_TENUE,
        },
      });
      controles++;
    }
  }

  // ---------------------------------------------------------- justificatifs
  const absences = await prisma.seance.findMany({
    where: { controle: { statut: StatutPresence.ABSENT } },
    include: { affectation: true },
    take: 6,
  });

  for (const [i, s] of absences.entries()) {
    const valide = i < 2;
    await prisma.justificatif.create({
      data: {
        seanceId: s.id,
        enseignantId: s.affectation.enseignantId,
        type: piocher(['MALADIE', 'MISSION', 'DEUIL', 'TRANSPORT'] as any),
        motif: piocher([
          'Consultation médicale urgente (certificat joint)',
          'Mission académique à Kankan',
          'Deuil familial',
          'Indisponibilité de transport — grève des taxis',
        ]),
        statut: valide ? 'VALIDE' : i < 4 ? 'EN_ATTENTE' : 'REJETE',
        traiteParId: valide || i >= 4 ? users[1].id : null,
        traiteLe: valide || i >= 4 ? new Date() : null,
        commentaire: i >= 4 ? 'Aucune pièce justificative fournie' : null,
      },
    });

    // Une absence justifiée devient une absence excusée (même règle que l'API).
    if (valide) {
      await prisma.controle.update({
        where: { seanceId: s.id },
        data: { statut: StatutPresence.EXCUSE, observation: 'Absence justifiée et validée' },
      });
    }
  }

  console.log(`✔ ${departements.length} départements, ${filieres.length} filières, ${promotions.length} promotions`);
  console.log(`✔ ${enseignants.length} enseignants, ${matieres.length} matières, ${affectations.length} affectations`);
  console.log(`✔ ${creneaux.length} créneaux, ${creees} séances générées, ${controles} contrôles`);
  console.log(`✔ ${salles.length} salles (QR générés), ${absences.length} justificatifs`);
  // --------------------------------------- Module 1 : étudiants & inscriptions
  console.log('→ Registre des étudiants (Module 1)…');

  const motDePasseEtudiant = await bcrypt.hash('Etu#2026', 10);

  const etudiants = await Promise.all(
    [
      ['2026-0001', 'DOUMBOUYA', 'Sory', 'M', 'Kankan', '622000001', 'etudiant1@university.gn'],
      ['2026-0002', 'DIALLO', 'Mariama', 'F', 'Conakry', '622000002', 'etudiant2@university.gn'],
      ['2026-0003', 'BALDÉ', 'Alpha', 'M', 'Labé', '622000003', 'etudiant3@university.gn'],
    ].map(([matricule, nom, prenom, sexe, ville, telephone, email]) =>
      prisma.etudiant.create({
        data: {
          matricule,
          nom,
          prenom,
          sexe,
          dateNaissance: dateOnly('2005-06-15'),
          lieuNaissance: ville,
          telephone,
          email,
          adresse: `${ville}, Guinée`,
          qrRestoToken: `UP-RESTO-${randomBytes(9).toString('base64url')}`,
        },
      }),
    ),
  );

  // Comptes du portail étudiant (portail, notes, attestations, resto…)
  const comptesEtudiants = await Promise.all(
    etudiants.map((e) =>
      prisma.user.create({
        data: {
          email: e.email!,
          nom: e.nom,
          prenom: e.prenom,
          telephone: e.telephone,
          role: Role.ETUDIANT,
          password: motDePasseEtudiant,
        },
      }),
    ),
  );
  await Promise.all(
    etudiants.map((e, i) =>
      prisma.etudiant.update({ where: { id: e.id }, data: { userId: comptesEtudiants[i].id } }),
    ),
  );

  // Tarifs d'inscription : 500 000 GNF en L1, 650 000 GNF en L2 (Génie Logiciel)
  await Promise.all([
    prisma.frais.create({
      data: { anneeId: annee.id, promotionId: promotions[0].id, montant: 500000, devise: 'GNF' },
    }),
    prisma.frais.create({
      data: { anneeId: annee.id, promotionId: promotions[1].id, montant: 650000, devise: 'GNF' },
    }),
  ]);

  // Dossiers : Sory payé puis validé par la scolarité, Mariama en attente de
  // paiement, Alpha payé en attente de validation.
  const inscriptions = [
    await prisma.inscription.create({
      data: {
        numero: 'INS-2026-00001',
        etudiantId: etudiants[0].id,
        anneeId: annee.id,
        promotionId: promotions[0].id,
        statut: StatutInscription.VALIDEE,
        montantFrais: 500000,
        dateInscription: new Date(),
        valideeParId: users[2].id,
        valideeLe: new Date(),
      },
    }),
    await prisma.inscription.create({
      data: {
        numero: 'INS-2026-00002',
        etudiantId: etudiants[1].id,
        anneeId: annee.id,
        promotionId: promotions[1].id,
        statut: StatutInscription.EN_ATTENTE_PAIEMENT,
        montantFrais: 650000,
      },
    }),
    await prisma.inscription.create({
      data: {
        numero: 'INS-2026-00003',
        etudiantId: etudiants[2].id,
        anneeId: annee.id,
        promotionId: promotions[0].id,
        statut: StatutInscription.PAYEE,
        montantFrais: 500000,
      },
    }),
  ];

  const paiements = [
    await prisma.paiement.create({
      data: {
        reference: 'PAY-2026-00001',
        montant: 500000,
        devise: 'GNF',
        mode: ModePaiement.MOBILE_MONEY,
        operateur: 'ORANGE_MONEY',
        telephone: '622000001',
        nomComplet: 'Sory DOUMBOUYA',
        motif: 'Frais d’inscription — Sory DOUMBOUYA 2025-2026',
        statut: StatutPaiement.REUSSI,
        inscriptionId: inscriptions[0].id,
        etudiantId: etudiants[0].id,
        completeLe: new Date(),
        creeParId: users[1].id,
      },
    }),
    await prisma.paiement.create({
      data: {
        reference: 'PAY-2026-00002',
        montant: 500000,
        devise: 'GNF',
        mode: ModePaiement.MOBILE_MONEY,
        operateur: 'MTN_MOMO',
        telephone: '622000002',
        nomComplet: 'Mariama DIALLO',
        motif: 'Frais d’inscription — Mariama DIALLO 2025-2026',
        statut: StatutPaiement.EN_ATTENTE,
        inscriptionId: inscriptions[1].id,
        etudiantId: etudiants[1].id,
        creeParId: users[1].id,
      },
    }),
  ];

  // ===================================================================
  // Modules « université innovante » : seed des nouveaux modèles
  // ===================================================================
  console.log('→ Seed des nouveaux modules…');

  // Récupération des références utiles
  const anneeActive = await prisma.anneeAcademique.findFirst({ where: { active: true } });
  const allPromotions = await prisma.promotion.findMany({ include: { filiere: { include: { departement: true } } } });
  const allMatieres = await prisma.matiere.findMany();
  const allSalles = await prisma.salle.findMany();
  const adminUser = users.find((u) => u.role === Role.ADMIN)!;
  const directionUser = users.find((u) => u.role === Role.DIRECTION)!;
  const scolariteUser = users.find((u) => u.role === Role.SCOLARITE)!;
  const chefInfo = users.find((u) => u.role === Role.CHEF_DEPARTEMENT && u.departementId === info.id)!;
  const enseignant1 = await prisma.enseignant.findFirst({ where: { matricule: 'ENS-001' } });
  const enseignant2 = await prisma.enseignant.findFirst({ where: { matricule: 'ENS-002' } });
  const promoL1Info = allPromotions.find((p) => p.niveau === Niveau.L1 && p.filiere?.code === 'GL')!;
  const promoM1Math = allPromotions.find((p) => p.niveau === Niveau.M1 && p.filiere?.code === 'MA')!;
  const salleAmphi = allSalles.find((s) => s.code === 'AMPHI-A')!;
  const salle204 = allSalles.find((s) => s.code === 'S204')!;

  // ---- 1. Patrimoine & Matériel pédagogique ----
  const categoriesPatrimoine = await Promise.all([
    prisma.categoriePatrimoine.create({ data: { code: 'VIDEOPROJ', libelle: 'Vidéoprojecteur', dureeAmortissement: 60 } }),
    prisma.categoriePatrimoine.create({ data: { code: 'ORDI',     libelle: 'Ordinateur',      dureeAmortissement: 36 } }),
    prisma.categoriePatrimoine.create({ data: { code: 'MICRO',    libelle: 'Microphone',      dureeAmortissement: 48 } }),
    prisma.categoriePatrimoine.create({ data: { code: 'CHAISE',   libelle: 'Chaise',         dureeAmortissement: 120 } }),
    prisma.categoriePatrimoine.create({ data: { code: 'TABLEAU',  libelle: 'Tableau blanc',  dureeAmortissement: 120 } }),
    prisma.categoriePatrimoine.create({ data: { code: 'IMPRIM',   libelle: 'Imprimante',     dureeAmortissement: 60 } }),
  ]);
  const equipementsPatrimoine: Awaited<ReturnType<typeof prisma.equipementPatrimoine.create>>[] = [];
  const numInv = 1;
  let inv = numInv;
  const eqList = [
    { libelle: 'Vidéoprojecteur Epson EB-X41', cat: 'VIDEOPROJ', valeur: 850000, salle: salleAmphi, dept: info.id },
    { libelle: 'Vidéoprojecteur Epson EB-X41', cat: 'VIDEOPROJ', valeur: 850000, salle: allSalles[1], dept: math.id },
    { libelle: 'Vidéoprojecteur BenQ MS550',   cat: 'VIDEOPROJ', valeur: 720000, salle: salle204, dept: info.id },
    { libelle: 'Ordinateur Dell OptiPlex 7090', cat: 'ORDI',    valeur: 1450000, salle: allSalles[5], dept: info.id },
    { libelle: 'Ordinateur Dell OptiPlex 7090', cat: 'ORDI',    valeur: 1450000, salle: allSalles[5], dept: info.id },
    { libelle: 'Ordinateur Lenovo ThinkCentre', cat: 'ORDI',     valeur: 1200000, salle: salle204, dept: math.id },
    { libelle: 'Microphone sans fil Shure',   cat: 'MICRO',    valeur: 320000, salle: salleAmphi, dept: null },
    { libelle: 'Microphone sans fil Shure',   cat: 'MICRO',    valeur: 320000, salle: allSalles[1], dept: null },
    { libelle: 'Chaise pédagogique (lot de 50)', cat: 'CHAISE', valeur: 350000, salle: salleAmphi, dept: null },
    { libelle: 'Chaise pédagogique (lot de 40)', cat: 'CHAISE', valeur: 280000, salle: allSalles[1], dept: null },
    { libelle: 'Tableau blanc interactif',    cat: 'TABLEAU',  valeur: 480000, salle: salleAmphi, dept: info.id },
    { libelle: 'Tableau blanc interactif',    cat: 'TABLEAU',  valeur: 480000, salle: salle204, dept: info.id },
    { libelle: 'Imprimante HP LaserJet Pro',  cat: 'IMPRIM',   valeur: 620000, salle: allSalles[4], dept: eco.id },
  ];
  for (const eq of eqList) {
    const cat = categoriesPatrimoine.find((c) => c.code === eq.cat)!;
    const eqItem = await prisma.equipementPatrimoine.create({
      data: {
        numeroSerie: `SN-${String(inv).padStart(6, '0')}`,
        numeroInventaire: `INV-${String(inv).padStart(6, '0')}`,
        libelle: eq.libelle,
        categorieId: cat.id,
        departementId: eq.dept,
        salleId: eq.salle?.id ?? null,
        dateAcquisition: dateOnly('2023-09-15'),
        valeurAcquisition: eq.valeur,
        qrCode: `UP-PAT-${randomBytes(8).toString('base64url')}`,
        obsolescenceMois: 84,
      },
    });
    equipementsPatrimoine.push(eqItem);
    inv++;
  }
  // Quelques réparations en cours
  const reparation = await prisma.reparationMateriel.create({
    data: {
      equipementId: equipementsPatrimoine[0].id,
      description: 'Lampe grillée après 4000h d\u2019utilisation',
      prestataire: 'Tech Service Conakry',
      cout: 95000,
      statut: 'EN_COURS',
      dateResolution: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      declareParId: scolariteUser.id,
    },
  });
  await prisma.reparationMateriel.create({
    data: {
      equipementId: equipementsPatrimoine[3].id,
      description: 'Écran bleu au démarrage, alimentation HS',
      statut: 'TERMINE',
      cout: 175000,
      declareParId: adminUser.id,
      resoluParId: adminUser.id,
      dateResolution: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  // ---- 2. Courrier administratif ----
  const courrierEntrant = await prisma.courrier.create({
    data: {
      numero: 'COUR-2026-00001',
      type: 'ENTRANT',
      objet: 'Convention de partenariat UGAN-CBG',
      expediteur: 'Direction Générale CBG',
      dateReception: dateOnly('2026-08-01'),
      numeroReference: 'CBG/REF/2026/0042',
      fichier: null, typeMime: null, tailleKo: null,
      statut: 'EN_CIRCUIT',
      enregistreParId: scolariteUser.id,
      circuits: {
        create: [
          { ordre: 1, roleValideur: 'Secrétariat général', statut: 'TRAITE', parapheLe: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), commentaire: 'Réception et enregistrement' },
          { ordre: 2, roleValideur: 'Recteur', statut: 'EN_CIRCUIT', commentaire: 'Pour signature' },
        ],
      },
    },
  });
  const courrierSortant = await prisma.courrier.create({
    data: {
      numero: 'COUR-2026-00002',
      type: 'SORTANT',
      objet: 'Demande de subvention MESRS — bibliothèque numérique',
      destinataire: 'Ministère de Enseignement Supérieur',
      dateEnvoi: dateOnly('2026-08-10'),
      statut: 'TRAITE',
      enregistreParId: directionUser.id,
      traiteParId: directionUser.id,
      circuits: {
        create: [
          { ordre: 1, roleValideur: 'Direction des études', statut: 'TRAITE', parapheLe: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
          { ordre: 2, roleValideur: 'Recteur', statut: 'TRAITE', parapheLe: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        ],
      },
    },
  });
  const courrierArchive = await prisma.courrier.create({
    data: {
      numero: 'COUR-2026-00003',
      type: 'ENTRANT',
      objet: 'Invitation cérémonie doctorale honorifique',
      expediteur: 'Université Cheikh Anta Diop',
      dateReception: dateOnly('2026-07-15'),
      numeroReference: 'UCAD/DIP/2026/015',
      statut: 'CLASSE',
      enregistreParId: scolariteUser.id,
      traiteParId: directionUser.id,
    },
  });

  // ---- 3. Examens + Anti-fantômes ----
  const finalAlgo = await prisma.examen.create({
    data: {
      intitule: 'Algorithmique — Examen final',
      type: 'FINAL',
      matiereId: allMatieres.find((m) => m.code === 'INF101')!.id,
      promotionId: promoL1Info.id,
      anneeId: anneeActive!.id,
      dateExamen: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      heureDebut: '08:00', heureFin: '10:00',
      salleId: salleAmphi.id,
      nbInscrits: 8,
      codeExamen: 'EXAM-2026-0001',
      statut: 'PLANIFIE',
      creeParId: scolariteUser.id,
      surveillantId: compteEnseignant.id,
    },
  });
  const partielAlgo = await prisma.examen.create({
    data: {
      intitule: 'Algorithmique — Partiel',
      type: 'PARTIEL',
      matiereId: allMatieres.find((m) => m.code === 'INF101')!.id,
      promotionId: promoL1Info.id,
      anneeId: anneeActive!.id,
      dateExamen: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      heureDebut: '14:00', heureFin: '15:30',
      salleId: salle204.id,
      nbInscrits: 8,
      codeExamen: 'EXAM-2026-0002',
      statut: 'TERMINE',
      creeParId: scolariteUser.id,
    },
  });
  // Scans d'exemple (5 étudiants déjà scannés pour le partiel)
  const inscriptionsL1 = await prisma.inscription.findMany({ where: { promotionId: promoL1Info.id, statut: 'VALIDEE' } });
  for (let i = 0; i < Math.min(5, inscriptionsL1.length); i++) {
    await prisma.scanExamen.create({
      data: {
        examenId: partielAlgo.id,
        inscriptionId: inscriptionsL1[i].id,
        heureScan: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + (10 + i) * 60 * 1000),
        valide: true,
        scanneurId: scolariteUser.id,
      },
    });
  }
  await prisma.examen.update({
    where: { id: partielAlgo.id },
    data: { nbPresents: Math.min(5, inscriptionsL1.length) },
  });
  // Un scan rejeté
  if (inscriptionsL1.length > 0) {
    await prisma.scanExamen.create({
      data: {
        examenId: partielAlgo.id,
        matriculeSaisi: '2026-9999',
        nomPorteur: 'INCONNU',
        prenomPorteur: '',
        valide: false,
        motifRejet: 'Carte autre',
        scanneurId: scolariteUser.id,
      },
    });
  }

  // ---- 4. Tirage épreuves ----
  const tirage = await prisma.tirage.create({
    data: {
      examenId: partielAlgo.id,
      dateTirage: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      imprimeurId: adminUser.id,
      nbExemplaires: 12,
      empreinteSource: 'sha256:abc123def456...',
      empreinteExemplaires: 'sha256:ex1,sha256:ex2,sha256:ex3,sha256:ex4,sha256:ex5,sha256:ex6,sha256:ex7,sha256:ex8,sha256:ex9,sha256:ex10,sha256:ex11,sha256:ex12',
      circuitImpression: 'Salle reprographie A → Coffre-fort direction',
      stade: 'RECUPERE',
      notes: 'Tirage conforme — 12 copies conformes aux émargements',
    },
  });
  await prisma.tirage.create({
    data: {
      examenId: finalAlgo.id,
      dateTirage: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      imprimeurId: adminUser.id,
      nbExemplaires: 10,
      empreinteSource: 'sha256:xyz789...',
      stade: 'PROGRAMME',
    },
  });

  // ---- 5. Régie des recettes ----
  const recettes = await Promise.all([
    prisma.recetteExterne.create({ data: { numero: 'REC-2026-00001', type: 'LOCATION_AMPHI', libelle: 'Location Amphithéâtre A — Colloque AUF', description: 'Colloque sous-régional 2 jours', montant: 2500000, date: dateOnly('2026-08-05'), client: 'Agence Universitaire de la Francophonie' } }),
    prisma.recetteExterne.create({ data: { numero: 'REC-2026-00002', type: 'ANALYSE_LABO', libelle: 'Analyse spectrométrique — Échantillon CMDT-2026-008', description: 'Spectrométrie IR + UV-Vis', montant: 850000, date: dateOnly('2026-08-08'), client: 'Compagnie Minière de Dinguiraye', factureNum: 'FA-2026-0021' } }),
    prisma.recetteExterne.create({ data: { numero: 'REC-2026-00003', type: 'PRESTATION_FORMATION', libelle: 'Formation continue Excel avancé — Cohorte 1', description: '24h sur 4 jours, 18 participants', montant: 1800000, date: dateOnly('2026-07-22'), client: 'Banque Centrale de Guinée' } }),
    prisma.recetteExterne.create({ data: { numero: 'REC-2026-00004', type: 'PRESTATION_CONSEIL', libelle: 'Audit organisationnel — Service pédagogique', montant: 450000, date: dateOnly('2026-08-12'), client: 'Université Kindia' } }),
  ]);

  // ---- 6. Réclamations & Requêtes ----
  const reclamations: Awaited<ReturnType<typeof prisma.reclamation.create>>[] = [];
  reclamations.push(await prisma.reclamation.create({
    data: {
      numero: 'REC-CLAIM-00001',
      type: 'NOTE_MANQUANTE',
      sujet: 'Note de CC absente',
      description: 'Ma note de contrôle continu d\u2019algorithmique n\u2019est pas affichée. J\u2019ai composé la semaine du 12 mai.',
      etudiantId: etudiants[0].id,
      priorite: 'NORMALE',
      statut: 'EN_COURS',
      assigneAId: scolariteUser.id,
      messages: {
        create: [
          { contenu: 'Bonjour, j\u2019ai composé mon CC le 12 mai mais la note n\u2019apparaît pas dans mon bulletin. Merci de vérifier.', nomAffichage: 'Sory DOUMBOUYA', creeLe: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
          { contenu: 'Bonjour, nous vérifions avec l\u2019enseignant et revenons vers vous sous 48h.', auteurId: scolariteUser.id, nomAffichage: 'Scolarité', creeLe: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        ],
      },
    },
  }));
  reclamations.push(await prisma.reclamation.create({
    data: {
      numero: 'REC-CLAIM-00002',
      type: 'ERREUR_SAISIE',
      sujet: 'Erreur de saisie sur mon relevé',
      description: 'Ma note de maths affiche 7/20 mais j\u2019ai eu 14/20 à l\u2019examen.',
      etudiantId: etudiants[1].id,
      priorite: 'HAUTE',
      statut: 'RESOLUE',
      assigneAId: scolariteUser.id,
      fermeLe: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      messages: {
        create: [
          { contenu: 'Note corrigée après vérification.', auteurId: scolariteUser.id, nomAffichage: 'Scolarité' },
        ],
      },
    },
  }));
  reclamations.push(await prisma.reclamation.create({
    data: {
      numero: 'REC-CLAIM-00003',
      type: 'ENSEIGNEMENT',
      sujet: 'Cours non dispensés depuis 3 semaines',
      description: 'Le cours de Base de données n\u2019a pas eu lieu depuis le début du mois.',
      anonyme: true,
      nomAuteur: 'Étudiant L3 INFO',
      emailAuteur: 'anonyme@ugan.gn',
      priorite: 'URGENTE',
      statut: 'OUVERTE',
      departementId: info.id,
    },
  }));

  // ---- 7. Demandes de documents en ligne ----
  const tarifs = await Promise.all([
    prisma.tarifDemande.create({ data: { type: 'ATTESTATION_SCOLARITE', montant: 25000, delaiHeures: 24 } }),
    prisma.tarifDemande.create({ data: { type: 'ATTESTATION_FREQUENTATION', montant: 15000, delaiHeures: 24 } }),
    prisma.tarifDemande.create({ data: { type: 'RELEVE_NOTES', montant: 35000, delaiHeures: 48 } }),
    prisma.tarifDemande.create({ data: { type: 'DUPLICATA_CARTE', montant: 50000, delaiHeures: 72 } }),
    prisma.tarifDemande.create({ data: { type: 'ATTESTATION_REUSSITE', montant: 30000, delaiHeures: 24 } }),
  ]);
  await Promise.all([
    prisma.demandeDocument.create({ data: { numero: 'DOC-2026-00001', type: 'ATTESTATION_SCOLARITE', motif: 'Dossier de bourse', etudiantId: etudiants[0].id, frais: 25000, statut: 'PRETE', notification: 'Votre attestation est prête au guichet', traiteParId: scolariteUser.id } }),
    prisma.demandeDocument.create({ data: { numero: 'DOC-2026-00002', type: 'RELEVE_NOTES', motif: 'Constitution dossier master', etudiantId: etudiants[1].id, frais: 35000, statut: 'EN_TRAITEMENT', traiteParId: scolariteUser.id } }),
    prisma.demandeDocument.create({ data: { numero: 'DOC-2026-00003', type: 'DUPLICATA_CARTE', motif: 'Carte perdue', etudiantId: etudiants[2].id, frais: 50000, statut: 'PAYEE' } }),
    prisma.demandeDocument.create({ data: { numero: 'DOC-2026-00004', type: 'ATTESTATION_FREQUENTATION', motif: 'Stage en entreprise', etudiantId: etudiants[2].id, frais: 15000, statut: 'EN_ATTENTE_PAIEMENT' } }),
  ]);

  // ---- 8. Carte étudiante numérique ----
  for (let i = 0; i < etudiants.length; i++) {
    const e = etudiants[i];
    const year = new Date().getFullYear();
    const validite = new Date(`${year + 1}-09-30`);
    await prisma.carteEtudiante.create({
      data: {
        etudiantId: e.id,
        qrToken: `UP-CARTE-${randomBytes(10).toString('base64url')}`,
        dateValidite: validite,
        statut: 'EMISE',
        creeParId: scolariteUser.id,
      },
    });
  }

  // ---- 9. Badges visiteurs ----
  await Promise.all([
    prisma.badgeAcces.create({ data: { numero: 'BADGE-2026-00001', type: 'VISITEUR', nom: 'CAMARA', prenom: 'Alpha Boubacar', organisation: 'Banque Mondiale', dateValidite: new Date(Date.now() + 24 * 60 * 60 * 1000), qrToken: `UP-BADGE-${randomBytes(10).toString('base64url')}` } }),
    prisma.badgeAcces.create({ data: { numero: 'BADGE-2026-00002', type: 'INTERVENANT', nom: 'DIALLO', prenom: 'Mamadou Saliou', fonction: 'Conférencier invité', organisation: 'AUF Dakar', dateValidite: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), qrToken: `UP-BADGE-${randomBytes(10).toString('base64url')}` } }),
    prisma.badgeAcces.create({ data: { numero: 'BADGE-2026-00003', type: 'TECHNICIEN', nom: 'SYLLA', prenom: 'Moussa', fonction: 'Maintenance réseau', organisation: 'SOGETEL', dateValidite: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), qrToken: `UP-BADGE-${randomBytes(10).toString('base64url')}` } }),
    prisma.badgeAcces.create({ data: { numero: 'BADGE-2026-00004', type: 'VIP', nom: 'BARRY', prenom: 'Hadja Mariama', fonction: 'Ministre de l\u2019Enseignement Supérieur', organisation: 'MESRS', dateValidite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), qrToken: `UP-BADGE-${randomBytes(10).toString('base64url')}` } }),
  ]);

  // ---- 10. VOD ----
  await Promise.all([
    prisma.coursVOD.create({ data: { titre: 'Introduction à l\u2019algorithmique', description: 'CM 1: définitions, complexité, structures de contrôle', matiereId: allMatieres.find((m) => m.code === 'INF101')!.id, enseignantId: enseignant1?.id, type: 'VIDEO', url: 'https://vod.university.gn/info101-cm1.mp4', thumbnailUrl: 'https://vod.university.gn/info101-cm1.jpg', dureeSecondes: 5400, transcription: 'Algorithme, complexité temporelle...', public: true, statut: 'EN_LIGNE', dateMiseEnLigne: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), nbVues: 87, nbComplets: 42, creeParId: adminUser.id } }),
    prisma.coursVOD.create({ data: { titre: 'Bases de données relationnelles', description: 'CM 3: algèbre relationnelle, SQL, jointures', matiereId: allMatieres.find((m) => m.code === 'INF201')!.id, enseignantId: enseignant2?.id, type: 'VIDEO', url: 'https://vod.university.gn/info201-cm3.mp4', dureeSecondes: 7200, public: true, statut: 'EN_LIGNE', dateMiseEnLigne: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), nbVues: 52, nbComplets: 21, creeParId: adminUser.id } }),
    prisma.coursVOD.create({ data: { titre: 'Microéconomie — CM 5', description: 'Offre et demande, équilibre', matiereId: allMatieres.find((m) => m.code === 'ECO101')!.id, type: 'AUDIO', url: 'https://vod.university.gn/eco101-cm5.mp3', dureeSecondes: 4800, public: true, statut: 'EN_LIGNE', nbVues: 24, creeParId: adminUser.id } }),
  ]);

  // ---- 11. Scolarité : Évaluations + Notes + Délibérations ( ----
  // Utiliser promoL1Info (L1 GL) et promoL1Eco = L1 GES
  const promoL1Ges = allPromotions.find((p) => p.niveau === Niveau.L1 && p.filiere?.code === 'GES')!;
  const evaluations = await Promise.all([
    prisma.evaluation.create({ data: { intitule: 'CC1 Algorithmique', type: 'CC', coefficient: 1, matiereId: allMatieres.find((m) => m.code === 'INF101')!.id, promotionId: promoL1Info.id, anneeId: anneeActive!.id, semestre: 1, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), statut: 'CLOTUREE' } }),
    prisma.evaluation.create({ data: { intitule: 'Examen final Algorithmique', type: 'EXAMEN', coefficient: 2, matiereId: allMatieres.find((m) => m.code === 'INF101')!.id, promotionId: promoL1Info.id, anneeId: anneeActive!.id, semestre: 1, date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), statut: 'CLOTUREE' } }),
    prisma.evaluation.create({ data: { intitule: 'CC1 Bases de données', type: 'CC', coefficient: 1, matiereId: allMatieres.find((m) => m.code === 'INF201')!.id, promotionId: promoL1Info.id, anneeId: anneeActive!.id, semestre: 1, date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), statut: 'CLOTUREE' } }),
    prisma.evaluation.create({ data: { intitule: 'Examen Microéconomie', type: 'EXAMEN', coefficient: 2, matiereId: allMatieres.find((m) => m.code === 'ECO101')!.id, promotionId: promoL1Ges.id, anneeId: anneeActive!.id, semestre: 1, date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), statut: 'CLOTUREE' } }),
    prisma.evaluation.create({ data: { intitule: 'CC1 Mathématiques', type: 'CC', coefficient: 1, matiereId: allMatieres.find((m) => m.code === 'MAT101')!.id, promotionId: promoM1Math!.id, anneeId: anneeActive!.id, semestre: 1, date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), statut: 'CLOTUREE' } }),
  ]);

  // Saisie des notes — 5 étudiants x 5 évaluations
  const notesCreees: { inscriptionId: string; evaluationId: string; note: number }[] = [];
  for (const ins of inscriptionsL1.slice(0, 5)) {
    for (const ev of evaluations.slice(0, 3)) {
      const note = Math.round((8 + Math.random() * 12) * 10) / 10; // 8-20/20
      await prisma.note.create({
        data: {
          evaluationId: ev.id,
          inscriptionId: ins.id,
          note,
          present: true,
          saisieParId: scolariteUser.id,
        },
      });
      notesCreees.push({ inscriptionId: ins.id, evaluationId: ev.id, note });
    }
  }

  // Délibération validée pour L1 INFO
  const deliberationL1 = await prisma.deliberation.create({
    data: {
      anneeId: anneeActive!.id,
      promotionId: promoL1Info.id,
      session: 'NORMALE',
      statut: 'VALIDEE',
      tauxReussite: 100,
      creeParId: scolariteUser.id,
      valideeParId: adminUser.id,
      valideeLe: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      commentaire: 'Tous les étudiants ont validé l\u2019unité d\u2019algorithmique (moyenne ≥ 10/20).',
    },
  });
  // Lignes de délibération — calcul moyenne pondérée par crédits
  const creditsParMatiere: Record<string, number> = { INF101: 6, INF201: 4, ECO101: 3, MAT101: 5, MAT301: 4, GES201: 4, GC301: 4, GC302: 4, INF301: 6, INF302: 4, RES201: 4 };
  for (const ins of inscriptionsL1.slice(0, 5)) {
    const mesNotes = notesCreees.filter((n) => n.inscriptionId === ins.id);
    if (!mesNotes.length) continue;
    // Moyenne par UE pondérée par coefficient d'épreuve et crédits de la matière
    const parUe = new Map<string, { num: number; den: number }>();
    for (const n of mesNotes) {
      const ev = evaluations.find((e) => e.id === n.evaluationId)!;
      const m = allMatieres.find((mat) => mat.id === ev.matiereId)!;
      const code = m.code;
      const credits = creditsParMatiere[code] ?? m.credits ?? 1;
      const cur = parUe.get(code) ?? { num: 0, den: 0 };
      cur.num += n.note * ev.coefficient;
      cur.den += ev.coefficient;
      parUe.set(code, cur);
    }
    let numTotal = 0;
    let denTotal = 0;
    const entrees = Array.from(parUe.entries());
    for (let i = 0; i < entrees.length; i++) {
      const [code, ue] = entrees[i];
      const moyenneUE = ue.den === 0 ? 0 : ue.num / ue.den;
      const credits = creditsParMatiere[code] ?? 1;
      numTotal += moyenneUE * credits;
      denTotal += credits;
    }
    const moyenneGenerale = denTotal === 0 ? 0 : numTotal / denTotal;
    const decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT' = moyenneGenerale >= 10 ? 'ADMIS' : moyenneGenerale >= 8 ? 'AJOURNE' : 'DEFAILLANT';
    await prisma.deliberationLigne.create({
      data: {
        deliberationId: deliberationL1.id,
        inscriptionId: ins.id,
        moyenne: Math.round(moyenneGenerale * 100) / 100,
        decision,
        mention: moyenneGenerale >= 16 ? 'Très bien' : moyenneGenerale >= 14 ? 'Bien' : moyenneGenerale >= 12 ? 'Assez bien' : 'Passable',
        rang: 0, // recalculé après la boucle
      },
    });
  }
  // Mise à jour des rangs
  const lignesDelib = await prisma.deliberationLigne.findMany({
    where: { deliberationId: deliberationL1.id },
    orderBy: { moyenne: 'desc' },
  });
  for (let i = 0; i < lignesDelib.length; i++) {
    await prisma.deliberationLigne.update({ where: { id: lignesDelib[i].id }, data: { rang: i + 1 } });
  }

  // Attestations pré-émises pour les étudiants admis
  for (const ligne of lignesDelib) {
    if (ligne.decision === 'ADMIS') {
      await prisma.attestation.create({
        data: {
          numero: `ATT-2026-${String(ligne.rang).padStart(5, '0')}`,
          type: 'SCOLARITE',
          motif: 'Inscription en master',
          inscriptionId: ligne.inscriptionId,
          anneeId: anneeActive!.id,
          promotionId: promoL1Info.id,
          etudiantId: (await prisma.inscription.findUnique({ where: { id: ligne.inscriptionId } }))!.etudiantId,
          statut: 'EMISE',
          emiseParId: scolariteUser.id,
          qrToken: `UP-ATT-${randomBytes(12).toString('base64url')}`,
        },
      });
    }
  }

  // Feuille de paie + lignes pour les vacataires (Module 2 — paie)
  const vacataires = await prisma.enseignant.findMany({ where: { statut: 'VACATAIRE' } });
  if (vacataires.length > 0) {
    const feuille = await prisma.feuillePaie.create({
      data: {
        libelle: 'Août 2026',
        mois: 8,
        annee: 2026,
        dateDebut: dateOnly('2026-08-01'),
        dateFin: dateOnly('2026-08-31'),
        statut: 'VALIDEE',
        creeParId: adminUser.id,
        valideeParId: adminUser.id,
      },
    });
    for (const ens of vacataires) {
      const heures = Math.round((8 + Math.random() * 16) * 10) / 10;
      const montantNet = heures * ens.tauxHoraire;
      await prisma.lignePaie.create({
        data: {
          feuilleId: feuille.id,
          enseignantId: ens.id,
          tauxHoraire: ens.tauxHoraire,
          heuresReelles: heures,
          volumePrevu: heures,
          montantBrut: montantNet,
          retenue: 0,
          montantNet,
        },
      });
    }
  }

  // ---- 11. Élections ----
  const electionDelegue = await prisma.election.create({
    data: {
      titre: 'Délégués de promotion L1 Informatique 2026-2027',
      type: 'DELEGUE_PROMOTION',
      promotionId: promoL1Info.id,
      description: 'Scrutin uninominal — élisez vos deux délégués de promotion',
      dateOuverture: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      dateCloture: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      nbSieges: 2,
      statut: 'OUVERTE',
      creeParId: scolariteUser.id,
    },
  });
  const candidatsL1 = await Promise.all([
    prisma.candidatElection.create({ data: { electionId: electionDelegue.id, nom: 'DOUMBOUYA', prenom: 'Sory', etudiantId: etudiants[0].id, ordre: 1, programme: 'Améliorer la communication avec la scolarité, organiser des sessions de tutorat' } }),
    prisma.candidatElection.create({ data: { electionId: electionDelegue.id, nom: 'DIALLO',   prenom: 'Mariama', etudiantId: etudiants[1].id, ordre: 2, programme: 'Bibliothèque ouverte 24/7, plus de TP' } }),
    prisma.candidatElection.create({ data: { electionId: electionDelegue.id, nom: 'BALDÉ',    prenom: 'Alpha', etudiantId: etudiants[2].id, ordre: 3, programme: 'Représentation équitable des L1 INFO' } }),
    prisma.candidatElection.create({ data: { electionId: electionDelegue.id, nom: 'CAMARA',   prenom: 'Mariama', etudiantId: etudiants[2].id, ordre: 4, programme: 'Sorties pédagogiques, ouverture bibliothèque' } }),
  ]);
  // Quelques votes déjà enregistrés
  await prisma.voteElection.create({ data: { electionId: electionDelegue.id, candidatId: candidatsL1[0].id, etudiantId: etudiants[0].id } });
  await prisma.voteElection.create({ data: { electionId: electionDelegue.id, candidatId: candidatsL1[1].id, etudiantId: etudiants[1].id } });
  await prisma.voteElection.create({ data: { electionId: electionDelegue.id, candidatId: candidatsL1[0].id, etudiantId: etudiants[2].id } });

  const electionDelegueM1 = await prisma.election.create({
    data: {
      titre: 'Délégués de département — Mathématiques',
      type: 'DELEGUE_DEPARTEMENT',
      departementId: math.id,
      description: 'Scrutin plurinominal — élisez vos trois délégués',
      dateOuverture: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dateCloture: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      nbSieges: 3,
      statut: 'PROCLAMEE',
      creeParId: directionUser.id,
    },
  });

  // ---- 12. Statistiques MESRS (snapshot pré-calculé) ----
  await prisma.statistiqueMesrs.create({
    data: {
      anneeId: anneeActive!.id,
      genereParId: adminUser.id,
      donnees: {
        effectifTotal: 5,
        effectifL1: 2,
        effectifL2: 1,
        effectifL3: 1,
        effectifM1: 1,
        effectifM2: 0,
        nbEnseignants: 10,
        nbVacataires: 3,
        nbReclamationsEnCours: 1,
        nbIncidentsHelpdesk: 1,
        tauxReussiteL1: 0,
        tauxReussiteGlobal: 100,
        masseSalariale: 0,
      },
    },
  });

  // ---- Quelques Notification SMS récentes pour le graphe 30j ----
  const maintenant = Date.now();
  for (let i = 0; i < 30; i++) {
    const date = new Date(maintenant - i * 24 * 60 * 60 * 1000);
    const statut: 'ENVOYEE' | 'ECHOUE' = i % 3 === 0 ? 'ECHOUE' : 'ENVOYEE';
    await prisma.notification.create({
      data: {
        telephone: `62200000${i % 10}`,
        message: `Notification de test #${i}`,
        destinataireNom: 'Destinataire test',
        etudiantId: etudiants[i % etudiants.length].id,
        statut,
        envoyeLe: statut === 'ENVOYEE' ? date : null,
        envoyeParId: adminUser.id,
        createdAt: date,
        ...(statut === 'ECHOUE' ? { erreur: 'Passerelle SMS indisponible' } : {}),
      },
    });
  }

  // ---- Documentation — Bibliothèque ----
  await Promise.all([
    prisma.documentDepot.create({ data: { titre: 'Algorithmes de tri: état de l\u2019art', type: 'ARTICLE', auteurs: 'DIALLO M., CAMARA S.', anneeEdition: 2025, resume: 'Comparaison des complexités asymptotiques', motsClefs: ['algorithmes','tri','complexité'], contenuTexte: 'Les algorithmes de tri sont au cœur de l\u2019informatique. Cet article compare les complexités asymptotiques...', empreinteHash: 'sha256:doc1hash', public: true, deposeParId: adminUser.id } }),
    prisma.documentDepot.create({ data: { titre: 'Mémoire de Master: détection de plagiat', type: 'MEMOIRE', auteurs: 'Sory DOUMBOUYA', anneeEdition: 2026, resume: 'Système anti-plagiat pour mémoires', motsClefs: ['plagiat','mémoire'], contenuTexte: 'Ce mémoire présente un système anti-plagiat utilisant la similarité de Jaccard...', empreinteHash: 'sha256:doc2hash', public: true, deposeParId: adminUser.id } }),
    prisma.documentDepot.create({ data: { titre: 'Thèse: Microfinance en Guinée', type: 'THESE', auteurs: 'Mariama DIALLO', anneeEdition: 2024, resume: 'Impact socio-économique de la microfinance rurale', motsClefs: ['microfinance','Guinée','économie'], contenuTexte: 'Cette thèse analyse l\u2019impact de la microfinance rurale en Guinée entre 2010 et 2023...', empreinteHash: 'sha256:doc3hash', public: true, deposeParId: adminUser.id } }),
  ]);

  console.log('→ Seed étendu OK');

  console.log(`✔ ${etudiants.length} étudiants, ${inscriptions.length} inscriptions, ${paiements.length} paiements (Module 1)`);

  console.log('\nComptes de démonstration (mot de passe : Passer@2026)');
  console.table(
    [...comptes.map(([email, , , role]) => ({ email, role })), { email: compteEnseignant.email, role: Role.ENSEIGNANT }],
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
