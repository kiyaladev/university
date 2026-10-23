# Suivi — backlog vivant

Seul document de suivi à tenir à jour. Il fusionne les anciens
`RECOMMANDATIONS.md`, `SUIVI_RECOMMANDATIONS.md` et `MATURITE_MODULES.md`
(23 octobre 2026). Les constats et preuves datés restent consultables, figés,
dans [audits/](audits/README.md) ; le détail des recettes du 6 octobre est dans
le [journal des recettes](audits/2026-10-06-journal-recettes.md).

Vocabulaire :

- **Recette QA** : cycle métier exécuté par HTTP (et parfois en navigateur à
  375 px) sur une API et une base QA isolées, avec refus et états persistés.
- **Pilote** : interface et API présentes ; écritures complètes, intégration
  externe ou validation métier encore à qualifier.
- Aucune ligne ne vaut validation de production, opérateur ou terrain. Les
  tests locaux ne remplacent ni la publication, ni la recette humaine.

Dernière vérification locale (23 octobre 2026, branche `amelioration/lot-2`) :
Jest backend **120 suites, 1 033 tests réussis** ; `tsc --noEmit` et `vue-tsc`
sans erreur.

## Priorités

| Priorité | Travail | Critère de fin |
| --- | --- | --- |
| P0 | Sauvegarde hors serveur | Destination SSH fournie (`UNIPRESENCE_BACKUP_REMOTE`), copie contrôlée et restauration distante exécutée |
| P0 | Comptes réels | Administrateur réel identifié ; les dix comptes de démonstration remplacés ou désactivés, puis refus des mots de passe seed activé |
| P0 | Publication alignée | Migrations en attente appliquées après les préconditions, API et PWA publiées ensemble (lots 1 à 3 compris), parcours rejoués ; `scripts/preflight-deploiement.cjs` sans blocage |
| P1 | Qualification métier | Cycles complets, refus, reprises et impressions vérifiés avec les agents et des données QA |
| P1 | SMS/OTP, Mobile Money, biométrie | Essais avec fournisseurs et matériel de recette, échecs et doublons compris |
| P1 | Terrain et accessibilité | Tournée sur téléphone réel, lecteur d’écran, contrôles manuels |
| P2 | Clôture et correction | Politique de correction après clôture décidée ; [mutations indirectes](../audit/recommandations/matrice-mutations-annee-2026-10-03.json) alignées et testées |
| P2 | Multi-établissement | Architecture choisie (base partagée cloisonnée ou base par université, [cadrage](../audit/recommandations/architecture-multi-etablissement.md)), isolation vérifiée avec deux universités |

## Décisions en attente

