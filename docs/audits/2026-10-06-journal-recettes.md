# Journal des recettes — 6 octobre 2026

> Document figé : c’est l’ancien `SUIVI_RECOMMANDATIONS.md` de la racine, conservé
> pour le détail des preuves. Le backlog vivant (état par module, travaux
> restants, décisions en attente) est [docs/suivi.md](../suivi.md). Les captures
> PNG citées ne sont plus versionnées et les fichiers `.log` cités ne l’ont jamais
> été : voir [l’index des audits](README.md) pour l’archive.

Liste de travail courante. Les détails antérieurs sont conservés dans
[l’archive](2026-10-03-suivi-recommandations.md). Les preuves du
cycle actuel se trouvent dans preuves/2026-10-06(preuves/2026-10-06/).

| Travail | État et preuve |
| --- | --- |
| Paiement documentaire | Corrigé et testé en navigateur/API QA : numéro exigé, aucune simulation envoyée, paiement persisté EN_ATTENTE et document non traité avant confirmation ([preuve](preuves/2026-10-06/paiement-document.json)) |
| Injection de la passerelle | Typage explicite corrigé ; API QA réellement démarrée sur 127.0.0.1:15041 ; aucune API publique rechargée |
| Services activables | ADMIN seul ; essentiels protégés, faux booléens/doublons refusés, API publiques et privées bloquées puis réactivées ([preuve HTTP](preuves/2026-10-06/services-api.json), [interface française](preuves/2026-10-06/services-interface.json)) |
| Menu et accueils | Accueil général et synthèse distincts ; dossiers, résultats et documents regroupés ; navigation sept rôles et clavier vérifiés ([navigation](preuves/2026-10-06/navigation.json), [clavier](preuves/2026-10-06/clavier.json)) |
| Documents étudiants | Demandes, attestations, cartes, badges et tarifs réunis dans un parcours avec liens filtrés selon rôle et activation |
| Finances | Parcours transactions/recettes/paie ajouté ; registres distincts conservés ; validation comptable humaine attendue |
| Composants et mobile | Quinze en-têtes harmonisés, boutons français adaptés au téléphone, journal consulté dans son écran dédié ; [16 parcours à 375 px](preuves/2026-10-06/parcours-mobile-fr.json) sans débordement ni erreur API |
| Justificatifs | Pièce renvoyée au chef lors du dépôt et rejet après validation avec contrôle resté EXCUSE reproduits puis corrigés. Périmètre du cours testé entre deux départements et enseignants croisés, chef sans rattachement et tiers refusés, rôles de dépôt/traitement contrôlés. Une décision finale sur quatre requêtes concurrentes, preuve conservée et clôture d’année respectée. 21 tests ciblés passent ([avant](preuves/2026-10-06/justificatifs-regression.json), [HTTP](preuves/2026-10-06/justificatifs.json)). |
| Chargements par rôle | Compteur justificatifs réservé aux rôles autorisés ; planning étudiant alimenté par ses créneaux sans liste administrative des promotions |
| Stages et soutenances | Champ `rapportRendu` ajouté au contrat de modification avec booléen strict ; refus HTTP initial reproduit, puis proposition, encadrant, validation, dépôt, soutenance unique, note du jury et fiche propriétaire exécutés en QA ([preuve](preuves/2026-10-06/modules-pilotes.json)) |
| Helpdesk et bibliothèque | Déclaration enseignant, prise en charge, résolution, refus tiers et équipement désactivé ; dépôt privé, publication, téléchargement et compteur, retrait/suppression ; journal réel vérifié sans texte des dossiers ([preuve](preuves/2026-10-06/modules-pilotes.json)) |
| Patrimoine et réparations | Double création concurrente reproduite puis corrigée par verrou de ligne transactionnel ; une création sur deux acceptée, une résolution sur deux acceptée, historique conservé et QR régénéré ; prestataire libre exclu du journal ; 14 tests ciblés et cycle HTTP passent ([avant](preuves/2026-10-06/patrimoine-regression.log), [après](preuves/2026-10-06/modules-pilotes.json)) |
| Courrier administratif | Fuite entre chefs de départements reproduite (HTTP 200) puis corrigée : destinataire départemental explicite, création du chef dans son département, tiers et chef sans rattachement refusés sur liste/total/détail/impression/paraphe. Réacheminement avant paraphe et concurrence qualifiés ; après signature, routage figé. Formulaire ADMIN/chef testé à 375 px ([avant](preuves/2026-10-06/courrier-departements-regression.json), [après](preuves/2026-10-06/courrier-departements.json)). Ordre du circuit imposé, écritures parent verrouillées, statut par PUT refusé et archive figée ; dates facultatives omises côté navigateur et courriers sans date métier filtrés sur leur date de création (journée finale entière). 23 tests ciblés, cycle HTTP jusqu’à ARCHIVE et création/paraphe en navigateur à 375 px passent ([HTTP](preuves/2026-10-06/modules-pilotes.json), [interface](preuves/2026-10-06/courrier-interface.json)) |
| Logements | Double attribution reproduite puis corrigée ; une chambre active par étudiant/année, refus de maintenance à la décision, état occupé protégé et retrait libérant la chambre. Deux décisions concurrentes donnent 200/409 ; dix tests ciblés passent ([avant](preuves/2026-10-06/logements-regression.log), [après](preuves/2026-10-06/modules-pilotes.json)) |
| Restaurant | Débits et remboursements concurrents, recharge portail en attente et crédit unique après confirmation caisse vérifiés. Solde erroné de la réponse en attente corrigé et simulation protégée par un booléen strict ([solde avant](preuves/2026-10-06/restaurant-regression.log), [booléen avant](preuves/2026-10-06/restaurant-boolean-regression.log), [après](preuves/2026-10-06/restaurant.json)). Qualification opérateur encore attendue |
| VOD | Affectation privée par ADMIN depuis le formulaire à 375 px : clic et identifiant persisté, libellé à la réouverture, retrait/rétablissement de l’accès, tiers refusé et libellés FR/EN ([preuve](preuves/2026-10-06/vod-affectation-interface.json)). Le chargement du sélecteur attend la réponse filtrée et ne relance plus une requête sans filtre au focus. Double publication/archivage, archive modifiable et faux booléens reproduits puis corrigés. Verrou de la ressource et contrôles renouvelés dans la transaction ; progression, compteurs, accès privés et journal vérifiés sur API/base QA. 41 tests ciblés passent. À 375 px : création privée, modification/publication, archivage et actions filtrées par auteur/état exécutés sans erreur navigateur ([avant](preuves/2026-10-06/vod-regression.json), [HTTP](preuves/2026-10-06/vod.json), [interface](preuves/2026-10-06/vod-interface.json)) |
| Formation continue | Doubles publication/clôture corrigées et nom retiré du journal du dépôt public. Capacité d’une place, paiement confirmé une seule fois, annulation, gel du tarif et de la formation close, recette encaissée et impression protégée vérifiés. Le document imprime le montant payé et confirme l’inscription ; validation pédagogique encore ouverte. 17 tests ciblés passent ([avant](preuves/2026-10-06/formations-regression.json), [après](preuves/2026-10-06/formations.json)) |
| Examens et tirage | Cycle d’examen, surveillant, scans/rejets, doublon et clôture vérifiés en HTTP. Contournement de l’empreinte, double impression et SHA-256 mal formé reproduits puis corrigés ; étapes, bordereau et rôles vérifiés. Le navigateur omettait le stade : envoi corrigé et quatre transitions persistées à 375 px sans erreur. 23 tests ciblés passent ([HTTP avant](preuves/2026-10-06/examens-tirage-regression.json), [HTTP après](preuves/2026-10-06/examens-tirage.json), [interface avant](preuves/2026-10-06/tirage-interface-regression.log), [interface après](preuves/2026-10-06/tirage-interface.json)) |
| Rectorat/MESRS | Effectifs et promotions rapprochés ; bilan à 34 conservé après retour de l’effectif courant à 33. Droits ADMIN de génération, ADMIN/DIRECTION de lecture/impression et trace vérifiés. Définitions métier et transmission encore attendues ([preuve](preuves/2026-10-06/rectorat.json)) |
| Accessibilité | Contraste des nouveaux sous-titres corrigé ; [rejeu automatique](preuves/2026-10-06/accessibilite-validee.json) ; lecteur d’écran et résultats ambigus restent à revoir humainement |
| Résidus de démonstration | Médias absents du build de production et du précache SW ; QA explicite avec `INCLUDE_DEMO_MEDIA=true` ; cinq anciens fichiers temporaires archivés dans `/tmp/university-cleanup-20261006` |
| Documentation | README corrigé : base, droits enseignant, 65 modèles, trois moyens d’attestation ; recommandations/suivi historiques archivés avec liens adaptés |
| Sauvegarde locale et restauration | Sauvegarde du 6 octobre lisible ; 65 tables métier restaurées et vingt migrations appliquées lors de la restauration initiale ; le nouveau rattachement du courrier porte QA et copie restaurée à vingt et une migrations ([contrôle](preuves/2026-10-06/courrier-migration-qa-restauration.json)) ([preuve](preuves/2026-10-06/restauration-migrations.json)) |
| Copie hors serveur | Destination SSH encore requise ; le script refuse une destination locale ou mal formée et propage les échecs de copie |
| Comptes réels | Dix comptes seed actifs, aucun administrateur hors démonstration ; identité ADMIN requise avant rotation ([préconditions](preuves/2026-10-06/preflight.json)) |
| Migrations/publication | Neuf migrations encore en attente en exploitation ; inspection reproductible via `scripts/preflight-deploiement.cjs`, sans écriture |
| SMS/OTP et notifications | Contrats testés ; environnement et destinataires QA à fournir ; aucune livraison réelle annoncée |
| Mobile Money réel | Contrats testés ; passerelle de recette et rapprochement opérateur à qualifier ; aucun encaissement réel effectué |
| Biométrie et conservation | Chiffrement, consentement et purge atomique existants ; lecteur réel et politique RH de conservation à valider |
| Présences hors ligne, PDF signé, couverture, imports, paie | Implémentations conservées ; recettes sur appareil/fichiers métier et retours contrôleur/scolarité/comptabilité attendus ([maturité](../suivi.md)) |
| Clôture et correction | Décision demandée ; règles existantes conservées, [mutations indirectes](preuves/2026-10-03/matrice-mutations-annee-2026-10-03.json) à aligner selon lecture seule ou correction exceptionnelle |
| Multi-établissement | Architecture demandée : base partagée cloisonnée ou base isolée par université ; [cadrage](preuves/2026-10-03/architecture-multi-etablissement.md) |
| Prolongation des cartes | Parcours existant SCOLARITE qualifié à 375 px : carte expirée refusée puis prolongée, QR/NIP/identité/date d’émission conservés et réutilisables, impression propriétaire et refus tiers, réouverture avec la nouvelle date. Dialogue adapté au mobile (327 px), modification d’une carte révoquée masquée. Révocation/prolongation concurrentes 201/400 sans réactivation. Remplacement avec nouveau QR/historique à décider, scan et impression physiques encore attendus ([preuve](preuves/2026-10-06/carte-prolongation.json)). |
| Concurrence du jury | Recalcul et validation verrouillent la délibération après la garde annuelle, puis relisent le statut ; une validation intervenue avant la prise du verrou bloque toute écriture et trace supplémentaire. Deux nouveaux tests de concurrence et cinq tests de clôture passent, build backend réussi ([preuve ciblée](preuves/2026-10-06/jury-concurrence.json)). Suite complète : 919 tests/108 suites passent avec un délai par test de 60 s ; le délai initial de hachage de compte est conservé dans le journal. Cycle HTTP du rattrapage désormais qualifié : normale validée, deux AJOURNE repris, ADMIS/DEFAILLANT exclus ; pondérations 1/3 et 3/1, moyennes 14,75/8,69, rangs 1/2 et taux 50 %. Validation/recalcul concurrents 201/400, bulletins et périmètre du chef vérifiés ([preuve](preuves/2026-10-06/rattrapage.json)). Impression physique et validation pédagogique humaine restent attendues. |
| Autres modules pilotes | Cycles HTTP stages, helpdesk, bibliothèque, patrimoine, courrier, logement, restaurant, VOD, formations, examens/tirage, rectorat, documents d’identité et régie vérifiés dans les périmètres documentés. Formulaire des attestations, guichet de régie et affectation VOD privée vérifiés à 375 px. Remplacement des cartes par un nouveau QR/historique et autres parcours multi-département restent à définir ou qualifier ; justificatifs vérifiés sur deux départements QA ; validation humaine/pédagogique/comptable encore attendus ; cloisonnement du courrier vérifié sur deux départements QA |

