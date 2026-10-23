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
        component: () => import('@/features/public/pages/ConnexionPage.vue'),
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
        component: () => import('@/features/public/pages/InscriptionPubliquePage.vue'),
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
        component: () => import('@/features/public/pages/PortailConnexionPage.vue'),
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
        component: () => import('@/features/public/pages/BibliothequePubliquePage.vue'),
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
        component: () => import('@/features/public/pages/FormationsPubliquesPage.vue'),
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
        component: () => import('@/features/public/pages/VerificationPage.vue'),
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
        component: () => import('@/features/public/pages/VerificationCartePage.vue'),
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
        component: () => import('@/features/public/pages/VerificationBadgePage.vue'),
        meta: { public: true, titre: 'nav.verification-badge' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'suivi-presences',
        name: 'suivi-presences',
        component: () => import('@/features/accueil/pages/AccueilUniversitePage.vue'),
        meta: ecran('/suivi-presences'),
      },
      {
        path: 'documents',
        name: 'documents',
        component: () => import('@/features/accueil/pages/AccueilUniversitePage.vue'),
        meta: ecran('/documents'),
      },
      { path: 'bilan', redirect: '/rectorat' },
      { path: 'mes-demarches', redirect: '/demandes-docs/mes' },
      {
        path: '',
        name: 'tableau-de-bord',
        component: () => import('@/features/accueil/pages/AccueilUniversitePage.vue'),
        /** Registre de contrôle : l'étudiant est renvoyé vers son espace (voir la garde). */
        meta: ecran('/'),
      },
      {
        path: 'synthese-presences',
        name: 'synthese-presences',
        component: () => import('@/features/presence/pages/TableauBordPage.vue'),
        meta: ecran('/synthese-presences'),
      },
      {
        path: 'controle',
        name: 'controle',
        component: () => import('@/features/presence/pages/ControlePage.vue'),
        meta: ecran('/controle'),
      },
      {
        /** Appareils de contrôle et moyens d'attestation des enseignants. */
        path: 'moyens-attestation',
        name: 'moyens-attestation',
        component: () => import('@/features/presence/pages/MoyensAttestationPage.vue'),
        meta: ecran('/moyens-attestation'),
      },
      {
        /** Correction des pointages enregistrés. */
        path: 'corrections-pointages',
        name: 'corrections-pointages',
        component: () => import('@/features/presence/pages/CorrectionsPointagesPage.vue'),
        meta: ecran('/corrections-pointages'),
      },
      {
        /** Registre de travail du personnel : on y pointe et on y programme. */
        path: 'seances',
        name: 'seances',
        component: () => import('@/features/presence/pages/SeancesPage.vue'),
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
        component: () => import('@/features/presence/pages/EmploiDuTempsPage.vue'),
        meta: ecran('/emploi-du-temps'),
      },
      {
        path: 'affectations',
        name: 'affectations',
        component: () => import('@/features/administration/pages/AffectationsPage.vue'),
        meta: ecran('/affectations'),
      },
      {
        path: 'enseignants',
        name: 'enseignants',
        component: () => import('@/features/administration/pages/EnseignantsPage.vue'),
        meta: ecran('/enseignants'),
      },
      {
        path: 'matieres',
        name: 'matieres',
        component: () => import('@/features/administration/pages/MatieresPage.vue'),
        meta: ecran('/matieres'),
      },
      {
        path: 'structure',
        name: 'structure',
        component: () => import('@/features/administration/pages/StructurePage.vue'),
        meta: ecran('/structure'),
      },
      {
        path: 'salles',
        name: 'salles',
        component: () => import('@/features/administration/pages/SallesPage.vue'),
        meta: ecran('/salles'),
      },
      {
        path: 'imports',
        name: 'imports-referentiels',
        component: () => import('@/features/administration/pages/ImportsPage.vue'),
        meta: ecran('/imports'),
      },
      {
        /**
         * L'enseignant dépose, la scolarité enregistre, la direction arbitre :
         * le contrôleur constate mais n'instruit pas, l'étudiant n'y figure pas.
         */
        path: 'justificatifs',
        name: 'justificatifs',
        component: () => import('@/features/presence/pages/JustificatifsPage.vue'),
        meta: ecran('/justificatifs'),
      },
      {
        path: 'statistiques',
        name: 'statistiques',
        component: () => import('@/features/presence/pages/StatistiquesPage.vue'),
        meta: ecran('/statistiques'),
      },
      {
        path: 'rapports',
        name: 'rapports',
        component: () => import('@/features/presence/pages/RapportsPage.vue'),
        meta: ecran('/rapports'),
      },
      {
        path: 'mes-seances',
        name: 'mes-seances',
        component: () => import('@/features/presence/pages/MesSeancesPage.vue'),
        meta: ecran('/mes-seances'),
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('@/features/administration/pages/AuditPage.vue'),
        meta: ecran('/audit'),
      },
      {
        path: 'scolarite',
        name: 'scolarite',
        component: () => import('@/features/scolarite/pages/AccueilScolaritePage.vue'),
        meta: ecran('/scolarite'),
      },
      {
        path: 'utilisateurs',
        name: 'utilisateurs',
        component: () => import('@/features/administration/pages/UtilisateursPage.vue'),
        meta: ecran('/utilisateurs'),
      },
      {
        path: 'parametres',
        name: 'parametres',
        component: () => import('@/features/administration/pages/ParametresPage.vue'),
        meta: ecran('/parametres'),
      },
      {
        path: 'etudiants',
        name: 'etudiants',
        component: () => import('@/features/scolarite/pages/EtudiantsPage.vue'),
        meta: ecran('/etudiants'),
      },
      {
        path: 'inscriptions',
        name: 'inscriptions',
        component: () => import('@/features/scolarite/pages/InscriptionsPage.vue'),
        meta: ecran('/inscriptions'),
      },
      {
        path: 'paiements',
        name: 'paiements',
        component: () => import('@/features/finances/pages/PaiementsPage.vue'),
        meta: ecran('/paiements'),
      },
      {
        /** Grille des tarifs d'inscription (`/frais`). */
        path: 'frais',
        name: 'frais',
        component: () => import('@/features/finances/pages/FraisPage.vue'),
        meta: ecran('/frais'),
      },
      {
        path: 'evaluations',
        name: 'evaluations',
        component: () => import('@/features/scolarite/pages/EvaluationsPage.vue'),
        meta: ecran('/evaluations'),
      },
      {
        path: 'notes',
        name: 'notes',
        component: () => import('@/features/scolarite/pages/NotesPage.vue'),
        meta: ecran('/notes'),
      },
      {
        path: 'deliberations',
        name: 'deliberations',
        component: () => import('@/features/scolarite/pages/DeliberationsPage.vue'),
        meta: ecran('/deliberations'),
      },
      {
        path: 'attestations',
        name: 'attestations',
        component: () => import('@/features/scolarite/pages/AttestationsPage.vue'),
        meta: ecran('/attestations'),
      },
      {
        path: 'plagiat',
        name: 'plagiat',
        component: () => import('@/features/administration/pages/PlagiatPage.vue'),
        meta: ecran('/plagiat'),
      },
      {
        path: 'plagiat/:id',
        name: 'plagiat-detail',
        component: () => import('@/features/administration/pages/PlagiatDetailPage.vue'),
        meta: { titre: 'nav.plagiat-detail', roles: ['ADMIN', 'DIRECTION'] },
      },
      {
        path: 'bulletins',
        name: 'bulletins',
        component: () => import('@/features/scolarite/pages/BulletinsPage.vue'),
        meta: ecran('/bulletins'),
      },
      {
        path: 'paie',
        name: 'paie',
        component: () => import('@/features/finances/pages/PaiePage.vue'),
        meta: ecran('/paie'),
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/features/administration/pages/NotificationsPage.vue'),
        meta: ecran('/notifications'),
      },
      {
        path: 'portail',
        name: 'portail',
        component: () => import('@/features/scolarite/pages/PortailPage.vue'),
        meta: ecran('/portail'),
      },
      {
        path: 'cites',
        name: 'cites',
        component: () => import('@/features/campus/pages/CitesPage.vue'),
        meta: ecran('/cites'),
      },
      {
        path: 'bibliotheque-gestion',
        name: 'bibliotheque',
        component: () => import('@/features/campus/pages/BibliothequePage.vue'),
        meta: ecran('/bibliotheque-gestion'),
      },
      {
        path: 'resto',
        name: 'resto',
        component: () => import('@/features/campus/pages/RestoPage.vue'),
        meta: ecran('/resto'),
      },
      {
        path: 'reservations',
        name: 'reservations',
        component: () => import('@/features/campus/pages/ReservationsPage.vue'),
        meta: ecran('/reservations'),
      },
      {
        path: 'stages',
        name: 'stages',
        component: () => import('@/features/scolarite/pages/StagesPage.vue'),
        meta: ecran('/stages'),
      },
      {
        path: 'helpdesk',
        name: 'helpdesk',
        component: () => import('@/features/campus/pages/AssistancePage.vue'),
        meta: ecran('/helpdesk'),
      },
      {
        path: 'formations-admin',
        name: 'formations-admin',
        component: () => import('@/features/campus/pages/FormationsAdminPage.vue'),
        meta: ecran('/formations-admin'),
      },
      {
        path: 'rectorat',
        name: 'rectorat',
        component: () => import('@/features/administration/pages/RectoratPage.vue'),
        meta: ecran('/rectorat'),
      },
      {
        path: 'statistiques-mesrs',
        name: 'statistiques-mesrs',
        component: () => import('@/features/administration/pages/StatistiquesMesrsPage.vue'),
        meta: ecran('/statistiques-mesrs'),
      },
      {
        path: 'patrimoine',
        name: 'patrimoine',
        component: () => import('@/features/campus/pages/PatrimoinePage.vue'),
        meta: ecran('/patrimoine'),
      },
      {
        path: 'courrier',
        name: 'courrier',
        component: () => import('@/features/administration/pages/CourrierPage.vue'),
        meta: ecran('/courrier'),
      },
      {
        path: 'examens',
        name: 'examens',
        component: () => import('@/features/scolarite/pages/ExamensPage.vue'),
        meta: ecran('/examens'),
      },
      {
        path: 'examens/scan',
        name: 'scan-examen',
        component: () => import('@/features/scolarite/pages/ScanExamenPage.vue'),
        meta: ecran('/examens/scan'),
      },
      {
        path: 'tirage',
        name: 'tirage',
        component: () => import('@/features/scolarite/pages/TiragePage.vue'),
        meta: ecran('/tirage'),
      },
      {
        path: 'recettes',
        name: 'recettes',
        component: () => import('@/features/finances/pages/RecettesPage.vue'),
        meta: ecran('/recettes'),
      },
      {
        path: 'reclamations',
        name: 'reclamations',
        component: () => import('@/features/scolarite/pages/ReclamationsPage.vue'),
        meta: ecran('/reclamations'),
      },
      {
        path: 'reclamations/mes',
        name: 'mes-reclamations',
        component: () => import('@/features/scolarite/pages/MesReclamationsPage.vue'),
        meta: ecran('/reclamations/mes'),
      },
      {
        path: 'demandes-docs',
        name: 'demandes-docs',
        component: () => import('@/features/scolarite/pages/DemandeDocumentsPage.vue'),
        meta: ecran('/demandes-docs'),
      },
      {
        path: 'demandes-docs/mes',
        name: 'mes-demandes-docs',
        component: () => import('@/features/scolarite/pages/MesDemandesPage.vue'),
        meta: ecran('/demandes-docs/mes'),
      },
      {
        path: 'demandes-docs/tarifs',
        name: 'tarifs-demandes',
        component: () => import('@/features/administration/pages/TarifsDemandeAdminPage.vue'),
        meta: ecran('/demandes-docs/tarifs'),
      },
      {
        path: 'cartes-etudiantes',
        name: 'cartes-etudiantes',
        component: () => import('@/features/scolarite/pages/CarteEtudiantePage.vue'),
        meta: ecran('/cartes-etudiantes'),
      },
      {
        path: 'ma-carte',
        name: 'ma-carte',
        component: () => import('@/features/scolarite/pages/MaCartePage.vue'),
        meta: ecran('/ma-carte'),
      },
      {
        path: 'badges',
        name: 'badges',
        component: () => import('@/features/campus/pages/BadgesPage.vue'),
        meta: ecran('/badges'),
      },
      {
        path: 'vod',
        name: 'vod',
        component: () => import('@/features/campus/pages/VodPage.vue'),
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
        component: () => import('@/features/campus/pages/VodLecteurPage.vue'),
        meta: {
          titre: 'nav.vod-lecteur',
          roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION', 'ETUDIANT'],
        },
      },
      {
        path: 'elections',
        name: 'elections',
        component: () => import('@/features/campus/pages/ElectionsPage.vue'),
        meta: ecran('/elections'),
      },
      {
        path: 'elections/vote',
        name: 'elections-vote',
        component: () => import('@/features/campus/pages/VotePage.vue'),
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
    component: () => import('@/features/accueil/pages/IntrouvablePage.vue'),
    meta: { public: true, titre: 'nav.introuvable' },
  },
];

export default routes;
