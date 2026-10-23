/**
 * Catalogue de messages en français.
 *
 * Ce fichier est un point d'entrée séparé : il est chargé à la demande, dans
 * son propre morceau, quand le français est la langue active (voir
 * `src/i18n/index.ts`). Rien d'autre ne doit l'importer statiquement, sinon
 * les deux langues retombent dans le morceau principal.
 */
import filePointagesFR from './filePointages';
import accueilScolariteFR from './accueilScolarite';
import auditFR from './audit';
import servicesActifsFR from './servicesActifs';
import accueilUniversityFR from './accueilUniversity';
import commonFR from './common';
import libellesFR from './libelles';
import layoutFR from './layout';
import navFR from './nav';
import pointageFR from './pointage';
import bibliothequeFR from './bibliotheque';
import citesFR from './cites';
import structureFR from './structure';
import helpdeskFR from './helpdesk';
import correctionsPointagesFR from './correctionsPointages';
import fraisFR from './frais';
import moyensAttestationFR from './moyensAttestation';
import affectationsFR from './affectations';
import attestationsFR from './attestations';
import badgesFR from './badges';
import bibliothequePubliqueFR from './bibliothequePublique';
import bulletinsFR from './bulletins';
import carteEtudianteFR from './carteEtudiante';
import controleFR from './controle';
import courrierFR from './courrier';
import dashboardFR from './dashboard';
import deliberationsFR from './deliberations';
import demandeDocumentsFR from './demandeDocuments';
import electionsFR from './elections';
import evaluationsFR from './evaluations';
import emploiDuTempsFR from './emploiDuTemps';
import enseignantsFR from './enseignants';
import errorNotFoundFR from './errorNotFound';
import etudiantsFR from './etudiants';
import examensFR from './examens';
import formationsAdminFR from './formationsAdmin';
import formationsPubliquesFR from './formationsPubliques';
import inscriptionsFR from './inscriptions';
import inscriptionPubliqueFR from './inscriptionPublique';
import justificatifsFR from './justificatifs';
import loginPageFR from './loginPage';
import maCarteFR from './maCarte';
import matieresFR from './matieres';
import mesDemandesFR from './mesDemandes';
import mesReclamationsFR from './mesReclamations';
import mesSeancesFR from './mesSeances';
import notesFR from './notes';
import notificationsFR from './notifications';
import paieFR from './paie';
import paiementsFR from './paiements';
import parametresFR from './parametres';
import patrimoineFR from './patrimoine';
import plagiatDetailFR from './plagiatDetail';
import plagiatPageFR from './plagiatPage';
import portailFR from './portail';
import portailConnexionFR from './portailConnexion';
import rapportsFR from './rapports';
import recettesFR from './recettes';
import reclamationsFR from './reclamations';
import rectoratFR from './rectorat';
import reservationsFR from './reservations';
import restoFR from './resto';
import sallesFR from './salles';
import scanExamenFR from './scanExamen';
import seancesFR from './seances';
import stagesFR from './stages';
import statistiquesFR from './statistiques';
import statistiquesMesrsFR from './statistiquesMesrs';
import tarifsDemandeAdminFR from './tarifsDemandeAdmin';
import tirageFR from './tirage';
import utilisateursFR from './utilisateurs';
import verificationFR from './verification';
import verificationBadgeFR from './verificationBadge';
import verificationCarteFR from './verificationCarte';
import vodLecteurFR from './vodLecteur';
import vodPageFR from './vodPage';
import voteFR from './vote';
import importsFR from './imports';

const messages = {
  accueilUniversity: accueilUniversityFR,
  servicesActifs: servicesActifsFR,
  accueilScolarite: accueilScolariteFR,
  filePointages: filePointagesFR,
  audit: auditFR,
  common: commonFR,
  libelles: libellesFR,
  layout: layoutFR,
  nav: navFR,
  pointage: pointageFR,
  bibliotheque: bibliothequeFR,
  cites: citesFR,
  structure: structureFR,
  helpdesk: helpdeskFR,
  correctionsPointages: correctionsPointagesFR,
  frais: fraisFR,
  moyensAttestation: moyensAttestationFR,
  affectations: affectationsFR,
  attestations: attestationsFR,
  badges: badgesFR,
  bibliothequePublique: bibliothequePubliqueFR,
  bulletins: bulletinsFR,
  carteEtudiante: carteEtudianteFR,
  controle: controleFR,
  courrier: courrierFR,
  dashboard: dashboardFR,
  deliberations: deliberationsFR,
  demandeDocuments: demandeDocumentsFR,
  elections: electionsFR,
  evaluations: evaluationsFR,
  emploiDuTemps: emploiDuTempsFR,
  enseignants: enseignantsFR,
  errorNotFound: errorNotFoundFR,
  etudiants: etudiantsFR,
  examens: examensFR,
  formationsAdmin: formationsAdminFR,
  formationsPubliques: formationsPubliquesFR,
  inscriptions: inscriptionsFR,
  imports: importsFR,
  inscriptionPublique: inscriptionPubliqueFR,
  justificatifs: justificatifsFR,
  loginPage: loginPageFR,
  maCarte: maCarteFR,
  matieres: matieresFR,
  mesDemandes: mesDemandesFR,
  mesReclamations: mesReclamationsFR,
  mesSeances: mesSeancesFR,
  notes: notesFR,
  notifications: notificationsFR,
  paie: paieFR,
  paiements: paiementsFR,
  parametres: parametresFR,
  patrimoine: patrimoineFR,
  plagiatDetail: plagiatDetailFR,
  plagiatPage: plagiatPageFR,
  portail: portailFR,
  portailConnexion: portailConnexionFR,
  rapports: rapportsFR,
  recettes: recettesFR,
  reclamations: reclamationsFR,
  rectorat: rectoratFR,
  reservations: reservationsFR,
  resto: restoFR,
  salles: sallesFR,
  scanExamen: scanExamenFR,
  seances: seancesFR,
  stages: stagesFR,
  statistiques: statistiquesFR,
  statistiquesMesrs: statistiquesMesrsFR,
  tarifsDemandeAdmin: tarifsDemandeAdminFR,
  tirage: tirageFR,
  utilisateurs: utilisateursFR,
  verification: verificationFR,
  verificationBadge: verificationBadgeFR,
  verificationCarte: verificationCarteFR,
  vodLecteur: vodLecteurFR,
  vodPage: vodPageFR,
  vote: voteFR,
};


export default messages;