La recette [validité des documents d’identité](preuves/2026-10-06/validite-identite.json)
vérifie par HTTP le NIP correct/incorrect, le refus après expiration, le journal
d’échec QR et les impressions administrative/propriétaire protégées, avec refus
d’un autre étudiant. Les trois registres acceptent une seule révocation/annulation
sur quatre demandes simultanées et conservent un seul audit. Les modifications
après révocation/annulation sont refusées ; le badge expiré peut être prolongé.
La réponse publique d’une attestation révoquée ne divulgue plus le motif confidentiel.
Le [constat avant correction](preuves/2026-10-06/identite-concurrence-regression.json)
conserve les décisions/audits multiples observés. La recette
[rattachement des attestations](preuves/2026-10-06/rattachement-attestations.json)
refuse les inscriptions absentes ou incohérentes avec étudiant/année/promotion,
dérive année/promotion et empêche les doublons à l’émission ou au changement de
type, y compris avec deux modifications simultanées. Réémettre après révocation
réussit ; l’ancien QR reste invalide. Le
[constat initial](preuves/2026-10-06/rattachement-attestations-regression.json)
conserve les incohérences et le doublon observés. La
[recette du formulaire à 375 px](preuves/2026-10-06/attestation-formulaire.json)
vérifie les changements d’étudiant, d’année et de promotion, l’effacement des choix
incompatibles, l’année déduite d’une promotion et le rejet d’une réponse ancienne
livrée après la réponse actuelle. L’émission est rapprochée du dernier parcours en
base. Le service worker est bloqué dans cette recette pour intercepter le réseau.
La prolongation d’une carte expirée est désormais qualifiée dans le parcours existant ; le mode de remplacement par nouvelle carte/QR et la validation physique restent ouverts.

