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
  await prisma.auditLog.deleteMany();
  await prisma.justificatif.deleteMany();
  await prisma.controle.deleteMany();
  await prisma.seance.deleteMany();
  await prisma.creneau.deleteMany();
  await prisma.affectation.deleteMany();
  await prisma.matiere.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.filiere.deleteMany();
  await prisma.enseignant.deleteMany();
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
