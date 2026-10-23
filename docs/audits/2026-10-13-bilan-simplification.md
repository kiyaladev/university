# Simplification des parcours — 13 octobre 2026

Objectif : diminuer la charge visuelle et les choix de présentation, sans ajouter de fonctionnalités métier complexes.

## Changements réalisés

| Recommandation | Résultat |
| --- | --- |
| Retirer les renvois génériques | Les barres `ParcoursMetier` et `LiensCroises` ont été retirées des pages et leurs composants inutilisés supprimés. Les liens utiles au dossier restent accessibles. |
| Supprimer les choix de présentation | Les listes passent automatiquement du tableau aux cartes sur petit écran. Les réservations gardent le calendrier sur ordinateur et la liste sur mobile. Les tableaux par étapes redondants des stages, du tirage et des délibérations ont été retirés. |
| Réduire les compteurs | Paiements, recettes, documents, demandes, réclamations et assistance affichent des résumés compacts. |
| Clarifier les actions | L’action courante reste visible ; les opérations secondaires sont regroupées sous « Autres actions ». Les confirmations et les droits restent propres à chaque opération. |
| Simplifier les filtres | Recherche et filtres essentiels visibles ; critères occasionnels dans « Filtres ». |
| Regrouper la navigation | « Suivi des présences » rassemble synthèse, statistiques et rapports ; « Documents » rassemble demandes, attestations et cartes ; « Bilan de l’établissement » rassemble situation actuelle et archives. |
| Rapprocher les parcours pédagogiques | Entrée « Évaluations et notes », accès direct aux notes de l’évaluation ; accès aux bulletins depuis les délibérations selon les droits. |
| Rapprocher les examens et le tirage | Tirage et scan sont accessibles depuis l’organisation des examens ; accès direct au scan conservé pour enseignant et contrôleur. |
| Réduire l’accueil | Quelques tâches fréquentes par rôle ; accueils métier conservés. |
| Alléger le portail étudiant | Inscription, solde et résultat en premier ; historique des paiements, attestations, restauration et services secondaires dépliables. Demandes et réclamations regroupées dans « Mes démarches ». |
| Simplifier l’assistance | Une entrée « Signaler un problème » ; suppression des tuiles de déclaration redondantes. Équipements du support et patrimoine conservent leurs périmètres métier. |
| Clarifier les formulaires | Matricule généré présenté comme information ; tarif officiel affiché comme montant de référence ; observations facultatives du pointage repliées. |
| Éviter les entrées répétées | Génération des séances réservée à l’emploi du temps ; tarifs des documents accessibles dans les paramètres. |
| Alléger le bandeau | Langue et thème dans le menu du compte ; paramètres distinguant règles de présence et services. |
| Rendre les intitulés compréhensibles | Libellés français et anglais harmonisés : cours vidéo, assistance informatique, organisation des examens, bilan archivé, statistiques et rapports de présence. |

Les cinq rubriques du menu sont conservées. Les anciennes adresses continuent de fonctionner. Les regroupements respectent les rôles et les services activés.

## Périmètre préservé

Les modèles métier restent distincts : identité et inscription annuelle ; paiements, recettes et paie ; examens et évaluations ; séances et contrôles ; inventaire du support et patrimoine. Aucune migration ni suppression de données métier n’a été introduite.

Le pointage conserve ses cinq constats explicites, les exigences d’attestation et une nouvelle preuve lors d’une correction. La simplification porte sur les observations facultatives ; elle ne change pas les règles de constat, les seuils ni les calculs de paie.

Les services facultatifs conservent leur configuration actuelle. Leur désactivation reste disponible dans les paramètres et masque leurs entrées. Sans indication sur leur usage réel, aucun service n’a été désactivé arbitrairement.

## Vérifications

