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
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'tableau-de-bord',
        component: () => import('pages/DashboardPage.vue'),
        meta: { titre: 'Tableau de bord' },
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
        path: 'seances',
        name: 'seances',
        component: () => import('pages/SeancesPage.vue'),
        meta: { titre: 'Séances' },
      },
      {
        path: 'emploi-du-temps',
        name: 'emploi-du-temps',
        component: () => import('pages/EmploiDuTempsPage.vue'),
        meta: { titre: 'Emploi du temps' },
      },
      {
        path: 'affectations',
        name: 'affectations',
        component: () => import('pages/AffectationsPage.vue'),
        meta: {
          titre: "Charges d'enseignement",
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
        meta: { titre: 'Salles', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR'] },
      },
      {
        path: 'justificatifs',
        name: 'justificatifs',
        component: () => import('pages/JustificatifsPage.vue'),
        meta: { titre: 'Justificatifs d’absence' },
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
        meta: { titre: 'Délibérations', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
      },
      {
        path: 'attestations',
        name: 'attestations',
        component: () => import('pages/AttestationsPage.vue'),
        meta: { titre: 'Attestations', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'] },
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
        meta: { titre: 'Salles & réservations', roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'] },
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
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
    meta: { public: true },
  },
];

export default routes;