La [recette HTTP de régie](preuves/2026-10-06/regie.json) vérifie
l’encaissement concurrent unique, l’absence de paiement orphelin, le gel
comptable, les filtres, les droits des quatre rôles et les totaux de recettes
émises en GNF par année civile. Le [guichet à 375 px](preuves/2026-10-06/regie-interface.json)
émet puis encaisse une recette et vérifie le paiement en base. Date, montant et
devise restent lisibles sur téléphone. Les 17 tests ciblés passent ; les données
fictives sont retirées. Le mouvement de caisse réel et la validation comptable
restent attendus. Les sessions de cette recette sont issues du service
AuthService.login avec mots de passe QA vérifiés puis contrôlées sur /auth/me ;
elle ne qualifie pas la limitation du point d’entrée POST /auth/login.
Le [rejeu FR/EN des attestations](preuves/2026-10-06/attestation-formulaire-langues.json)
passe avec une session QA réutilisée, sans écriture et sans erreur JS/API.

La dernière suite backend complète passe **919 tests dans 108 suites**, après
les corrections du logement, du restaurant, de la VOD, des formations, du tirage
et de la validité/confidentialité et des transitions concurrentes des documents d’identité.
Elle inclut les 14 tests patrimoine, 23 tests courrier, dix tests logement,
vingt tests restaurant, 41 tests VOD, 17 tests formations, 23 tests examens/tirage
et 44 tests attestations/cartes/badges, dont 18 tests de service/DTO des attestations, ainsi que 21 tests des justificatifs.
Les builds
backend, frontend QA et candidat production et le contrôle
TypeScript réussissent. La recette HTTP et le navigateur valident les changements.
Les tests ciblés
passent aussi avec la conversion implicite de DTO utilisée par l’API. Les builds
PWA isolés de QA et de production réussissent. Le rejeu des **252 configurations**
avec API/base réelles passe sans erreur ni débordement dans `ecrans-valides/`.
Les quatre erreurs initiales sont conservées dans `ecrans/`. Les 19 configurations
du rejeu d’accessibilité ne présentent aucune violation automatique ; les cas
ambigus ne valent pas une certification WCAG. La connexion et les parcours de
quatre rôles passent ; le chiffrement avant persistance, le décryptage après
rechargement, la suppression après synchronisation et la migration des anciennes
files sont vérifiés en navigateur.
Le cycle HTTP stages/helpdesk/bibliothèque passe sur la base QA réelle après
correction du contrat de dépôt ; 32 tests stages passent également. Le
[refus avant correction](preuves/2026-10-06/stages-regression.log)
et la [recette après correction](preuves/2026-10-06/modules-pilotes.json)
permettent de reproduire le constat.

