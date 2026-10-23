-- Harmonisation des statuts : une valeur d'état est écrite sans marqueur de
-- genre (forme masculine singulière non accentuée), quelle que soit l'entité
-- qui la porte. Décision et inventaire complet : docs/decisions/statuts.md.
--
-- Pourquoi un renommage et non une réécriture :
--   * `ALTER TYPE ... RENAME VALUE` renomme la valeur dans le catalogue : les
--     lignes existantes conservent leur valeur, aucune table n'est recopiée,
--     aucun index n'est reconstruit, la table n'est pas verrouillée au-delà
--     du temps de la modification du catalogue (quelques millisecondes) ;
--   * aucune conversion de donnée n'est nécessaire : les valeurs stockées
--     sont des chaînes : le renommage suffit pour qu'elles soient lues
--     sous le nouveau nom.
--
-- Ce que le renommage ne fait pas (à faire en amont) :
--   * l'ancien code applicatif écrit encore les anciennes valeurs : il doit
--     être arrêté (écritures coupées) pendant l'application de cette
--     migration, puis remplacé. Le nouveau backend accepte les anciennes
--     valeurs en entrée pendant la transition (voir
--     backend/src/common/statuts.ts) ;
--   * les fichiers hors ligne du navigateur (pointages, séances en file)
--     portent des valeurs anciennes : ils sont convertis à la lecture
--     (frontend/src/shared/utils/statuts.ts).
--
-- Réversibilité : chaque renommage est réversible ligne à ligne. Le script
-- inverse est donné en fin de fichier ; il s'applique dans le même sens
-- (du nouveau nom vers l'ancien) après arrêt des écritures.
--
-- Aucune de ces commandes n'a été exécutée sur une base de production par la
-- branche qui porte cette migration.

-- StatutSeance
ALTER TYPE "StatutSeance" RENAME VALUE 'ANNULEE' TO 'ANNULE';
ALTER TYPE "StatutSeance" RENAME VALUE 'CONTROLEE' TO 'CONTROLE';
ALTER TYPE "StatutSeance" RENAME VALUE 'PLANIFIEE' TO 'PLANIFIE';

-- StatutInscription
ALTER TYPE "StatutInscription" RENAME VALUE 'ANNULEE' TO 'ANNULE';
ALTER TYPE "StatutInscription" RENAME VALUE 'PAYEE' TO 'PAYE';
ALTER TYPE "StatutInscription" RENAME VALUE 'VALIDEE' TO 'VALIDE';

-- StatutPaie
ALTER TYPE "StatutPaie" RENAME VALUE 'PAYEE' TO 'PAYE';
ALTER TYPE "StatutPaie" RENAME VALUE 'VALIDEE' TO 'VALIDE';

-- StatutEvaluation
ALTER TYPE "StatutEvaluation" RENAME VALUE 'CLOTUREE' TO 'CLOTURE';
ALTER TYPE "StatutEvaluation" RENAME VALUE 'OUVERTE' TO 'OUVERT';

-- StatutDeliberation
ALTER TYPE "StatutDeliberation" RENAME VALUE 'VALIDEE' TO 'VALIDE';

-- StatutAttestation
ALTER TYPE "StatutAttestation" RENAME VALUE 'EMISE' TO 'EMIS';
ALTER TYPE "StatutAttestation" RENAME VALUE 'REVOQUEE' TO 'REVOQUE';

-- StatutNotification
ALTER TYPE "StatutNotification" RENAME VALUE 'ENVOYEE' TO 'ENVOYE';

-- StatutChambre
ALTER TYPE "StatutChambre" RENAME VALUE 'OCCUPEE' TO 'OCCUPE';
ALTER TYPE "StatutChambre" RENAME VALUE 'RESERVEE' TO 'RESERVE';

-- StatutAttributionLogement
ALTER TYPE "StatutAttributionLogement" RENAME VALUE 'ACCORDEE' TO 'ACCORDE';
ALTER TYPE "StatutAttributionLogement" RENAME VALUE 'REFUSEE' TO 'REFUSE';
ALTER TYPE "StatutAttributionLogement" RENAME VALUE 'RETIREE' TO 'RETIRE';

-- StatutConsommation
ALTER TYPE "StatutConsommation" RENAME VALUE 'ANNULEE' TO 'ANNULE';
ALTER TYPE "StatutConsommation" RENAME VALUE 'VALIDEE' TO 'VALIDE';

-- StatutReservationSalle
ALTER TYPE "StatutReservationSalle" RENAME VALUE 'ANNULEE' TO 'ANNULE';
ALTER TYPE "StatutReservationSalle" RENAME VALUE 'CONFIRMEE' TO 'CONFIRME';
ALTER TYPE "StatutReservationSalle" RENAME VALUE 'REFUSEE' TO 'REFUSE';

-- StatutFormation
ALTER TYPE "StatutFormation" RENAME VALUE 'COMPLETE' TO 'COMPLET';
ALTER TYPE "StatutFormation" RENAME VALUE 'PUBLIEE' TO 'PUBLIE';

-- StatutInscriptionFormation
ALTER TYPE "StatutInscriptionFormation" RENAME VALUE 'ANNULEE' TO 'ANNULE';
ALTER TYPE "StatutInscriptionFormation" RENAME VALUE 'CONFIRMEE' TO 'CONFIRME';

-- StatutReclamation
ALTER TYPE "StatutReclamation" RENAME VALUE 'FERMEE' TO 'FERME';
ALTER TYPE "StatutReclamation" RENAME VALUE 'OUVERTE' TO 'OUVERT';
ALTER TYPE "StatutReclamation" RENAME VALUE 'REJETEE' TO 'REJETE';
ALTER TYPE "StatutReclamation" RENAME VALUE 'RESOLUE' TO 'RESOLU';

-- StatutDemande
ALTER TYPE "StatutDemande" RENAME VALUE 'PAYEE' TO 'PAYE';
ALTER TYPE "StatutDemande" RENAME VALUE 'PRETE' TO 'PRET';
ALTER TYPE "StatutDemande" RENAME VALUE 'REJETEE' TO 'REJETE';

-- StatutElection
ALTER TYPE "StatutElection" RENAME VALUE 'ANNULEE' TO 'ANNULE';
ALTER TYPE "StatutElection" RENAME VALUE 'CLOSE' TO 'CLOS';
ALTER TYPE "StatutElection" RENAME VALUE 'OUVERTE' TO 'OUVERT';
ALTER TYPE "StatutElection" RENAME VALUE 'PROCLAMEE' TO 'PROCLAME';

-- Script inverse (retour arrière) — à exécuter dans l'autre sens,
-- après arrêt des écritures, si le retour arrière est décidé :
--
-- ALTER TYPE "StatutSeance" RENAME VALUE 'ANNULE' TO 'ANNULEE';
-- ALTER TYPE "StatutSeance" RENAME VALUE 'CONTROLE' TO 'CONTROLEE';
-- ALTER TYPE "StatutSeance" RENAME VALUE 'PLANIFIE' TO 'PLANIFIEE';
-- ALTER TYPE "StatutInscription" RENAME VALUE 'ANNULE' TO 'ANNULEE';
-- ALTER TYPE "StatutInscription" RENAME VALUE 'PAYE' TO 'PAYEE';
-- ALTER TYPE "StatutInscription" RENAME VALUE 'VALIDE' TO 'VALIDEE';
-- ALTER TYPE "StatutPaie" RENAME VALUE 'PAYE' TO 'PAYEE';
-- ALTER TYPE "StatutPaie" RENAME VALUE 'VALIDE' TO 'VALIDEE';
-- ALTER TYPE "StatutEvaluation" RENAME VALUE 'CLOTURE' TO 'CLOTUREE';
-- ALTER TYPE "StatutEvaluation" RENAME VALUE 'OUVERT' TO 'OUVERTE';
-- ALTER TYPE "StatutDeliberation" RENAME VALUE 'VALIDE' TO 'VALIDEE';
-- ALTER TYPE "StatutAttestation" RENAME VALUE 'EMIS' TO 'EMISE';
-- ALTER TYPE "StatutAttestation" RENAME VALUE 'REVOQUE' TO 'REVOQUEE';
-- ALTER TYPE "StatutNotification" RENAME VALUE 'ENVOYE' TO 'ENVOYEE';
-- ALTER TYPE "StatutChambre" RENAME VALUE 'OCCUPE' TO 'OCCUPEE';
-- ALTER TYPE "StatutChambre" RENAME VALUE 'RESERVE' TO 'RESERVEE';
-- ALTER TYPE "StatutAttributionLogement" RENAME VALUE 'ACCORDE' TO 'ACCORDEE';
-- ALTER TYPE "StatutAttributionLogement" RENAME VALUE 'REFUSE' TO 'REFUSEE';
-- ALTER TYPE "StatutAttributionLogement" RENAME VALUE 'RETIRE' TO 'RETIREE';
-- ALTER TYPE "StatutConsommation" RENAME VALUE 'ANNULE' TO 'ANNULEE';
-- ALTER TYPE "StatutConsommation" RENAME VALUE 'VALIDE' TO 'VALIDEE';
-- ALTER TYPE "StatutReservationSalle" RENAME VALUE 'ANNULE' TO 'ANNULEE';
-- ALTER TYPE "StatutReservationSalle" RENAME VALUE 'CONFIRME' TO 'CONFIRMEE';
-- ALTER TYPE "StatutReservationSalle" RENAME VALUE 'REFUSE' TO 'REFUSEE';
-- ALTER TYPE "StatutFormation" RENAME VALUE 'COMPLET' TO 'COMPLETE';
-- ALTER TYPE "StatutFormation" RENAME VALUE 'PUBLIE' TO 'PUBLIEE';
-- ALTER TYPE "StatutInscriptionFormation" RENAME VALUE 'ANNULE' TO 'ANNULEE';
-- ALTER TYPE "StatutInscriptionFormation" RENAME VALUE 'CONFIRME' TO 'CONFIRMEE';
-- ALTER TYPE "StatutReclamation" RENAME VALUE 'FERME' TO 'FERMEE';
-- ALTER TYPE "StatutReclamation" RENAME VALUE 'OUVERT' TO 'OUVERTE';
-- ALTER TYPE "StatutReclamation" RENAME VALUE 'REJETE' TO 'REJETEE';
-- ALTER TYPE "StatutReclamation" RENAME VALUE 'RESOLU' TO 'RESOLUE';
-- ALTER TYPE "StatutDemande" RENAME VALUE 'PAYE' TO 'PAYEE';
-- ALTER TYPE "StatutDemande" RENAME VALUE 'PRET' TO 'PRETE';
-- ALTER TYPE "StatutDemande" RENAME VALUE 'REJETE' TO 'REJETEE';
-- ALTER TYPE "StatutElection" RENAME VALUE 'ANNULE' TO 'ANNULEE';
-- ALTER TYPE "StatutElection" RENAME VALUE 'CLOS' TO 'CLOSE';
-- ALTER TYPE "StatutElection" RENAME VALUE 'OUVERT' TO 'OUVERTE';
-- ALTER TYPE "StatutElection" RENAME VALUE 'PROCLAME' TO 'PROCLAMEE';
