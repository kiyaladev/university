import type { RouteRecordRaw } from 'vue-router';
import type { Role } from '../types';

/** `meta.roles` : rôles autorisés (absence = tous les utilisateurs connectés). */
declare module 'vue-router' {
  interface RouteMeta {
    titre?: string;
    roles?: Role[];
    public?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/connexion',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'connexion',
        component: () => import('pages/LoginPage.vue'),
        meta: { public: true, titre: 'Connexion' },
      },
    ],
  },
  {
    path: '/s-inscrire',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 's-inscrire',
        component: () => import('pages/InscriptionPubliquePage.vue'),
        meta: { public: true, titre: 'Préinscription en ligne' },
      },
    ],
  },
  {
    path: '/portail-connexion',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'portail-connexion',
        component: () => import('pages/PortailConnexionPage.vue'),
        meta: { public: true, titre: 'Portail étudiant' },
      },
    ],
  },
  {
    path: '/bibliotheque',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'bibliotheque-publique',
        component: () => import('pages/BibliothequePubliquePage.vue'),
        meta: { public: true, titre: 'Bibliothèque numérique' },
      },
    ],
  },
  {
    path: '/formations',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'formations-publiques',
        component: () => import('pages/FormationsPubliquesPage.vue'),
        meta: { public: true, titre: 'Formation continue' },
      },
    ],
  },
  {
    path: '/verification',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'verification',
        component: () => import('pages/VerificationPage.vue'),
        meta: { public: true, titre: 'Vérification d’attestation' },
      },
    ],
  },
  {
    path: '/verification-carte',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'verification-carte',
        component: () => import('pages/VerificationCartePage.vue'),
        meta: { public: true, titre: 'Vérification de carte étudiante' },
      },
    ],
  },
  {
    /** Destination du QR imprimé sur les badges d'accès (voir badges.service). */
    path: '/verification-badge',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'verification-badge',
        component: () => import('pages/VerificationBadgePage.vue'),
        meta: { public: true, titre: 'Vérification de badge d’accès' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'tableau-de-bord',
        component: () => import('pages/DashboardPage.vue'),
        /** Registre de contrôle : l'étudiant est renvoyé vers son espace (voir la garde). */
        meta: {
          titre: 'Tableau de bord',
          roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'],
        },
      },
      {
        path: 'controle',
        name: 'controle',
        component: () => import('pages/ControlePage.vue'),
        meta: {
          titre: 'Contrôle des séances',
          roles: ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
        },
      },
      {
        /** Registre de travail du personnel : on y pointe et on y programme. */
        path: 'seances',
        name: 'seances',
        component: () => import('pages/SeancesPage.vue'),
        meta: {
          titre: 'Séances',
          roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'],
        },
      },
      {
        /**
         * Seul écran de la partie connectée ouvert à tous les rôles, étudiants
         * compris : le tableau des créneaux se lit, il ne se modifie qu'avec
         * les droits de planification (contrôlés dans la page elle-même).
         */
        path: 'emploi-du-temps',
        name: 'emploi-du-temps',
        component: () => import('pages/EmploiDuTempsPage.vue'),
        meta: {
          titre: 'Emploi du temps',
          roles: [
            'ADMIN',
            'DIRECTION',
            'SCOLARITE',
            'CHEF_DEPARTEMENT',
            'CONTROLEUR',
            'ENSEIGNANT',
            'ETUDIANT',
          ],
        },
      },
      {
        path: 'affectations',
        name: 'affectations',
        component: () => import('pages/AffectationsPage.vue'),
        meta: {
          titre: 'Charges d’enseignement',
          roles: ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'],
        },
      },
      {
        path: 'enseignants',
        name: 'enseignants',
        component: () => import('pages/EnseignantsPage.vue'),
        meta: { titre: 'Enseignants', roles: ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'] },
      },
      {
        path: 'matieres',
        name: 'matieres',
        component: () => import('pages/MatieresPage.vue'),
        meta: { titre: 'Matières', roles: ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'] },
      },
      {
        path: 'structure',
        name: 'structure',
        component: () => import('pages/StructurePage.vue'),
        meta: {
          titre: 'Structure académique',
          roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
        },
      },
      {
        path: 'salles',
        name: 'salles',
        component: () => import('pages/SallesPage.vue'),
        meta: { titre: 'Salles & QR', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR'] },
      },
      {
        /**
         * L'enseignant dépose, la scolarité enregistre, la direction arbitre :
         * le contrôleur constate mais n'instruit pas, l'étudiant n'y figure pas.
         */
        path: 'justificatifs',
        name: 'justificatifs',
        component: () => import('pages/JustificatifsPage.vue'),
        meta: {
          titre: 'Justificatifs d’absence',
          roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT'],
        },
      },
      {
        path: 'statistiques',
        name: 'statistiques',
        component: () => import('pages/StatistiquesPage.vue'),
        meta: {
          titre: 'Statistiques',
          roles: ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
        },
      },
      {
        path: 'rapports',
        name: 'rapports',
        component: () => import('pages/RapportsPage.vue'),
        meta: {
          titre: 'Rapports & états',
          roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
        },
      },
      {
        path: 'mes-seances',
        name: 'mes-seances',
        component: () => import('pages/MesSeancesPage.vue'),
        meta: { titre: 'Mes séances', roles: ['ENSEIGNANT'] },
      },
      {
        path: 'utilisateurs',
        name: 'utilisateurs',
        component: () => import('pages/UtilisateursPage.vue'),
        meta: { titre: 'Utilisateurs', roles: ['ADMIN'] },
      },
      {
        path: 'parametres',
        name: 'parametres',
        component: () => import('pages/ParametresPage.vue'),
        meta: { titre: 'Paramètres', roles: ['ADMIN'] },
      },
      {
        path: 'etudiants',
        name: 'etudiants',
        component: () => import('pages/EtudiantsPage.vue'),
        meta: { titre: 'Étudiants', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'] },
      },
      {
        path: 'inscriptions',
        name: 'inscriptions',
        component: () => import('pages/InscriptionsPage.vue'),
        meta: { titre: 'Inscriptions', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'] },
      },
      {
        path: 'paiements',
        name: 'paiements',
        component: () => import('pages/PaiementsPage.vue'),
        meta: { titre: 'Paiements', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'evaluations',
        name: 'evaluations',
        component: () => import('pages/EvaluationsPage.vue'),
        meta: { titre: 'Évaluations', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'] },
      },
      {
        path: 'notes',
        name: 'notes',
        component: () => import('pages/NotesPage.vue'),
        meta: { titre: 'Saisie des notes', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'] },
      },
      {
        path: 'deliberations',
        name: 'deliberations',
        component: () => import('pages/DeliberationsPage.vue'),
        meta: { titre: 'Délibérations', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'] },
      },
      {
        path: 'attestations',
        name: 'attestations',
        component: () => import('pages/AttestationsPage.vue'),
        meta: { titre: 'Attestations', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'plagiat',
        name: 'plagiat',
        component: () => import('pages/PlagiatPage.vue'),
        meta: { titre: 'Anti-plagiat', roles: ['ADMIN', 'DIRECTION'] },
      },
      {
        path: 'plagiat/:id',
        name: 'plagiat-detail',
        component: () => import('pages/PlagiatDetailPage.vue'),
        meta: { titre: 'Détail suspicion', roles: ['ADMIN', 'DIRECTION'] },
      },
      {
        path: 'bulletins',
        name: 'bulletins',
        component: () => import('pages/BulletinsPage.vue'),
        meta: { titre: 'Bulletins', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'paie',
        name: 'paie',
        component: () => import('pages/PaiePage.vue'),
        meta: { titre: 'Paie des vacataires', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('pages/NotificationsPage.vue'),
        meta: { titre: 'Notifications SMS', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'portail',
        name: 'portail',
        component: () => import('pages/PortailPage.vue'),
        meta: { titre: 'Mon espace', roles: ['ETUDIANT'] },
      },
      {
        path: 'cites',
        name: 'cites',
        component: () => import('pages/CitesPage.vue'),
        meta: { titre: 'Cités universitaires', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'bibliotheque-gestion',
        name: 'bibliotheque',
        component: () => import('pages/BibliothequePage.vue'),
        meta: { titre: 'Bibliothèque numérique', roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT'] },
      },
      {
        path: 'resto',
        name: 'resto',
        component: () => import('pages/RestoPage.vue'),
        meta: { titre: 'Resto numérique', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR'] },
      },
      {
        path: 'reservations',
        name: 'reservations',
        component: () => import('pages/ReservationsPage.vue'),
        meta: { titre: 'Réservations de salles', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'] },
      },
      {
        path: 'stages',
        name: 'stages',
        component: () => import('pages/StagesPage.vue'),
        meta: { titre: 'Stages & mémoires', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT'] },
      },
      {
        path: 'helpdesk',
        name: 'helpdesk',
        component: () => import('pages/HelpdeskPage.vue'),
        meta: { titre: 'Support IT', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'] },
      },
      {
        path: 'formations-admin',
        name: 'formations-admin',
        component: () => import('pages/FormationsAdminPage.vue'),
        meta: { titre: 'Formation continue', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'rectorat',
        name: 'rectorat',
        component: () => import('pages/RectoratPage.vue'),
        meta: { titre: 'Tableau de bord Rectorat', roles: ['ADMIN', 'DIRECTION'] },
      },
      {
        path: 'statistiques-mesrs',
        name: 'statistiques-mesrs',
        component: () => import('pages/StatistiquesMesrsPage.vue'),
        meta: { titre: 'Statistiques MESRS', roles: ['ADMIN', 'DIRECTION'] },
      },
      {
        path: 'patrimoine',
        name: 'patrimoine',
        component: () => import('pages/PatrimoinePage.vue'),
        meta: { titre: 'Patrimoine & matériel', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'courrier',
        name: 'courrier',
        component: () => import('pages/CourrierPage.vue'),
        meta: { titre: 'Courrier administratif', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'] },
      },
      {
        path: 'examens',
        name: 'examens',
        component: () => import('pages/ExamensPage.vue'),
        meta: { titre: 'Examens', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'examens/scan',
        name: 'scan-examen',
        component: () => import('pages/ScanExamenPage.vue'),
        meta: { titre: 'Scan examens', roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'tirage',
        name: 'tirage',
        component: () => import('pages/TiragePage.vue'),
        meta: { titre: 'Tirage des épreuves', roles: ['ADMIN', 'SCOLARITE'] },
      },
      {
        path: 'recettes',
        name: 'recettes',
        component: () => import('pages/RecettesPage.vue'),
        meta: { titre: 'Régie des recettes', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'reclamations',
        name: 'reclamations',
        component: () => import('pages/ReclamationsPage.vue'),
        meta: { titre: 'Réclamations & requêtes', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'reclamations/mes',
        name: 'mes-reclamations',
        component: () => import('pages/MesReclamationsPage.vue'),
        meta: { titre: 'Mes réclamations', roles: ['ETUDIANT'] },
      },
      {
        path: 'demandes-docs',
        name: 'demandes-docs',
        component: () => import('pages/DemandeDocumentsPage.vue'),
        meta: { titre: 'Demandes de documents', roles: ['ADMIN', 'SCOLARITE'] },
      },
      {
        path: 'demandes-docs/mes',
        name: 'mes-demandes-docs',
        component: () => import('pages/MesDemandesPage.vue'),
        meta: { titre: 'Mes demandes de documents', roles: ['ETUDIANT'] },
      },
      {
        path: 'demandes-docs/tarifs',
        name: 'tarifs-demandes',
        component: () => import('pages/TarifsDemandeAdminPage.vue'),
        meta: { titre: 'Tarifs des demandes', roles: ['ADMIN'] },
      },
      {
        path: 'cartes-etudiantes',
        name: 'cartes-etudiantes',
        component: () => import('pages/CarteEtudiantePage.vue'),
        meta: { titre: 'Cartes étudiantes', roles: ['ADMIN', 'SCOLARITE'] },
      },
      {
        path: 'ma-carte',
        name: 'ma-carte',
        component: () => import('pages/MaCartePage.vue'),
        meta: { titre: 'Ma carte étudiante', roles: ['ETUDIANT'] },
      },
      {
        path: 'badges',
        name: 'badges',
        component: () => import('pages/BadgesPage.vue'),
        meta: { titre: 'Badges & visiteurs', roles: ['ADMIN', 'SCOLARITE'] },
      },
      {
        path: 'vod',
        name: 'vod',
        component: () => import('pages/VodPage.vue'),
        /**
         * L'étudiant y entre en lecture seule : la page bascule alors sur
         * `/vod/ma-collecte`, l'endpoint que le backend lui réserve. Sans cette
         * ouverture, il pouvait lire une vidéo dont on lui donnait le lien mais
         * n'avait aucun catalogue où la trouver.
         */
        meta: {
          titre: 'VOD des cours',
          roles: ['ENSEIGNANT', 'ADMIN', 'SCOLARITE', 'DIRECTION', 'ETUDIANT'],
        },
      },
      {
        path: 'vod/lecteur/:id',
        name: 'vod-lecteur',
        component: () => import('pages/VodLecteurPage.vue'),
        meta: {
          titre: 'Lecteur VOD',
          roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION', 'ETUDIANT'],
        },
      },
      {
        path: 'elections',
        name: 'elections',
        component: () => import('pages/ElectionsPage.vue'),
        meta: { titre: 'Élections', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'elections/vote',
        name: 'elections-vote',
        component: () => import('pages/VotePage.vue'),
        meta: { titre: 'Voter', roles: ['ETUDIANT', 'ENSEIGNANT', 'CONTROLEUR', 'ADMIN'] },
      },
    ],
  },
  {
    /**
     * Volontairement sans enveloppe : la page se suffit à elle-même et propose
     * une sortie adaptée au visiteur comme au personnel connecté. L'envelopper
     * dans `AuthLayout` afficherait la barre des services publics à un agent
     * déjà connecté, qui n'en a que faire.
     */
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
    meta: { public: true, titre: 'Page introuvable' },
  },
];

export default routes;