La [synthèse des validations](preuves/2026-10-06/validation.json)
et les journaux [connexion](preuves/2026-10-06/smoke.log),
[chiffrement](preuves/2026-10-06/chiffrement.log) et
[PWA](preuves/2026-10-06/pwa.log) sont conservés. Le test PWA
isole le catalogue de services : il prouve le manifeste, le service worker et
le démarrage de la coque sans réseau, pas une tournée complète hors ligne.

Informations nécessaires pour terminer : destination SSH de sauvegarde, identité
de l’administrateur réel, environnements opérateurs et lecteur biométrique,
politique de correction après clôture et architecture multi-établissement.

**L’objectif « toutes les tâches et recommandations » reste ouvert.** Les tests
locaux ne valent ni publication, ni validation opérateur, ni recette terrain.

### Élections : concurrence et cycle HTTP qualifiés en QA

Les mutations de scrutin, les candidatures et le vote partagent désormais un verrou de ligne. Le dépôt relit le statut, les dates et les candidats dans sa transaction ; la modification contrôle les dates fusionnées. Les 35 tests ciblés et les 927 tests backend (109 suites) passent, compilation réussie. L’API QA rechargée confirme une seule ouverture, clôture et proclamation parmi quatre demandes, un seul bulletin parmi quatre dépôts, le refus d’un vote après clôture, deux voix persistées et les journaux minimaux ; les fixtures sont supprimées ([HTTP](preuves/2026-10-06/elections.json), [concurrence](preuves/2026-10-06/elections-concurrence.json)). La règle actuelle autorisant tout utilisateur connecté à voter est conservée. Validation humaine des règles électorales et impression physique encore attendues.

### Helpdesk : concurrence qualifiée en QA

Une prise en charge ne peut plus remplacer une résolution intervenue entre la lecture initiale et la transaction : verrou TicketSupport et contrôle du statut relu avant écriture. Les 30 tests ciblés et la compilation passent. L’API QA rechargée confirme une seule résolution parmi quatre requêtes (201/400/400/400), un état final RESOLU après résolution/prise en charge simultanées, une seule trace de résolution par ticket et aucun texte privé dans le journal. Refus tiers et rôle enseignant vérifiés, fixtures supprimées ([HTTP](preuves/2026-10-06/helpdesk-concurrence-http.json), [tests](preuves/2026-10-06/helpdesk-concurrence.json)). La suite complète de 927 tests précédente couvre les élections ; la modification helpdesk est vérifiée par ces contrôles ciblés. Validation DSI et étiquettes physiques encore attendues.