| Sujet | Constat | Décision attendue |
| --- | --- | --- |
| Nom « UniPrésence » dans l’application | Reste dans le code (`frontend/src/i18n`, manifeste PWA, pieds de page A4 du backend, clés de stockage local, comptes de seed `@unipresence.gn`), et dans `PRODUCT.md` / `DESIGN.md`. Les clés de stockage ne doivent pas être renommées sans migration (files hors ligne). Le nom affiché de l’**application Android** est, lui, déjà « University » (voir [Décisions prises](#décisions-prises)). | Renommer les libellés visibles en « University » ; décider du sort de `PRODUCT.md` / `DESIGN.md`. |
| Règle d’année des numéros | `common/numero.ts` (`anneeNumero`) : fin du libellé d’année pour matricules, INS-, PAY-, PAY-R- ; début pour ATT- ; année civile pour DOC-, réclamations, tickets, badges, PAY-F- ; année civile UTC de la date de recette pour PAY-X-. | Harmoniser ou non ; tout changement rompt la séquence des numéros déjà émis. |
| Sauvegarde hors serveur | Cron local à 3 h 15 vers `backups/` ; aucune destination distante. | Fournir hôte, compte et clé SSH ; prouver copie et restauration. Sauvegarder aussi `android-cle/` et `BIOMETRIE_CHIFFREMENT_CLE`. |
| Publication des lots 1 à 3 | Branches `amelioration/lot-1`, `lot-2`, `lot-3` non publiées ; la production tourne sur une version antérieure. | Ordre de fusion dans `main`, fenêtre de déploiement, après les P0. |
| Version de bun | Le projet déclare `bun@1.4.2` (`packageManager`, CI) ; le serveur a bun **1.3.10**. Un `bun install` avec 1.3.10 réécrit `bun.lock` en format 1 et aplatit les overrides imbriqués (`paquet@version>dépendance`). Les deux `bun.lock` ont été régénérés en format 3 avec bun 1.4.2 le 23 octobre ; la CI les installe en `--frozen-lockfile`. | Mettre à jour bun sur le serveur avant toute installation, sinon ne pas commiter le `bun.lock` réécrit. |
| Téléchargement de l’APK | La `location /telechargement/` est écrite dans `infra/nginx/university.naimba.com` (type APK, téléchargement, pas d’index de répertoire, placée avant le repli SPA) mais **pas encore déployée** dans `/etc/nginx` : l’adresse renvoie encore l’application. `/opt/apps/university/telechargement/` ne contient encore que `unipresence.apk`, qui porte l’identifiant `gn.unipresence.controle` et remplacerait UniPrésence s’il était installé. | Déployer le vhost (`nginx -t` puis rechargement), reconstruire et publier `university.apk` (`scripts/apk.sh`, qui retire l’ancien fichier), puis vérifier le lien depuis un téléphone. |
| Correction des justificatifs traités | Une décision VALIDE/REJETE est définitive. | Règle d’une correction dédiée. |
| Cartes étudiantes | Prolongation qualifiée ; pas de remplacement. | Remplacement par nouvelle carte et nouveau QR avec historique ? |
| Paie | Troncature à l’heure entière, retenues à zéro. | Confirmation par la comptabilité. |
| Biométrie | Conservation 90 jours après désactivation. | Validation RH. |
| Réinscription en ligne | La préinscription publique refuse un e-mail déjà connu (409) ; l’ancien étudiant passe au guichet. | Parcours de réinscription authentifié dans le portail ? |

## Décisions prises

| Date | Sujet | Décision | Pourquoi |
| --- | --- | --- | --- |
| 23 octobre 2026 | Identifiant de l’application Android | `gn.university.controle` : `appId` Capacitor, `namespace` et `applicationId`, paquet Java `gn.university.controle`, nom affiché « University ». La clé de signature reste celle d’UniPrésence. | Android n’installe jamais deux applications de même `applicationId` : avec `gn.unipresence.controle`, installer University **remplaçait** UniPrésence sur le téléphone du contrôleur. Aucun APK University n’ayant jamais été distribué, changer d’identifiant ne coûte aucune réinstallation. La clé n’était pas en cause : une même clé signe des applications d’identifiants différents. Détail et fichiers : [android.md](android.md#identifiant-de-lapplication). |
| 23 octobre 2026 | Publication de l’APK | `location /telechargement/` dans `infra/nginx/university.naimba.com`, avant le repli SPA ; APK publié sous le nom `university.apk`, `scripts/apk.sh` vérifiant l’identifiant de l’APK produit avant publication. | Le lien de téléchargement renvoyait l’application web. Le nom `unipresence.apk` aurait, lui, installé UniPrésence sous le nom d’University : c’est le fichier, pas seulement le lien, qui devait changer. |

## État par module

| Module | État | Reste à faire |
| --- | --- | --- |
| Présences et tournée | Recette QA en navigateur : préparation, séance et pointage signé hors ligne, file chiffrée, reconnexion sans doublon, échec partiel conservé en file ([preuve](../audit/recommandations-2026-10-06/pointage-formulaire-hors-ligne-qa.json)) | Appareil terrain, caméra/GPS, attestation par une personne réelle ; anti-rejeu hors ligne d’une empreinte seule |
| Planning, séances, référentiels | Recette QA HTTP : génération idempotente, jours exclus, collisions, synchronisation UUID, refus après clôture ([preuve](../audit/recommandations-2026-10-06/planning-http.json)) | Formulaires navigateur, validation par les agents |
| Clôture des années | Verrouillage transactionnel des mutations rattachées | Revue des autres modules ; règle de correction ou réouverture |
| Imports des référentiels | CSV et XLSX ; enseignants, matières, salles, créneaux qualifiés par HTTP ; parcours XLSX Salles à 375 px ([preuve](../audit/recommandations-2026-10-06/imports-http.json)) | Fichiers historiques de l’établissement |
| Rapports de présence | Relevé PDF hebdomadaire numéroté, SHA-256 au journal, contenu vérifié par extraction ([preuve](../audit/recommandations-2026-10-06/releve-pdf-http.json)) | Lecture humaine, rendu physique |
| Contrôle des tournées | Affectation des séances, couverture et réalisation distinguées ([preuve](../audit/recommandations-2026-10-06/tournees-couverture-http.json)) | Équipes et tournées réelles |
| Inscriptions au guichet | Recette QA | Préinscription publique avec OTP réel |
| Paiement et Mobile Money | Pilote : confirmation manuelle vérifiée, simulation étudiante désactivée en production | Transaction opérateur, callback, rapprochement |
| Documents demandés | Recette QA guichet : demande, paiement, traitement, remise | Clôture pour anciens étudiants ; SMS réel |
| Évaluations et notes | Recette QA : saisie, clôture, périmètre départemental | — |
| Délibérations et bulletins | Recette QA normale et rattrapage, validation concurrente unique, gel ([preuve](../audit/recommandations-2026-10-06/rattrapage.json)) | Règles pédagogiques humaines, impression physique |
| Réclamations | Recette QA : fil, assignation, anonymat, clôture | Escalade et validation métier |
| Réservations de salles | Recette QA : collisions sérialisables (409) | Calendrier réel |
| Paie des vacataires | Recette QA : calcul, validation, gel, paiement unique ([preuve](../audit/recommandations-2026-10-06/paie-http.json)) | Validation comptable, rapprochement |
| Élections | Recette QA : bulletin unique, transitions concurrentes, proclamation ([preuve](../audit/recommandations-2026-10-06/elections.json)) | Validation humaine des règles électorales |
| Attestations et QR | Recette QA HTTP et formulaire à 375 px : émission, rattachement, révocation concurrente, motif confidentiel ([preuve](../audit/recommandations-2026-10-06/rattachement-attestations.json)) | Validation terrain |
| Justificatifs | Recette QA sur deux départements, décision unique sous concurrence ([preuve](../audit/recommandations-2026-10-06/justificatifs.json)) | Recette humaine ; règle de correction |
| Salles et affiches QR | Recette QA HTTP : affiches protégées, rotation, impressions journalisées ([preuve](../audit/recommandations-2026-10-06/salles-qr-http.json)) | Impression et scan physiques |
| Cartes étudiantes et badges | Pilote : émission, NIP, expiration, révocation, prolongation à 375 px ([preuve](../audit/recommandations-2026-10-06/carte-prolongation.json)) | Remplacement avec nouveau QR ; scan et impression sur site |
| Portail étudiant | Pilote : profil limité, OTP sans énumération | SMS réel, tâches quotidiennes |
| SMS et notifications | Pilote : contrat fournisseur simulé | Passerelle et livraison réelles |
| Cités et logements | Recette QA : attribution unique, maintenance, retrait | Occupation par lit, critères sociaux |
| Restaurant et portefeuille | Recette QA espèces et confirmation manuelle ([preuve](../audit/recommandations-2026-10-06/restaurant.json)) | Recharge opérateur, appareil de guichet |
| Bibliothèque numérique | Recette QA : dépôt, publication, téléchargement, plagiat exact | Validation documentaire, données réelles |
| VOD | Recette QA : accès privés, progression, affectation à 375 px ([preuve](../audit/recommandations-2026-10-06/vod.json)) | Médias réels, validation pédagogique |
| Stages et mémoires | Recette QA du cycle stage ([preuve](../audit/recommandations-2026-10-06/modules-pilotes.json)) | Jury réel, réactivation |
| Helpdesk | Recette QA dont concurrence ([preuve](../audit/recommandations-2026-10-06/helpdesk-concurrence-http.json)) | Étiquettes sur site, validation DSI |
| Formation continue | Recette QA : capacité, confirmation unique, annulation ([preuve](../audit/recommandations-2026-10-06/formations.json)) | Paiement opérateur, validation pédagogique |
| Examens et tirage | Recette QA HTTP et circuit à 375 px ([preuve](../audit/recommandations-2026-10-06/examens-tirage.json)) | Identité sur site, impression physique |
| Patrimoine et réparations | Recette QA : verrou de ligne, QR régénéré | Étiquettes, amortissement |
| Courrier administratif | Recette QA : circuit ordonné, cloisonnement départemental ([preuve](../audit/recommandations-2026-10-06/courrier-departements.json)) | Validation par le secrétariat |
| Rectorat et MESRS | Recette QA : effectifs et instantané conservé ([preuve](../audit/recommandations-2026-10-06/rectorat.json)) | Définitions des indicateurs, transmission au ministère |
| Régie des recettes | Recette QA HTTP et guichet à 375 px ([preuve](../audit/recommandations-2026-10-06/regie.json)) | Caisse réelle, validation comptable |
| Journal d’audit | Recette QA : 112 configurations sur événements réels, contenus privés masqués ([couverture](../audit/recommandations-2026-10-06/journal-couverture-interface.json)) | Autres familles d’événements |
| Administration et comptes | Refus des mots de passe publics préparé | Voir P0 « Comptes réels » |
| Sauvegarde et restauration | Recette locale (dump, restauration, comparaison) | Voir P0 « Sauvegarde hors serveur » |
| Biométrie | Pilote : gabarits chiffrés, purge atomique ; passerelle `biometrie/` en prototype ([biometrie.md](biometrie.md)) | Lecteur réel, consentement, écran des appareils enrôlés |
| Internationalisation | Parité FR/EN vérifiée (`test:catalogues`) | Revue humaine des formulations |
| Navigation et mobile | Recette technique : cinq rubriques, sept rôles, simplification du 13 octobre ([bilan](../SIMPLIFICATION_2026_10_13.md)) | Retours d’un contrôleur et d’un agent de scolarité |
| Accessibilité | axe-core sans violation automatique ; parcours clavier | Lecteur d’écran, cas `incomplete` |

## Outillage et code

| Travail | État |
| --- | --- |
| Lint | ESLint + Prettier en place, règles en avertissement ; corriger progressivement sans `--fix` massif pendant les travaux parallèles |
| Tests frontend | Vitest en place (`frontend/tests/unit/`) ; étendre aux composables et stores |
| CI | `.github/workflows/ci.yml` ; rendre le lint bloquant quand les avertissements seront résorbés |
| Numérotation | Séquence SQL par préfixe plutôt que maximum calculé en mémoire (`common/numero.ts`) |
| Nettoyage | Scripts de recette non référencés par `package.json` : `recette-cycles.cjs`, `recette-langues.cjs`, `recette-securite.cjs`, `catalogues.cjs` (backend/scripts), conservés |