- Vérification TypeScript : réussie.
- Catalogues : 5 534 clés françaises et anglaises, aucune traduction manquante.
- Compilations SPA et PWA isolées : réussies.
- Recette sur l’API réelle et la base QA isolée : 428 configurations sur sept rôles, zéro erreur JavaScript, réponse HTTP en échec ou débordement horizontal détecté. Les destinations du menu, les largeurs mobiles et le changement de langue ont été vérifiés.
- Recette d’interface avec API simulée : sept rôles, français/anglais, menus mobiles, tableaux/cartes, actions secondaires, contexte de notes, préférences, portail et historique, pointage signé, absence, correction avec nouvelle preuve et services désactivés.
- Actions des stages, du tirage et des délibérations : vérifiées à 375, 768 et 1 440 pixels.
- Contrôles axe-core : 24 scans sur étudiants, paramètres, demandes et portail, aux trois largeurs et en thèmes clair/sombre ; aucune violation automatiquement détectée. Menu du compte essayé au clavier. Captures du portail et des paramètres relues sur téléphone.
- Pointage côté serveur : 48 tests réussis.
- File hors ligne : chiffrement avant persistance, absence du PIN, décryptage après rechargement, retrait après synchronisation et migration des anciennes files vérifiés.
- `git diff --check` : réussi.

Tests reproductibles : `../../frontend/tests/simplification.mjs` et `../../frontend/tests/simplification-parcours.mjs`. La recette complète exige une API locale et la base QA explicitement nommée ; elle ne doit pas viser la production.

Les résultats de recette sont conservés dans `/tmp/university-root-final-interface`, `/tmp/university-root-final-parcours` et `/tmp/university-root-final-offline.log`. Les contrôles de lisibilité et leurs captures sont dans `/tmp/university-simplification-qa/accessibilite-finale.json` et `/tmp/university-simplification-qa`. Les derniers libellés du portail ont été revérifiés après compilation.

Sans captures de référence antérieures, la comparaison visuelle automatique reste non concluante. Les essais automatisés et au clavier ne constituent pas une certification complète d’accessibilité.

## Choix restant

La liste des services facultatifs réellement inutilisés reste à préciser par l’établissement avant leur désactivation dans les paramètres. Le mécanisme existant et les accès regroupés respectent les services désactivés ; aucune configuration n’a été choisie arbitrairement.

## État du site

Une commande de compilation a temporairement écrit dans le dossier servi par nginx. Ce dossier a été restauré depuis `HEAD`, avec l’adresse de l’API de production. Les simplifications du code de travail n’ont pas fait l’objet d’un déploiement final. Les compilations de livraison et de recette suivantes utilisent exclusivement `QA_BUILD_DIR` hors du dossier servi.

## Préparation de publication

La compilation PWA de production utilise `https://university-api.naimba.com/api`. Elle a été construite dans un dossier isolé, puis vérifiée avec les recettes d’interface, d’installation PWA et de file chiffrée. Une seconde compilation après ajout de la protection de configuration produit exactement les mêmes 260 fichiers, vérifiés par SHA-256. Aucun média de démonstration n’est inclus.

- Candidat prêt : `/var/backups/university/frontend/simplification-candidat-20261013T1825Z.tar.gz`.
- Retour arrière local : `/var/backups/university/frontend/avant-simplification-20261013T182353Z.tar.gz` ; les 263 fichiers ont été comparés au site servi. Cette copie locale ne remplace pas la sauvegarde hors serveur demandée par la procédure.
- Inventaire et résultats : [publication.json](preuves/2026-10-13/publication.json).
- Protection ajoutée dans `frontend/quasar.config.ts` : une API de boucle locale exige `QA_BUILD_DIR`. Le refus a été vérifié avant toute écriture, avec contrôle de l’intégrité du site servi.

L’inspection de production du 13 octobre refuse la publication : dix comptes actifs utilisent encore un mot de passe de démonstration, aucun administrateur réel n’est configuré, neuf migrations sont en attente et aucune destination SSH de sauvegarde hors serveur n’est renseignée. [Rapport en lecture seule](preuves/2026-10-13/preflight-publication.json).

La [procédure du README](../../README.md#6-déploiement) demande de lever ces préconditions avant une mise à jour. Le site servi reste donc sur la version restaurée. Aucun compte, service, schéma de données ou processus API de production n’a été modifié pendant cette préparation.