### Planning : génération et synchronisation HTTP qualifiées en QA

Création par scolarité, refus étudiant/enseignant, collision et heures inversées refusées. Un créneau du 12 au 26 octobre avec le 19 exclu génère seulement les 12 et 26 ; le rejeu ne crée rien et ne produit pas une seconde trace. Registre étudiant interdit et enseignant tiers sans lecture. Modification et annulation persistées. Une séance hors ligne est créée avec son UUID puis rejouée sans doublon ni seconde trace ; un contenu divergent est refusé sans altérer la séance. Créneau, génération, modification et suppression bloqués après clôture d’année. Journal sans motif ni thématique, fixtures supprimées ([preuve](preuves/2026-10-06/planning-http.json)). Pas de modification fonctionnelle ni recompilation nécessaire. Formulaires, pointages hors ligne, appareil réel et validation métier encore à qualifier.

### Salles : affiches QR qualifiées par HTTP en QA

Lecture enseignant/étudiant/direction sans QR ni GPS ; impression et rotation interdites à ces rôles. Affiche SVG accessible à scolarité/ADMIN, rotation persistée et nouvelle affiche sans ancien jeton, salle inactive exclue. Les trois impressions autorisées sont journalisées sans jeton. Salle et traces fictives supprimées. Scan et impression physiques restent à qualifier ([preuve](preuves/2026-10-06/salles-qr-http.json)). Recette reproductible : `bun run test:qa:salles-qr` depuis backend avec les variables QA habituelles.

### Imports CSV : booléens corrigés et recette HTTP qualifiée

La recette HTTP a reproduit un enseignant `actif=non` enregistré actif. La conversion implicite précédait le traitement booléen CSV ; elle est désactivée au profit des conversions explicites des DTO. Les 24 tests ciblés passent, dont quatre valeurs négatives et une valeur inconnue refusée. Compilation réussie et rejeu HTTP valide sur enseignants, matières et salles : aperçu sans écriture, deux créations et un doublon refusé par type, rejeu sans création, booléen « non » persisté false et traces minimales ; toutes les fixtures supprimées ([HTTP](preuves/2026-10-06/imports-http.json)). Fichiers historiques et parcours XLSX navigateur restent à qualifier ([preuve](preuves/2026-10-06/imports-booleens-regression.json)). Fixtures de reproduction supprimées.

### Imports créneaux : recette HTTP qualifiée

Aperçu sans écriture, conversion de lundi/8h00/dates françaises, deux créations et référence inconnue rejetée, rejeu sans doublon, collision refusée et aucune création après clôture d’année. Une trace par création et rôle étudiant refusé. Référentiels, créneaux et traces QA supprimés ([preuve](preuves/2026-10-06/imports-creneaux-http.json)). Recette reproductible : `bun run test:qa:imports-creneaux`. Fichiers historiques et parcours XLSX navigateur restent à qualifier.

### Import XLSX : formulaire mobile qualifié

Sur la PWA QA à 375 px, SCOLARITE choisit Salles et un fichier XLSX, prévisualise sans écriture puis confirme l’import. Unicode transmis au CSV, salle persistée avec capacité 20 et `actif=false`, une trace et aucune erreur JavaScript ; fixture supprimée. Pas de modification frontend fonctionnelle ni nouveau build nécessaire ([preuve](preuves/2026-10-06/imports-xlsx-interface.json)). Fichiers historiques de l’établissement encore attendus.

### Relevé PDF hebdomadaire : sécurité et intégrité HTTP qualifiées

Deux chefs de départements fictifs, sessions AuthService contrôlées sur /auth/me. Chef tiers, ADMIN, SCOLARITE et ETUDIANT refusés ; semaine invalide et signature malformée refusées. Deux PDF sans séances générés par le chef propre : entête PDF, type MIME, numéros différents et SHA-256 identique entre octets/header/journal. Empreinte de signature concordante, une trace par document sans image base64. Fixtures supprimées ([preuve](preuves/2026-10-06/releve-pdf-http.json)). Contenu d’un relevé avec présences, rendu physique et validation humaine restent à qualifier.

### Relevé PDF : contenu avec présences qualifié

La recette enrichie ajoute deux séances du département propre, dont une présence de 120 minutes avec signature, et une séance d’un autre département. Extraction réelle des deux PDF par pdftotext : enseignant propre présent, enseignant tiers absent, synthèse à deux séances/une contrôlée/deux heures. Les contrôles de rôles, signature, unicité et hashes restent réussis ; référentiels, présences et sessions fictifs supprimés ([preuve actualisée](preuves/2026-10-06/releve-pdf-http.json)). Lecture visuelle humaine et impression physique restent attendues.

### Séances hors ligne : synchronisation sur API QA qualifiée

