import simplificationFR from './fr-FR/simplification';
import simplificationEN from './en-US/simplification';
import filePointagesFR from './fr-FR/filePointages';
import filePointagesEN from './en-US/filePointages';
import accueilScolariteFR from './fr-FR/accueilScolarite';
import accueilScolariteEN from './en-US/accueilScolarite';
import auditFR from './fr-FR/audit';
import auditEN from './en-US/audit';
import servicesActifsFR from './fr-FR/servicesActifs';
import servicesActifsEN from './en-US/servicesActifs';
import accueilUniversityFR from './fr-FR/accueilUniversity';
import accueilUniversityEN from './en-US/accueilUniversity';
/**
 * Agrégation de tous les messages i18n.
 *
 * Chaque namespace (page ou groupe de composants) est importé ici et
 * fusionné dans le bloc de la locale correspondante.
 */
import commonFR from './fr-FR/common';
import libellesFR from './fr-FR/libelles';
import layoutFR from './fr-FR/layout';
import navFR from './fr-FR/nav';
import commonEN from './en-US/common';
import libellesEN from './en-US/libelles';
import layoutEN from './en-US/layout';
import navEN from './en-US/nav';

import pointageFR from './fr-FR/pointage';
import pointageEN from './en-US/pointage';
import bibliothequeFR from './fr-FR/bibliotheque';
import bibliothequeEN from './en-US/bibliotheque';
import citesFR from './fr-FR/cites';
import citesEN from './en-US/cites';
import structureFR from './fr-FR/structure';
import structureEN from './en-US/structure';
import helpdeskFR from './fr-FR/helpdesk';
import helpdeskEN from './en-US/helpdesk';

