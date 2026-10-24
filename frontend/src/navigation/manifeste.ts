import type { Role } from '../types';
import { PERSONNEL } from './roles';

/**
 * Manifeste de navigation : une entrée par écran atteignable depuis le menu.
 *
 * C'est la seule source des droits d'accès des routes (`meta.roles`, voir
 * `ecran()` dans navigation/menu.ts), du menu latéral (rubriques, sections,
 * ordre), du service facultatif qui masque l'écran, des raccourcis du menu et
 * des tâches de l'accueil, et des « familles » (écrans regroupés derrière une
 * seule entrée du menu, qui l'allument quand on les visite).
 *
 * Une entrée peut déclarer `redirection` : elle ne renvoie alors vers aucun
 * écran propre, elle adresse un autre écran du manifeste. C'est le cas des
 * rubriques qui regroupent plusieurs écrans.
 */

export type RubriqueId = 'presence' | 'registrar' | 'finance' | 'campus' | 'administration';

/** Rubriques du menu, dans l'ordre d'affichage. */
export const RUBRIQUES: ReadonlyArray<{ id: RubriqueId; titre: string; icone: string }> = [
  { id: 'presence', titre: 'layout.primary.presence', icone: 'fact_check' },
  { id: 'registrar', titre: 'layout.primary.registrar', icone: 'school' },
  { id: 'finance', titre: 'layout.primary.finance', icone: 'payments' },
  { id: 'campus', titre: 'layout.primary.campus', icone: 'apartment' },
  { id: 'administration', titre: 'layout.primary.administration', icone: 'settings' },
];

/**
 * Intertitres d'une rubrique. Ils se classent par ordre alphabétique dans la
 * langue affichée (voir `menuPour`) : leur ordre change donc entre le français
 * et l'anglais, et ne se fige pas ici.
 */
export type Section =
  | 'accueilUniversity.dossiers'
  | 'accueilUniversity.resultats'
  | 'accueilUniversity.documents'
  | 'layout.groups.documents'
  | 'layout.groups.organisation'
  | 'layout.groups.settings';

export interface EntreeNavigation {
  /** Adresse de l'écran ; une route du routeur doit lui correspondre. */
  path: string;
  /** Clé i18n du titre — celle que porte `meta.titre` de la route. */
  titre: string;
  rubrique: RubriqueId;
  /** Intertitre dans la rubrique (absent : la rubrique n'en a pas). */
  section?: Section;
  icone: string;
  /** Service facultatif (paramètres › services) dont la désactivation masque l'écran. */
  service?: string;
  /** Rôles admis sur la route (`meta.roles`) et, par défaut, dans le menu. */
  roles: Role[];
  /** Rang dans la rubrique, à section égale. */
  ordre: number;
  /**
   * `false` : l'écran n'a pas d'entrée propre, il est regroupé derrière
   * `famille` (voir docs/audits/2026-10-13-bilan-simplification.md,
   * « Regrouper la navigation »).
   */
  menu?: false;
  /** Restreint l'entrée du menu à ces rôles ; la route reste ouverte à `roles`. */
  menuRoles?: Role[];
  /** Titre propre à certains rôles. */
  titrePour?: Partial<Record<Role, string>>;
  /** Raccourci en tête du menu : rang de l'entrée pour chaque rôle concerné. */
  raccourciPour?: Partial<Record<Role, number>>;
  /** Tâche fréquente de l'accueil de l'université : rang pour chaque rôle concerné. */
  tacheAccueilPour?: Partial<Record<Role, number>>;
  /** Page d'arrivée de ces rôles après connexion (à défaut : le tableau de bord). */
  accueilDe?: Role[];
  /** Entrée du menu qui regroupe cet écran et s'allume quand on le visite. */
  famille?: string;
  /**
   * Adresse de l'écran vers lequel cette entrée redirige. Elle ne mène donc
   * à aucun écran propre : la route correspondante est une redirection, et
   * ses droits sont ceux de la cible.
   */
  redirection?: string;
}