PWA compilée et Service Worker, compte CONTROLEUR fictif rattaché à son département, authentifié par AuthService puis vérifié sur /auth/me. Référentiels QA injectés au cache du store : coupure réseau, création UUID, rechargement hors ligne et restauration de la file ; reconnexion vers API QA avec une seule requête, file vidée, une séance persistée attribuée au contrôleur et une trace. Second appel sans rejeu. Aucun serveur API simulé ni erreur JavaScript ; fixtures supprimées ([preuve](preuves/2026-10-06/seances-hors-ligne-qa.json)). Le bouton de préparation, le formulaire et la file de pointages ne sont pas qualifiés par cette manipulation du store ; appareil terrain encore attendu.

### Préparation hors ligne : accès contrôleur en correction

Le bouton de préparation restait uniquement dans DashboardPage, désormais accessible par synthese-presences aux rôles ADMIN/DIRECTION/CHEF. Un bouton est ajouté à ControlePage pour restaurer le parcours du contrôleur, avec lectures réseau vérifiées et cache lié au compte. Build QA et candidat production réussis, API embarquées correctes et médias de démonstration absents. Recette navigateur du bouton sur la tournée valide : lectures QA, caches persistants et synchronisation réelle ([preuve](preuves/2026-10-06/preparation-hors-ligne-qa.json)). TypeScript réussi ; formulaire et pointages restent à qualifier ([preuve provisoire](preuves/2026-10-06/preparation-hors-ligne-regression.json)).

### Formulaire de séance hors ligne : recette réelle qualifiée

Sur PWA QA à 375 px, compte contrôleur propre : bouton de préparation puis réseau coupé, ouverture par le bouton flottant de la tournée, sélection de la charge d’enseignement dans le cache, saisie 18:00–19:00 et enregistrement. UUID en file et séance visible, rechargement hors ligne conservé ; reconnexion avec une seule requête réelle, une séance attribuée au contrôleur et une trace. Second appel sans rejeu, aucune erreur JavaScript, fixtures supprimées ([preuve](preuves/2026-10-06/seance-formulaire-hors-ligne-qa.json)). TypeScript et les deux builds passent. La saisie et synchronisation d’un pointage ainsi que l’appareil terrain restent à qualifier.

### Pointages hors ligne : premier cycle sur API QA réelle

Séance créée par formulaire hors ligne, puis pointage ABSENT injecté dans le store de file : observation chiffrée et PIN retiré avant stockage, séance et pointage conservés après rechargement hors ligne. Reconnexion vers API QA : séance créée avant le contrôle, une séance attribuée au contrôleur et un seul contrôle ABSENT/horsLigne persisté avec son observation. Journal sans observation libre et fixtures supprimées ([preuve](preuves/2026-10-06/pointages-hors-ligne-qa.json)). Ce contrôle qualifie la file et l’intégration d’une absence ; formulaire de pointage, présence/signature, échecs partiels et appareil terrain restent à qualifier.

### Pointages hors ligne : présence signée et échec partiel qualifiés

Deux pointages dans le store chiffré après création de séance par formulaire : présence signée de 60 minutes avec effectif 12 et référence inexistante. Après rechargement/reconnexion, présence persistée une seule fois avec attestation SIGNATURE valide ; référence inconnue sans contrôle, conservée en file avec son erreur. Retrait explicite de la fixture invalide puis synchronisation sans doublon. PIN retiré, observation chiffrée et absente du journal ; fixtures supprimées ([preuve](preuves/2026-10-06/pointages-partiels-hors-ligne-qa.json)). Le pointage est encore injecté au store : formulaire/canvas utilisateur et appareil terrain restent à qualifier.

### Tournée hors ligne : parcours formulaire complet qualifié en QA

À 375 px, contrôleur QA authentifié : préparation réseau, coupure, séance créée via sélection/horaires puis formulaire de pointage. Arrivée 18:00, fin 19:00, effectif 12, observation et signature tracée par souris sur canvas ; validation bloquée avant signature puis autorisée. File chiffrée, rechargement hors ligne et reconnexion : séance unique suivie d’un contrôle PRESENT/SIGNATURE valide de 60 minutes, observation conservée et absente du journal. Aucun serveur simulé ni erreur JavaScript ; fixtures supprimées ([preuve](preuves/2026-10-06/pointage-formulaire-hors-ligne-qa.json)). Appareil, caméra/GPS et attestation par une personne réelle restent à qualifier.

### Tournées et couverture : indicateurs HTTP qualifiés

Cinq séances fictives, deux contrôleurs : quatre affectations individuelles (trois passées, une future), deux visites dont une par collègue, puis aperçu et affectation groupée de la dernière séance. API QA : couverture 66,67 %, réalisation par assigné 33,33 %, une séance passée non visitée et une non affectée correctement séparées. Rôle non contrôleur rejeté pour affectation, lectures étudiant/enseignant refusées ; fixtures supprimées ([preuve](preuves/2026-10-06/tournees-couverture-http.json)). Équipes et tournées réelles restent à renseigner/valider.

