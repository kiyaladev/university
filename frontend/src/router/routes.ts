import type { RouteRecordRaw } from 'vue-router';
import type { Role } from '../types';
import { ecran } from '../navigation/menu';

/**
 * `meta.roles` : rôles autorisés (absence = tous les utilisateurs connectés).
 * Les écrans du menu tirent titre et rôles du manifeste de navigation
 * (`ecran('/chemin')`, voir navigation/manifeste.ts) : c'est là qu'on les change.
 */
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
        meta: { public: true, titre: 'nav.connexion' },
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
        meta: { public: true, titre: 'nav.s-inscrire' },
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
        meta: { public: true, titre: 'nav.portail-connexion' },
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
        meta: { public: true, titre: 'nav.bibliotheque-publique' },
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
        meta: { public: true, titre: 'nav.formations-publiques' },
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
        meta: { public: true, titre: 'nav.verification' },
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
        meta: { public: true, titre: 'nav.verification-carte' },
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
        meta: { public: true, titre: 'nav.verification-badge' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: 'suivi-presences', name: 'suivi-presences', component: () => import('pages/AccueilUniversityPage.vue'),
        meta: ecran('/suivi-presences') },
      { path: 'documents', name: 'documents', component: () => import('pages/AccueilUniversityPage.vue'),
        meta: ecran('/documents') },
      { path: 'bilan', redirect: '/rectorat' },
      { path: 'mes-demarches', redirect: '/demandes-docs/mes' },
      {
        path: '',
        name: 'tableau-de-bord',
        component: () => import('pages/AccueilUniversityPage.vue'),
        /** Registre de contrôle : l'étudiant est renvoyé vers son espace (voir la garde). */
        meta: ecran('/'),
      },
      {
        path: 'synthese-presences',
        name: 'synthese-presences',
        component: () => import('pages/DashboardPage.vue'),
        meta: ecran('/synthese-presences'),
      },
      {
        path: 'controle',
        name: 'controle',
        component: () => import('pages/ControlePage.vue'),
        meta: ecran('/controle'),
      },
      {
        /** Registre de travail du personnel : on y pointe et on y programme. */
        path: 'seances',
        name: 'seances',
        component: () => import('pages/SeancesPage.vue'),
        meta: ecran('/seances'),
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
        meta: ecran('/emploi-du-temps'),
      },
      {
        path: 'affectations',
        name: 'affectations',
        component: () => import('pages/AffectationsPage.vue'),
        meta: ecran('/affectations'),
      },
      {
        path: 'enseignants',
        name: 'enseignants',
        component: () => import('pages/EnseignantsPage.vue'),
        meta: ecran('/enseignants'),
      },
      {
        path: 'matieres',
        name: 'matieres',
        component: () => import('pages/MatieresPage.vue'),
        meta: ecran('/matieres'),
      },
      {
        path: 'structure',
        name: 'structure',
        component: () => import('pages/StructurePage.vue'),
        meta: ecran('/structure'),
      },
      {
        path: 'salles',
        name: 'salles',
        component: () => import('pages/SallesPage.vue'),
        meta: ecran('/salles'),
      },
      {
        path: 'imports',
        name: 'imports-referentiels',
        component: () => import('pages/ImportsPage.vue'),
        meta: ecran('/imports'),
      },
      {
        /**
         * L'enseignant dépose, la scolarité enregistre, la direction arbitre :
         * le contrôleur constate mais n'instruit pas, l'étudiant n'y figure pas.
         */
        path: 'justificatifs',
        name: 'justificatifs',
        component: () => import('pages/JustificatifsPage.vue'),
        meta: ecran('/justificatifs'),
      },
      {
        path: 'statistiques',
        name: 'statistiques',
        component: () => import('pages/StatistiquesPage.vue'),
        meta: ecran('/statistiques'),
      },
      {
        path: 'rapports',
        name: 'rapports',
        component: () => import('pages/RapportsPage.vue'),
        meta: ecran('/rapports'),
      },
      {
        path: 'mes-seances',
        name: 'mes-seances',
        component: () => import('pages/MesSeancesPage.vue'),
        meta: ecran('/mes-seances'),
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('pages/AuditPage.vue'),
        meta: ecran('/audit'),
      },
      {
        path: 'scolarite',
        name: 'scolarite',
        component: () => import('pages/AccueilScolaritePage.vue'),
        meta: ecran('/scolarite'),
      },
      {
        path: 'utilisateurs',
        name: 'utilisateurs',
        component: () => import('pages/UtilisateursPage.vue'),
        meta: ecran('/utilisateurs'),
      },
      {
        path: 'parametres',
        name: 'parametres',
        component: () => import('pages/ParametresPage.vue'),
        meta: ecran('/parametres'),
      },
      {
        path: 'etudiants',
        name: 'etudiants',
        component: () => import('pages/EtudiantsPage.vue'),
        meta: ecran('/etudiants'),
      },
      {
        path: 'inscriptions',
        name: 'inscriptions',
        component: () => import('pages/InscriptionsPage.vue'),
        meta: ecran('/inscriptions'),
      },
      {
        path: 'paiements',
        name: 'paiements',
        component: () => import('pages/PaiementsPage.vue'),
        meta: ecran('/paiements'),
      },
      {
        path: 'evaluations',
        name: 'evaluations',
        component: () => import('pages/EvaluationsPage.vue'),
        meta: ecran('/evaluations'),
      },
      {
        path: 'notes',
        name: 'notes',
        component: () => import('pages/NotesPage.vue'),
        meta: ecran('/notes'),
      },
      {
        path: 'deliberations',
        name: 'deliberations',
        component: () => import('pages/DeliberationsPage.vue'),
        meta: ecran('/deliberations'),
      },
      {
        path: 'attestations',
        name: 'attestations',
        component: () => import('pages/AttestationsPage.vue'),
        meta: ecran('/attestations'),
      },
      {
        path: 'plagiat',
        name: 'plagiat',
        component: () => import('pages/PlagiatPage.vue'),
        meta: ecran('/plagiat'),
      },
      {
        path: 'plagiat/:id',
        name: 'plagiat-detail',
        component: () => import('pages/PlagiatDetailPage.vue'),
        meta: { titre: 'nav.plagiat-detail', roles: ['ADMIN', 'DIRECTION'] },
      },
      {
        path: 'bulletins',
        name: 'bulletins',
        component: () => import('pages/BulletinsPage.vue'),
        meta: ecran('/bulletins'),
      },
      {
        path: 'paie',
        name: 'paie',
        component: () => import('pages/PaiePage.vue'),
        meta: ecran('/paie'),
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('pages/NotificationsPage.vue'),
        meta: ecran('/notifications'),
      },
      {
        path: 'portail',
        name: 'portail',
        component: () => import('pages/PortailPage.vue'),
        meta: ecran('/portail'),
      },
      {
        path: 'cites',
        name: 'cites',
        component: () => import('pages/CitesPage.vue'),
        meta: ecran('/cites'),
      },
      {
        path: 'bibliotheque-gestion',
        name: 'bibliotheque',
        component: () => import('pages/BibliothequePage.vue'),
        meta: ecran('/bibliotheque-gestion'),
      },
      {
        path: 'resto',
        name: 'resto',
        component: () => import('pages/RestoPage.vue'),
        meta: ecran('/resto'),
      },
      {
        path: 'reservations',
        name: 'reservations',
        component: () => import('pages/ReservationsPage.vue'),
        meta: ecran('/reservations'),
      },
      {
        path: 'stages',
        name: 'stages',
        component: () => import('pages/StagesPage.vue'),
        meta: ecran('/stages'),
      },
      {
        path: 'helpdesk',
        name: 'helpdesk',
        component: () => import('pages/HelpdeskPage.vue'),
        meta: ecran('/helpdesk'),
      },
      {
        path: 'formations-admin',
        name: 'formations-admin',
        component: () => import('pages/FormationsAdminPage.vue'),
        meta: ecran('/formations-admin'),
      },
      {
        path: 'rectorat',
        name: 'rectorat',
        component: () => import('pages/RectoratPage.vue'),
        meta: ecran('/rectorat'),
      },
      {
        path: 'statistiques-mesrs',
        name: 'statistiques-mesrs',
        component: () => import('pages/StatistiquesMesrsPage.vue'),
        meta: ecran('/statistiques-mesrs'),
      },
      {
        path: 'patrimoine',
        name: 'patrimoine',
        component: () => import('pages/PatrimoinePage.vue'),
        meta: ecran('/patrimoine'),
      },
      {
        path: 'courrier',
        name: 'courrier',
        component: () => import('pages/CourrierPage.vue'),
        meta: ecran('/courrier'),
      },
      {
        path: 'examens',
        name: 'examens',
        component: () => import('pages/ExamensPage.vue'),
        meta: ecran('/examens'),
      },
      {
        path: 'examens/scan',
        name: 'scan-examen',
        component: () => import('pages/ScanExamenPage.vue'),
        meta: ecran('/examens/scan'),
      },
      {
        path: 'tirage',
        name: 'tirage',
        component: () => import('pages/TiragePage.vue'),
        meta: ecran('/tirage'),
      },
      {
        path: 'recettes',
        name: 'recettes',
        component: () => import('pages/RecettesPage.vue'),
        meta: ecran('/recettes'),
      },
      {
        path: 'reclamations',
        name: 'reclamations',
        component: () => import('pages/ReclamationsPage.vue'),
        meta: ecran('/reclamations'),
      },
      {
        path: 'reclamations/mes',
        name: 'mes-reclamations',
        component: () => import('pages/MesReclamationsPage.vue'),
        meta: ecran('/reclamations/mes'),
      },
      {
        path: 'demandes-docs',
        name: 'demandes-docs',
        component: () => import('pages/DemandeDocumentsPage.vue'),
        meta: ecran('/demandes-docs'),
      },
      {
        path: 'demandes-docs/mes',
        name: 'mes-demandes-docs',
        component: () => import('pages/MesDemandesPage.vue'),
        meta: ecran('/demandes-docs/mes'),
      },
      {
        path: 'demandes-docs/tarifs',
        name: 'tarifs-demandes',
        component: () => import('pages/TarifsDemandeAdminPage.vue'),
        meta: ecran('/demandes-docs/tarifs'),
      },
      {
        path: 'cartes-etudiantes',
        name: 'cartes-etudiantes',
        component: () => import('pages/CarteEtudiantePage.vue'),
        meta: ecran('/cartes-etudiantes'),
      },
      {
        path: 'ma-carte',
        name: 'ma-carte',
        component: () => import('pages/MaCartePage.vue'),
        meta: ecran('/ma-carte'),
      },
      {
        path: 'badges',
        name: 'badges',
        component: () => import('pages/BadgesPage.vue'),
        meta: ecran('/badges'),
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
        meta: ecran('/vod'),
      },
      {
        path: 'vod/lecteur/:id',
        name: 'vod-lecteur',
        component: () => import('pages/VodLecteurPage.vue'),
        meta: {
          titre: 'nav.vod-lecteur',
          roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION', 'ETUDIANT'],
        },
      },
      {
        path: 'elections',
        name: 'elections',
        component: () => import('pages/ElectionsPage.vue'),
        meta: ecran('/elections'),
      },
      {
        path: 'elections/vote',
        name: 'elections-vote',
        component: () => import('pages/VotePage.vue'),
        meta: ecran('/elections/vote'),
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
    meta: { public: true, titre: 'nav.introuvable' },
  },
];

export default routes;