export const MANIFESTE: readonly EntreeNavigation[] = [
  // ── Présences ──────────────────────────────────────────────────────────
  {
    path: '/suivi-presences',
    titre: 'layout.sections.presence',
    rubrique: 'presence',
    icone: 'insights',
    ordre: 10,
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR'],
    raccourciPour: { DIRECTION: 1, ADMIN: 3, CHEF_DEPARTEMENT: 3 },
    tacheAccueilPour: { DIRECTION: 0, CHEF_DEPARTEMENT: 3 },
  },
  {
    path: '/emploi-du-temps',
    titre: 'nav.emploi-du-temps',
    rubrique: 'presence',
    icone: 'calendar_month',
    ordre: 20,
    roles: [...PERSONNEL, 'ETUDIANT'],
    raccourciPour: { CONTROLEUR: 1, ENSEIGNANT: 1, ETUDIANT: 1 },
  },
  {
    path: '/controle',
    titre: 'nav.controle',
    rubrique: 'presence',
    icone: 'fact_check',
    ordre: 30,
    roles: ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    raccourciPour: { ADMIN: 1, CONTROLEUR: 0 },
    tacheAccueilPour: { ADMIN: 0 },
    accueilDe: ['CONTROLEUR'],
  },
  // L'enseignant passe par « Mes séances » : le registre ne lui est ouvert que par adresse.
  {
    path: '/seances',
    titre: 'nav.seances',
    rubrique: 'presence',
    icone: 'event_note',
    ordre: 40,
    roles: [...PERSONNEL],
    menuRoles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR'],
    raccourciPour: { CHEF_DEPARTEMENT: 1 },
    tacheAccueilPour: { CHEF_DEPARTEMENT: 0 },
  },
  {
    path: '/mes-seances',
    titre: 'nav.mes-seances',
    rubrique: 'presence',
    icone: 'person_pin',
    ordre: 50,
    roles: ['ENSEIGNANT'],
    raccourciPour: { ENSEIGNANT: 0 },
    accueilDe: ['ENSEIGNANT'],
  },
  {
    path: '/synthese-presences',
    titre: 'accueilUniversity.attendance',
    rubrique: 'presence',
    icone: 'dashboard',
    ordre: 60,
    roles: ['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    menu: false,
    famille: '/suivi-presences',
  },
  // Les justificatifs sont un acte d'administration : l'enseignant dépose, la
  // scolarité enregistre, la direction arbitre. Le contrôleur constate sur le
  // terrain mais n'instruit pas.
  {
    path: '/justificatifs',
    titre: 'nav.justificatifs',
    rubrique: 'presence',
    icone: 'assignment_late',
    ordre: 70,
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT'],
    raccourciPour: { ENSEIGNANT: 2 },
  },
  {
    path: '/statistiques',
    titre: 'nav.statistiques',
    rubrique: 'presence',
    icone: 'query_stats',
    ordre: 80,
    roles: ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
    menu: false,
    famille: '/suivi-presences',
  },
  {
    /**
     * Moyens de preuve : appareils de contrôle et moyens d'attestation des
     * enseignants. Les `@Roles` de `/attestation` sont administration,
     * scolarité, chef de département et direction ; les appareils en
     * particulier restent à l'administration et à la direction.
     */
    path: '/moyens-attestation',
    titre: 'nav.moyens-attestation',
    rubrique: 'presence',
    icone: 'fingerprint',
    ordre: 90,
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
  },
  {
    /**
     * Correction des pointages : les rôles qui peuvent corriger un pointage
     * (`PUT /controles/:id`), c'est-à-dire l'administration, la direction, le
     * chef de département et le contrôleur. La suppression, elle, est
     * réservée à l'administration et à la direction.
     */
    path: '/corrections-pointages',
    titre: 'nav.corrections-pointages',
    rubrique: 'presence',
    icone: 'edit_note',
    ordre: 100,
    roles: ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  },
  {
    path: '/rapports',
    titre: 'nav.rapports',
    rubrique: 'presence',
    icone: 'insights',
    ordre: 90,
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
    menu: false,
    famille: '/suivi-presences',
  },

  // ── Scolarité ──────────────────────────────────────────────────────────
  {
    path: '/documents',
    titre: 'layout.sections.documents',
    rubrique: 'registrar',
    section: 'accueilUniversity.documents',
    icone: 'description',
    ordre: 10,
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE'],
    raccourciPour: { SCOLARITE: 3 },
    tacheAccueilPour: { ADMIN: 3 },
  },
  // Redirection vers « Mes demandes » : regroupe demandes et réclamations de l'étudiant.
  {
    path: '/mes-demarches',
    titre: 'layout.sections.procedures',
    rubrique: 'registrar',
    section: 'layout.groups.documents',
    icone: 'assignment',
    ordre: 20,
    roles: ['ETUDIANT'],
    redirection: '/demandes-docs/mes',
  },
  {
    path: '/portail',
    titre: 'nav.portail',
    rubrique: 'registrar',
    section: 'accueilUniversity.dossiers',
    icone: 'person',
    ordre: 30,
    roles: ['ETUDIANT'],
    raccourciPour: { ETUDIANT: 0 },
    accueilDe: ['ETUDIANT'],
  },
  {
    path: '/ma-carte',
    titre: 'nav.ma-carte',
    rubrique: 'registrar',
    section: 'accueilUniversity.documents',
    icone: 'badge',
    service: 'cartes',
    ordre: 40,
    roles: ['ETUDIANT'],
    raccourciPour: { ETUDIANT: 2 },
  },
  {
    path: '/demandes-docs/mes',
    titre: 'nav.mes-demandes-docs',
    rubrique: 'registrar',
    section: 'accueilUniversity.documents',
    icone: 'description',
    ordre: 50,
    roles: ['ETUDIANT'],
    menu: false,
    famille: '/mes-demarches',
  },
  {
    path: '/reclamations/mes',
    titre: 'nav.mes-reclamations',
    rubrique: 'registrar',
    section: 'layout.groups.documents',
    icone: 'support_agent',
    service: 'reclamations',
    ordre: 60,
    roles: ['ETUDIANT'],
    menu: false,
    famille: '/mes-demarches',
  },
  {
    path: '/etudiants',
    titre: 'nav.etudiants',
    rubrique: 'registrar',
    section: 'accueilUniversity.dossiers',
    icone: 'groups',
    ordre: 70,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  },
  {
    path: '/inscriptions',
    titre: 'nav.inscriptions',
    rubrique: 'registrar',
    section: 'accueilUniversity.dossiers',
    icone: 'how_to_reg',
    ordre: 80,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    raccourciPour: { ADMIN: 2, SCOLARITE: 1 },
    tacheAccueilPour: { ADMIN: 1 },
  },
  {
    path: '/evaluations',
    titre: 'nav.evaluations',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'fact_check',
    ordre: 90,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    raccourciPour: { SCOLARITE: 2, CHEF_DEPARTEMENT: 2 },
    tacheAccueilPour: { ADMIN: 2, CHEF_DEPARTEMENT: 1 },
  },
  {
    path: '/notes',
    titre: 'nav.notes',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'edit_note',
    ordre: 100,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    menu: false,
    famille: '/evaluations',
  },
  {
    path: '/examens',
    titre: 'nav.examens',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'quiz',
    service: 'examens',
    ordre: 110,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  // Le scan s'ouvre depuis l'organisation des examens ; seuls l'enseignant et
  // le contrôleur, qui n'y ont pas accès, en gardent l'entrée directe.
  {
    path: '/examens/scan',
    titre: 'nav.scan-examen',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'qr_code_scanner',
    service: 'examens',
    ordre: 120,
    roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION'],
    menuRoles: ['ENSEIGNANT', 'CONTROLEUR'],
  },
  {
    path: '/tirage',
    titre: 'nav.tirage',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'local_printshop',
    service: 'examens',
    ordre: 130,
    roles: ['ADMIN', 'SCOLARITE'],
    menu: false,
    famille: '/examens',
  },
  {
    path: '/deliberations',
    titre: 'nav.deliberations',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'gavel',
    ordre: 140,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    tacheAccueilPour: { CHEF_DEPARTEMENT: 2 },
  },
  {
    path: '/bulletins',
    titre: 'nav.bulletins',
    rubrique: 'registrar',
    section: 'accueilUniversity.resultats',
    icone: 'school',
    ordre: 150,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
    menu: false,
    famille: '/deliberations',
  },
  {
    path: '/attestations',
    titre: 'nav.attestations',
    rubrique: 'registrar',
    section: 'accueilUniversity.documents',
    icone: 'verified_user',
    ordre: 160,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
    menu: false,
    famille: '/documents',
  },
  {
    path: '/reclamations',
    titre: 'nav.reclamations',
    rubrique: 'registrar',
    section: 'layout.groups.documents',
    icone: 'support_agent',
    service: 'reclamations',
    ordre: 170,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/demandes-docs',
    titre: 'nav.demandes-docs',
    rubrique: 'registrar',
    section: 'accueilUniversity.documents',
    icone: 'description',
    ordre: 180,
    roles: ['ADMIN', 'SCOLARITE'],
    menu: false,
    famille: '/documents',
  },
  {
    path: '/cartes-etudiantes',
    titre: 'nav.cartes-etudiantes',
    rubrique: 'registrar',
    section: 'accueilUniversity.documents',
    icone: 'badge',
    service: 'cartes',
    ordre: 190,
    roles: ['ADMIN', 'SCOLARITE'],
    menu: false,
    famille: '/documents',
  },
  {
    path: '/stages',
    titre: 'nav.stages',
    rubrique: 'registrar',
    section: 'layout.groups.documents',
    icone: 'work',
    service: 'stages',
    ordre: 200,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT'],
  },
  {
    path: '/scolarite',
    titre: 'nav.scolarite',
    rubrique: 'registrar',
    section: 'accueilUniversity.dossiers',
    icone: 'school',
    ordre: 210,
    roles: ['SCOLARITE', 'ADMIN'],
    raccourciPour: { SCOLARITE: 0 },
    accueilDe: ['SCOLARITE'],
  },

  // ── Finances ───────────────────────────────────────────────────────────
  {
    path: '/paiements',
    titre: 'nav.paiements',
    rubrique: 'finance',
    icone: 'payments',
    ordre: 10,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/recettes',
    titre: 'nav.recettes',
    rubrique: 'finance',
    icone: 'request_quote',
    ordre: 20,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/paie',
    titre: 'nav.paie',
    rubrique: 'finance',
    icone: 'payments',
    ordre: 30,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
    raccourciPour: { DIRECTION: 2 },
    tacheAccueilPour: { DIRECTION: 2 },
  },
  {
    /** Grille des tarifs d'inscription : administration et scolarité. */
    path: '/frais',
    titre: 'nav.frais',
    rubrique: 'finance',
    icone: 'request_quote',
    ordre: 40,
    roles: ['ADMIN', 'SCOLARITE'],
  },

  // ── Campus ─────────────────────────────────────────────────────────────
  {
    path: '/vod',
    titre: 'nav.vod',
    rubrique: 'campus',
    icone: 'play_circle',
    service: 'vod',
    ordre: 10,
    /**
     * Le contrôleur y entre aussi : la lecture d'une VOD publique est ouverte
     * à tout utilisateur connecté côté API (`GET /vod` et `GET /vod/:id` n'ont
     * pas de `@Roles`), et le lecteur `/vod/lecteur/:id` lui était déjà
     * ouvert — l'écran et son lecteur ne peuvent pas en dire deux choses
     * différentes.
     */
    roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION', 'ETUDIANT'],
    titrePour: { ETUDIANT: 'layout.studentVideoCourses' },
  },
  /** Lecteur d'une vidéo : les mêmes rôles que le catalogue `/vod`. */
  {
    path: '/vod/lecteur/:id',
    titre: 'nav.vod-lecteur',
    rubrique: 'campus',
    icone: 'play_circle',
    service: 'vod',
    ordre: 11,
    roles: ['ENSEIGNANT', 'CONTROLEUR', 'ADMIN', 'SCOLARITE', 'DIRECTION', 'ETUDIANT'],
    menu: false,
    famille: '/vod',
  },
  {
    path: '/elections/vote',
    titre: 'nav.elections-vote',
    rubrique: 'campus',
    icone: 'how_to_vote',
    service: 'elections',
    ordre: 20,
    /**
     * Tout utilisateur connecté peut voter : `POST /elections/vote` n'a pas de
     * `@Roles` et le service ne filtre que par l'ouverture du scrutin et
     * l'unicité du bulletin. Le bulletin imprimable (`@ProtectedDocument`)
     * cite d'ailleurs les sept rôles. On n'exclut donc personne.
     */
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT', 'ETUDIANT'],
  },
  {
    path: '/badges',
    titre: 'nav.badges',
    rubrique: 'campus',
    icone: 'how_to_reg',
    service: 'badges',
    ordre: 30,
    roles: ['ADMIN', 'SCOLARITE'],
  },
  {
    path: '/cites',
    titre: 'nav.cites',
    rubrique: 'campus',
    icone: 'apartment',
    service: 'logements',
    ordre: 40,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/resto',
    titre: 'nav.resto',
    rubrique: 'campus',
    icone: 'restaurant',
    service: 'restauration',
    ordre: 50,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR'],
  },
  {
    path: '/bibliotheque-gestion',
    titre: 'nav.bibliotheque',
    rubrique: 'campus',
    icone: 'local_library',
    service: 'bibliotheque',
    ordre: 60,
    roles: ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT'],
  },
  {
    path: '/formations-admin',
    titre: 'nav.formations-admin',
    rubrique: 'campus',
    icone: 'workspace_premium',
    service: 'formations',
    ordre: 70,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/reservations',
    titre: 'nav.reservations',
    rubrique: 'campus',
    icone: 'event_seat',
    service: 'reservations',
    ordre: 80,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'],
  },
  {
    path: '/helpdesk',
    titre: 'nav.helpdesk',
    rubrique: 'campus',
    icone: 'headset_mic',
    service: 'helpdesk',
    ordre: 90,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'],
  },
  {
    path: '/elections',
    titre: 'nav.elections',
    rubrique: 'campus',
    icone: 'how_to_vote',
    service: 'elections',
    ordre: 100,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/patrimoine',
    titre: 'nav.patrimoine',
    rubrique: 'campus',
    icone: 'inventory_2',
    service: 'patrimoine',
    ordre: 110,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },

  // ── Administration ─────────────────────────────────────────────────────
  {
    path: '/affectations',
    titre: 'nav.affectations',
    rubrique: 'administration',
    section: 'layout.groups.organisation',
    icone: 'assignment_ind',
    ordre: 10,
    roles: ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'],
  },
  {
    path: '/enseignants',
    titre: 'nav.enseignants',
    rubrique: 'administration',
    section: 'layout.groups.organisation',
    icone: 'person',
    ordre: 20,
    roles: ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'],
  },
  {
    path: '/matieres',
    titre: 'nav.matieres',
    rubrique: 'administration',
    section: 'layout.groups.organisation',
    icone: 'menu_book',
    ordre: 30,
    roles: ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'],
  },
  {
    path: '/structure',
    titre: 'nav.structure',
    rubrique: 'administration',
    section: 'layout.groups.organisation',
    icone: 'account_tree',
    ordre: 40,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  {
    path: '/salles',
    titre: 'nav.salles',
    rubrique: 'administration',
    section: 'layout.groups.organisation',
    icone: 'meeting_room',
    ordre: 50,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR'],
  },
  {
    path: '/imports',
    titre: 'nav.imports',
    rubrique: 'administration',
    section: 'layout.groups.organisation',
    icone: 'upload_file',
    ordre: 60,
    roles: ['ADMIN', 'SCOLARITE'],
  },
  // Registre de contrôle : l'étudiant est renvoyé vers son espace (voir la garde).
  {
    path: '/',
    titre: 'accueilUniversity.title',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'dashboard',
    ordre: 70,
    roles: ['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
    raccourciPour: { ADMIN: 0, DIRECTION: 0, CHEF_DEPARTEMENT: 0 },
  },
  {
    path: '/plagiat',
    titre: 'nav.plagiat',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'find_in_page',
    service: 'bibliotheque',
    ordre: 80,
    roles: ['ADMIN', 'DIRECTION'],
  },
  /** Fiche d'un rapport de plagiat : mêmes droits que le registre `/plagiat`. */
  {
    path: '/plagiat/:id',
    titre: 'nav.plagiat-detail',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'find_in_page',
    service: 'bibliotheque',
    ordre: 81,
    roles: ['ADMIN', 'DIRECTION'],
    menu: false,
    famille: '/plagiat',
  },
  {
    path: '/audit',
    titre: 'nav.audit',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'history',
    ordre: 90,
    roles: ['ADMIN', 'DIRECTION'],
  },
  {
    path: '/statistiques-mesrs',
    titre: 'nav.statistiques-mesrs',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'analytics',
    service: 'rectorat',
    ordre: 100,
    roles: ['ADMIN', 'DIRECTION'],
    menu: false,
    famille: '/bilan',
  },
  // Redirection vers le rectorat : « Bilan de l'établissement » regroupe situation et archives.
  {
    path: '/bilan',
    titre: 'layout.sections.bilan',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'account_balance',
    service: 'rectorat',
    ordre: 110,
    roles: ['ADMIN', 'DIRECTION'],
    raccourciPour: { DIRECTION: 3 },
    tacheAccueilPour: { DIRECTION: 1 },
    redirection: '/rectorat',
  },
  {
    path: '/rectorat',
    titre: 'nav.rectorat',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'account_balance',
    service: 'rectorat',
    ordre: 115,
    roles: ['ADMIN', 'DIRECTION'],
    menu: false,
    famille: '/bilan',
  },
  {
    path: '/courrier',
    titre: 'nav.courrier',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'mail',
    service: 'courrier',
    ordre: 120,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  },
  {
    path: '/notifications',
    titre: 'nav.notifications',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'sms',
    service: 'notifications',
    ordre: 130,
    roles: ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  },
  // Les tarifs des documents s'ouvrent depuis les paramètres.
  {
    path: '/demandes-docs/tarifs',
    titre: 'nav.tarifs-demandes',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'price_change',
    ordre: 140,
    roles: ['ADMIN'],
    menu: false,
  },
  {
    path: '/utilisateurs',
    titre: 'nav.utilisateurs',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'manage_accounts',
    ordre: 150,
    roles: ['ADMIN'],
  },
  {
    path: '/parametres',
    titre: 'nav.parametres',
    rubrique: 'administration',
    section: 'layout.groups.settings',
    icone: 'settings',
    ordre: 160,
    roles: ['ADMIN'],
  },
];

/**
 * Écrans publics (hors menu) masqués par un service facultatif. Les sous-pages
 * (`/plagiat/:id`, `/vod/lecteur/:id`…) suivent le service de leur premier
 * segment d'adresse.
 */
export const SERVICES_ECRANS_PUBLICS: Readonly<Record<string, string>> = {
  '/bibliotheque': 'bibliotheque',
  '/formations': 'formations',
  '/verification-carte': 'cartes',
  '/verification-badge': 'badges',
};