### Journal : événements réels et interface avant/après qualifiés

Trois événements Salle produits par les API QA (création, capacité modifiée 20→25, rotation QR). ADMIN et DIRECTION, FR/EN, 375/1440 px : filtre Action transmis au backend réel, événement retrouvé, détail avant/après avec capacité correcte et identifiant, sans nom libre, QR ni coordonnées ; aucun débordement du document ni erreur JavaScript dans huit configurations. API journal interdite aux rôles SCOLARITE/ETUDIANT/ENSEIGNANT. Fixture et traces supprimées ([preuve](preuves/2026-10-06/journal-reel-interface.json)). Ce contrôle ne prouve pas encore le rendu des événements de chacun des autres modules.

### Audit de complétude des recommandations initiales

Les treize exigences initiales ont un état courant et leurs preuves/dépendances dans [la matrice de complétude](preuves/2026-10-06/audit-completion-recommandations.json). L’objectif global reste ouvert : sauvegarde distante, comptes réels, publication alignée, fournisseurs/matériel, fichiers historiques, recette humaine, multi-établissement et règles de correction ne sont pas prouvés achevés. Les dernières corrections backend sont en vérification par la suite complète ; les preuves QA ne valent pas validation de production.

### Vérification globale et candidat de publication

Suite backend complète actuelle : **933 tests réussis dans 109 suites**, incluant élections, helpdesk et imports booléens ([log](preuves/2026-10-06/backend-tests-current.log)). Inventaire SHA-256 des 263 fichiers PWA candidats, 426 fichiers backend compilés et 21 migrations, avec API publique correcte, API QA absente et aucun média de démonstration ([inventaire](preuves/2026-10-06/candidat-publication.json)). Préflight production réexécuté en lecture seule : dix comptes de démonstration, aucun ADMIN hors seed, neuf migrations en attente et aucune cible SSH ([preuve](preuves/2026-10-06/preflight-deploiement.json)). Aucune publication ou mutation de production.

### Journal : réclamation anonyme réelle qualifiée

Création étudiante réelle sur API QA : événement RECLAMATION_OUVERTE sans userId, sujet/description/nom/email absents des détails. Dans huit configurations ADMIN/DIRECTION FR/EN 375/1440 px, filtre réel, détail avant/après et état OUVERTE visibles ; aucun contenu privé, erreur JavaScript ou débordement du document. Accès API SCOLARITE/ETUDIANT/ENSEIGNANT refusé, fixture et trace supprimées ([preuve](preuves/2026-10-06/journal-reclamation-interface.json)). Le rendu des autres familles d’événements reste à qualifier.

### Journal : votes historiques masqués par API et interface

Une trace historique synthétique VOTE_DEPOSE insérée uniquement en QA est masquée pour ADMIN et DIRECTION : filtre par action ou entité renvoie zéro ligne et total zéro. Huit configurations FR/EN 375/1440 px confirment absence de détail et de choix privé, sans erreur JavaScript ni débordement. Accès tiers refusé, trace supprimée ([preuve](preuves/2026-10-06/journal-votes-historiques-interface.json)). Aucun vote réel créé ni compte de votant extérieur modifié.

### Journal campus : VOD et courrier réels qualifiés

Deux créations réelles sur API QA : VOD privée et courrier entrant avec titre/description/objet/notes confidentiels. Une trace par création, avant null et après identifié, aucun texte libre. Seize configurations (deux actions, ADMIN/DIRECTION, FR/EN, 375/1440 px) vérifient filtre réel, détail et absence de contenu privé, sans erreur JavaScript ni débordement du document. Fixtures VOD/courrier/circuit et traces supprimées ([preuve](preuves/2026-10-06/journal-campus-interface.json)). Les autres familles restent à qualifier.

### Journal services : helpdesk et élections réels qualifiés

Ticket enseignant et élection créés sur l’API QA : une trace par création, avant null et après identifié, description du ticket et titre de l’élection absents. Seize configurations ADMIN/DIRECTION, FR/EN, 375/1440 px vérifient filtre réel et détail avant/après sans contenu privé, erreur JavaScript ou débordement du document. Accès journal des tiers refusé ; ticket, équipement, élection et traces supprimés ([preuve](preuves/2026-10-06/journal-services-interface.json)). Aucun vote créé. Les autres familles et la validation humaine restent à qualifier.

### Journal gestion : réservations, réparations patrimoine et formations

Trois événements produits par l’API QA et vérifiés dans 24 configurations ADMIN/DIRECTION, FR/EN, 375/1440 px : réservation, déclaration de réparation et création de formation. Motif/organisme/responsable de réservation, description/prestataire de réparation et titre/description de formation restent absents des instantanés et détails affichés. Les libellés d’inventaire sont conservés comme prévu par la projection patrimoine. Accès journal tiers refusé, aucune erreur JavaScript ni débordement du document ; fixtures et traces supprimées ([preuve](preuves/2026-10-06/journal-gestion-interface.json)). Un mauvais nom de modèle dans le nettoyage de recette a été corrigé et ses fixtures supprimées avant la passe réussie. La [couverture cumulée](preuves/2026-10-06/journal-couverture-interface.json) recense 72 configurations sur événements réels ; ce total ne prouve pas encore toutes les familles ni la validation humaine.

