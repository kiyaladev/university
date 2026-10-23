/**
 * Catalogue de messages en anglais.
 *
 * Ce fichier est un point d'entrée séparé : il est chargé à la demande, dans
 * son propre morceau, quand l'anglais est la langue active (voir
 * `src/i18n/index.ts`). Rien d'autre ne doit l'importer statiquement, sinon
 * les deux langues retombent dans le morceau principal.
 */
import filePointagesEN from './filePointages';
import accueilScolariteEN from './accueilScolarite';
import auditEN from './audit';
import servicesActifsEN from './servicesActifs';
import accueilUniversityEN from './accueilUniversity';
import commonEN from './common';
import libellesEN from './libelles';
import layoutEN from './layout';
import navEN from './nav';
import pointageEN from './pointage';
import bibliothequeEN from './bibliotheque';
import citesEN from './cites';
import structureEN from './structure';
import helpdeskEN from './helpdesk';
import affectationsEN from './affectations';
import attestationsEN from './attestations';
import badgesEN from './badges';
import bibliothequePubliqueEN from './bibliothequePublique';
import bulletinsEN from './bulletins';
import carteEtudianteEN from './carteEtudiante';
import controleEN from './controle';
import courrierEN from './courrier';
import dashboardEN from './dashboard';
import deliberationsEN from './deliberations';
import demandeDocumentsEN from './demandeDocuments';
import electionsEN from './elections';
import evaluationsEN from './evaluations';
import emploiDuTempsEN from './emploiDuTemps';
import enseignantsEN from './enseignants';
import errorNotFoundEN from './errorNotFound';
import etudiantsEN from './etudiants';
import examensEN from './examens';
import formationsAdminEN from './formationsAdmin';
import formationsPubliquesEN from './formationsPubliques';
import inscriptionsEN from './inscriptions';
import inscriptionPubliqueEN from './inscriptionPublique';
import justificatifsEN from './justificatifs';
import loginPageEN from './loginPage';
import maCarteEN from './maCarte';
import matieresEN from './matieres';
import mesDemandesEN from './mesDemandes';
import mesReclamationsEN from './mesReclamations';
import mesSeancesEN from './mesSeances';
import notesEN from './notes';
import notificationsEN from './notifications';
import paieEN from './paie';
import paiementsEN from './paiements';
import parametresEN from './parametres';
import patrimoineEN from './patrimoine';
import plagiatDetailEN from './plagiatDetail';
import plagiatPageEN from './plagiatPage';
import portailEN from './portail';
import portailConnexionEN from './portailConnexion';
import rapportsEN from './rapports';
import recettesEN from './recettes';
import reclamationsEN from './reclamations';
import rectoratEN from './rectorat';
import reservationsEN from './reservations';
import restoEN from './resto';
import sallesEN from './salles';
import scanExamenEN from './scanExamen';
import seancesEN from './seances';
import stagesEN from './stages';
import statistiquesEN from './statistiques';
import statistiquesMesrsEN from './statistiquesMesrs';
import tarifsDemandeAdminEN from './tarifsDemandeAdmin';
import tirageEN from './tirage';
import utilisateursEN from './utilisateurs';
import verificationEN from './verification';
import verificationBadgeEN from './verificationBadge';
import verificationCarteEN from './verificationCarte';
import vodLecteurEN from './vodLecteur';
import vodPageEN from './vodPage';
import voteEN from './vote';
import importsEN from './imports';

const messages = {
  accueilUniversity: accueilUniversityEN,
  servicesActifs: servicesActifsEN,
  accueilScolarite: accueilScolariteEN,
  filePointages: filePointagesEN,
  audit: auditEN,
  common: commonEN,
  libelles: libellesEN,
  layout: layoutEN,
  nav: navEN,
  pointage: pointageEN,
  bibliotheque: bibliothequeEN,
  cites: citesEN,
  structure: structureEN,
  helpdesk: helpdeskEN,
  affectations: affectationsEN,
  attestations: attestationsEN,
  badges: badgesEN,
  bibliothequePublique: bibliothequePubliqueEN,
  bulletins: bulletinsEN,
  carteEtudiante: carteEtudianteEN,
  controle: controleEN,
  courrier: courrierEN,
  dashboard: dashboardEN,
  deliberations: deliberationsEN,
  demandeDocuments: demandeDocumentsEN,
  elections: electionsEN,
  evaluations: evaluationsEN,
  emploiDuTemps: emploiDuTempsEN,
  enseignants: enseignantsEN,
  errorNotFound: errorNotFoundEN,
  etudiants: etudiantsEN,
  examens: examensEN,
  formationsAdmin: formationsAdminEN,
  formationsPubliques: formationsPubliquesEN,
  inscriptions: inscriptionsEN,
  imports: importsEN,
  inscriptionPublique: inscriptionPubliqueEN,
  justificatifs: justificatifsEN,
  loginPage: loginPageEN,
  maCarte: maCarteEN,
  matieres: matieresEN,
  mesDemandes: mesDemandesEN,
  mesReclamations: mesReclamationsEN,
  mesSeances: mesSeancesEN,
  notes: notesEN,
  notifications: notificationsEN,
  paie: paieEN,
  paiements: paiementsEN,
  parametres: parametresEN,
  patrimoine: patrimoineEN,
  plagiatDetail: plagiatDetailEN,
  plagiatPage: plagiatPageEN,
  portail: portailEN,
  portailConnexion: portailConnexionEN,
  rapports: rapportsEN,
  recettes: recettesEN,
  reclamations: reclamationsEN,
  rectorat: rectoratEN,
  reservations: reservationsEN,
  resto: restoEN,
  salles: sallesEN,
  scanExamen: scanExamenEN,
  seances: seancesEN,
  stages: stagesEN,
  statistiques: statistiquesEN,
  statistiquesMesrs: statistiquesMesrsEN,
  tarifsDemandeAdmin: tarifsDemandeAdminEN,
  tirage: tirageEN,
  utilisateurs: utilisateursEN,
  verification: verificationEN,
  verificationBadge: verificationBadgeEN,
  verificationCarte: verificationCarteEN,
  vodLecteur: vodLecteurEN,
  vodPage: vodPageEN,
  vote: voteEN,
};


export default messages;