import affectationsFR from './fr-FR/affectations';
import affectationsEN from './en-US/affectations';
import attestationsFR from './fr-FR/attestations';
import attestationsEN from './en-US/attestations';
import badgesFR from './fr-FR/badges';
import badgesEN from './en-US/badges';
import bibliothequePubliqueFR from './fr-FR/bibliothequePublique';
import bibliothequePubliqueEN from './en-US/bibliothequePublique';
import bulletinsFR from './fr-FR/bulletins';
import bulletinsEN from './en-US/bulletins';
import carteEtudianteFR from './fr-FR/carteEtudiante';
import carteEtudianteEN from './en-US/carteEtudiante';
import controleFR from './fr-FR/controle';
import controleEN from './en-US/controle';
import courrierPageFR from './fr-FR/courrierPage';
import courrierPageEN from './en-US/courrierPage';
import dashboardFR from './fr-FR/dashboard';
import dashboardEN from './en-US/dashboard';
import deliberationsFR from './fr-FR/deliberations';
import deliberationsEN from './en-US/deliberations';
import demandeDocumentsFR from './fr-FR/demandeDocuments';
import demandeDocumentsEN from './en-US/demandeDocuments';
import electionsFR from './fr-FR/elections';
import electionsEN from './en-US/elections';
import evaluationsFR from './fr-FR/evaluations';
import evaluationsEN from './en-US/evaluations';
import emploiDuTempsFR from './fr-FR/emploiDuTemps';
import emploiDuTempsEN from './en-US/emploiDuTemps';
import enseignantsFR from './fr-FR/enseignants';
import enseignantsEN from './en-US/enseignants';
import errorNotFoundFR from './fr-FR/errorNotFound';
import errorNotFoundEN from './en-US/errorNotFound';
import etudiantsFR from './fr-FR/etudiants';
import etudiantsEN from './en-US/etudiants';
import examensFR from './fr-FR/examens';
import examensEN from './en-US/examens';
import formationsAdminFR from './fr-FR/formationsAdmin';
import formationsAdminEN from './en-US/formationsAdmin';
import formationsPubliquesFR from './fr-FR/formationsPubliques';
import formationsPubliquesEN from './en-US/formationsPubliques';
import inscriptionsFR from './fr-FR/inscriptions';
import inscriptionsEN from './en-US/inscriptions';
import inscriptionPubliqueFR from './fr-FR/inscriptionPublique';
import inscriptionPubliqueEN from './en-US/inscriptionPublique';
import justificatifsFR from './fr-FR/justificatifs';
import justificatifsEN from './en-US/justificatifs';
import loginPageFR from './fr-FR/loginPage';
import loginPageEN from './en-US/loginPage';
import maCarteFR from './fr-FR/maCarte';
import maCarteEN from './en-US/maCarte';
import matieresFR from './fr-FR/matieres';
import matieresEN from './en-US/matieres';
import mesDemandesFR from './fr-FR/mesDemandes';
import mesDemandesEN from './en-US/mesDemandes';
import mesReclamationsFR from './fr-FR/mesReclamations';
import mesReclamationsEN from './en-US/mesReclamations';
import mesSeancesFR from './fr-FR/mesSeances';
import mesSeancesEN from './en-US/mesSeances';
import notesFR from './fr-FR/notes';
import notesEN from './en-US/notes';
import notificationsPageFR from './fr-FR/notificationsPage';
import notificationsPageEN from './en-US/notificationsPage';
import paiePageFR from './fr-FR/paiePage';
import paiePageEN from './en-US/paiePage';
import paiementsFR from './fr-FR/paiements';
import paiementsEN from './en-US/paiements';
import parametresFR from './fr-FR/parametres';
import parametresEN from './en-US/parametres';
import patrimoineFR from './fr-FR/patrimoine';
import patrimoineEN from './en-US/patrimoine';
import plagiatDetailFR from './fr-FR/plagiatDetail';
import plagiatDetailEN from './en-US/plagiatDetail';
import plagiatPageFR from './fr-FR/plagiatPage';
import plagiatPageEN from './en-US/plagiatPage';
import portailFR from './fr-FR/portail';
import portailEN from './en-US/portail';
import portailConnexionFR from './fr-FR/portailConnexion';
import portailConnexionEN from './en-US/portailConnexion';
import rapportsFR from './fr-FR/rapports';
import rapportsEN from './en-US/rapports';
import recettesFR from './fr-FR/recettes';
import recettesEN from './en-US/recettes';
import reclamationsFR from './fr-FR/reclamations';
import reclamationsEN from './en-US/reclamations';
import rectoratPageFR from './fr-FR/rectoratPage';
import rectoratPageEN from './en-US/rectoratPage';
import reservationsFR from './fr-FR/reservations';
import reservationsEN from './en-US/reservations';
import restoFR from './fr-FR/resto';
import restoEN from './en-US/resto';
import sallesFR from './fr-FR/salles';
import sallesEN from './en-US/salles';
import scanExamenFR from './fr-FR/scanExamen';
import scanExamenEN from './en-US/scanExamen';
import seancesFR from './fr-FR/seances';
import seancesEN from './en-US/seances';
import stagesFR from './fr-FR/stages';
import stagesEN from './en-US/stages';
import statistiquesFR from './fr-FR/statistiques';
import statistiquesEN from './en-US/statistiques';
import statistiquesMesrsFR from './fr-FR/statistiquesMesrs';
import statistiquesMesrsEN from './en-US/statistiquesMesrs';
import tarifsDemandeAdminFR from './fr-FR/tarifsDemandeAdmin';
import tarifsDemandeAdminEN from './en-US/tarifsDemandeAdmin';
import tirageFR from './fr-FR/tirage';
import tirageEN from './en-US/tirage';
import utilisateursFR from './fr-FR/utilisateurs';
import utilisateursEN from './en-US/utilisateurs';
import verificationFR from './fr-FR/verification';
import verificationEN from './en-US/verification';
import verificationBadgeFR from './fr-FR/verificationBadge';
import verificationBadgeEN from './en-US/verificationBadge';
import verificationCarteFR from './fr-FR/verificationCarte';
import verificationCarteEN from './en-US/verificationCarte';
import vodLecteurFR from './fr-FR/vodLecteur';
import vodLecteurEN from './en-US/vodLecteur';
import vodPageFR from './fr-FR/vodPage';
import vodPageEN from './en-US/vodPage';
import voteFR from './fr-FR/vote';
import voteEN from './en-US/vote';
import importsFR from './fr-FR/imports';
import importsEN from './en-US/imports';

const frFR = {
  simplification: simplificationFR,
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
  affectations: affectationsFR,
  attestations: attestationsFR,
  badges: badgesFR,
  bibliothequePublique: bibliothequePubliqueFR,
  bulletins: bulletinsFR,
  carteEtudiante: carteEtudianteFR,
  controle: controleFR,
  courrierPage: courrierPageFR,
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
  notificationsPage: notificationsPageFR,
  paiePage: paiePageFR,
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
  rectoratPage: rectoratPageFR,
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

const enUS = {
  simplification: simplificationEN,
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
  courrierPage: courrierPageEN,
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
  notificationsPage: notificationsPageEN,
  paiePage: paiePageEN,
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
  rectoratPage: rectoratPageEN,
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

export default {
  'fr-FR': frFR,
  'en-US': enUS,
};