### Journal : stages, dépôt documentaire et téléchargement authentifié

Travail encadré et document privé créés par API QA, puis téléchargement authentifié par le déposant : octets identiques au contenu fictif, compteur unitaire et une trace de téléchargement sans détails. États de création réduits, sans intitulé/description/entreprise/tuteur du stage ni titre/fichier du document. Vingt-quatre configurations ADMIN/DIRECTION FR/EN bureau/mobile vérifient filtre réel et affichage, sans contenu privé, erreur JavaScript ni débordement du document ; accès journal tiers refusé. Le téléchargement expose son événement sans inventer d’états avant/après. Fixtures et traces supprimées ([preuve](preuves/2026-10-06/journal-documents-stages-interface.json)). Couverture cumulée : 96 configurations sur événements réels ; autres familles et validation humaine restent ouvertes.

### Journal plagiat : détection automatique et arbitrage réels

Deux dépôts privés identiques sur API QA déclenchent automatiquement une suspicion à 100 %, EN_ATTENTE. Confirmation ADMIN avec commentaire fictif privé persistée ; événements PLAGIAT_SUSPICION_OUVERTE et PLAGIAT_CONFIRME vérifiés dans seize configurations ADMIN/DIRECTION FR/EN bureau/mobile. États avant/après cohérents, commentaire/titres/auteurs/contenu absents du journal et de son détail. Accès journal tiers refusé, aucune erreur JavaScript ni débordement du document ; dépôts, suspicion et traces supprimés ([preuve](preuves/2026-10-06/journal-plagiat-interface.json)). Aucun recalcul global des dépôts existants. Couverture cumulée : 112 configurations sur événements réels ; SMS fournisseur, autres mutations et validation humaine restent ouverts. La matrice de complétude référence les dates actuelles des preuves inspectées sans déclarer les critères externes achevés.

### Accessibilité : journal réel au clavier, douze configurations

Filtrage et ouverture du détail par Entrée sur API QA réelle ; Tab et Maj+Tab maintiennent le focus dans la fenêtre, Échap ferme puis restitue le focus au déclencheur. ADMIN/DIRECTION, FR/EN, 320/375/1440 px : douze configurations réussies avec événement Salle avant/après, contenu privé masqué, aucun débordement du document ni erreur JavaScript. Fixtures et traces supprimées ([preuve](preuves/2026-10-06/journal-clavier-reel-interface.json)). Le code applicatif n’a pas changé. Cette preuve au clavier complète les précédentes et ne remplace pas les essais humains avec lecteur d’écran.

### Intégrité des recettes du journal

Vérificateur rejouable `backend: npm run test:qa:journal-integrite`, avec fichier privé QA requis et base locale imposée. Lecture seule : zéro fixture restante dans les onze modèles recherchés par les préfixes des recettes récentes, sept rapports valides et total cohérent de 112 configurations réelles ([preuve](preuves/2026-10-06/journal-nettoyage-qa.json)). Ce contrôle ne couvre pas toutes les données QA ni tous les événements historiques et ne valide pas la production.

### Complétude : exigences initiales et priorités courantes

La [matrice](preuves/2026-10-06/audit-completion-recommandations.json) couvre désormais les treize exigences initiales et chacune des huit lignes de RECOMMANDATIONS.md, avec critère de fin exact, preuves locales et travail restant. Le cycle de paie du 2 octobre (deux heures, montant au taux, recalcul idempotent, paiement) est référencé explicitement comme historique, sans le présenter comme un rejeu courant ni une validation comptable. Aucun critère externe/humain n’est marqué achevé ; sauvegarde distante, comptes réels, publication alignée, fournisseurs/matériel, recette humaine, correction et multi-établissement restent ouverts.

### Paie : cycle HTTP actuel sur fixtures isolées

Période fictive janvier 2088, vacataire propre au taux de 15 000 : deux présences totalisent 125 minutes ; 120 minutes ABSENT exclues. Règle actuelle observée : deux heures entières, 30 000 net et retenue zéro. Recalcul idempotent, validation avant calcul refusée, recalcul après validation refusé, paiement réservé ADMIN, double paiement et suppression finale refusés. Impression SCOLARITE protégée et étudiant refusé ; cinq événements avant/après sans nom libre, dont un seul paiement. Fixtures et traces supprimées ([preuve](preuves/2026-10-06/paie-http.json)). Il s’agit d’un état de paiement fictif enregistré dans la base QA, sans virement externe. La troncature à l’heure entière et les retenues restent à faire confirmer par la comptabilité avant validation métier ; aucune règle modifiée.
