# Simplifier University — analyse du 13 octobre 2026

## Périmètre et conclusion

Objectif demandé : alléger les pages, supprimer les choix inutiles, rendre les parcours plus compréhensibles, sans ajouter de fonctions complexes.

Analyse des routes, du menu, des composants partagés, des traductions françaises, des principales pages de gestion et de certains modèles de données. L’inventaire compte **68 fichiers de pages**, tous profils et pages publiques compris ; ce chiffre ne correspond pas au nombre d’écrans accessibles à chaque utilisateur. Les recommandations reposent sur le code actuel. Elles ne constituent pas une recette visuelle ni une mesure d’usage. Le navigateur connecté n’a pas pu démarrer et le frontend n’était pas accessible sur son port de développement habituel.

**Le meilleur premier chantier consiste à retirer les éléments répétés avant de fusionner les pages.** Le menu possède déjà cinq rubriques, des raccourcis par rôle et un seul groupe ouvert à la fois. Une nouvelle navigation générale apporterait peu. En revanche, les pages multiplient les renvois, les modes d’affichage et les blocs de synthèse avant la liste de travail.

Ce document conserve l’analyse initiale, réalisée avant les modifications. La mise en œuvre autorisée ensuite est décrite dans le [bilan de réalisation](SIMPLIFICATION_2026_10_13.md). Aucune donnée de l’établissement n’a été supprimée.

## 1. Suppressions prioritaires

| Élément actuel | Proposition concrète | Pourquoi |
| --- | --- | --- |
| Changement de vue sur **37 pages** : 35 utilisent `view-toggle`, deux `bascule-vue` | Retirer les bascules tableau/cartes des listes ordinaires. Garder une présentation adaptée à l’appareil. Réserver le calendrier à la planification. | L’utilisateur vient traiter un dossier, pas choisir une représentation. La multiplication des vues augmente aussi la maintenance. |
| Barre de parcours sur **14 pages**, renvois explicites sur sept pages | Retirer les rangées génériques « Voir aussi ». Conserver les actions liées au dossier ouvert. | Ces barres reproduisent le menu et précèdent l’information utile. |
| Deux rangées de renvois sur Paie et Recettes | Supprimer les deux rangées ; garder uniquement les liens nécessaires dans les détails. | Sur Recettes, le lien Paiements figure même dans les deux rangées. |
| Grandes cartes de compteurs sur Paiements, Recettes, Documents, Mes demandes, Mes réclamations | Remplacer les synthèses non indispensables par une ligne courte. Donner la priorité à la liste. | Les petits écrans consacrent beaucoup d’espace aux chiffres avant de montrer les dossiers. |
| Support : bouton « Déclarer un incident », carte de catégories, « Autre problème » | Garder une seule entrée « Signaler un problème » et choisir la catégorie dans le formulaire existant. Conserver le scan lorsqu’un équipement doit être identifié. | Plusieurs entrées différentes ouvrent le même geste. |
| Champs contenant des valeurs calculées ou attribuées | Présenter matricule et tarif officiel comme du texte, conserver le champ de montant seulement lorsqu’une saisie est nécessaire. | Un champ désactivé donne l’impression qu’une action ou une saisie manque. |

Sources : composants `ViewToggle`, `ParcoursMetier` et `LiensCroises` (supprimés lors de la mise en œuvre), [Paie](frontend/src/pages/PaiePage.vue), [Recettes](frontend/src/pages/RecettesPage.vue), [Support](frontend/src/pages/HelpdeskPage.vue), [Étudiant](frontend/src/components/EtudiantDialog.vue), [Inscription](frontend/src/components/InscriptionDialog.vue).

Les boutons présents dans un état vide peuvent rester : proposer la première création est utile. La cible est la répétition de commandes dans une page déjà remplie.

## 2. Regroupements utiles

### Rectorat et statistiques MESRS : une seule entrée

Ces pages présentent des indicateurs proches : effectif, réussite et masse salariale. Mais leurs données ont une différence essentielle : le Rectorat consulte la situation actuelle et les statistiques MESRS consultent des bilans archivés.

Proposition : une entrée **« Bilan de l’établissement »**, avec deux sections accessibles séparément, « Situation actuelle » et « Bilans archivés ». Afficher une seule section à la fois et conserver les dates des bilans. Retirer les cartes et graphiques répétés lorsqu’ils n’aident pas la tâche. Préserver les liens existants par redirection si les routes changent.

Le regroupement porte sur l’entrée et la présentation. Il doit conserver la distinction entre valeurs actuelles et valeurs archivées.

Sources : [Rectorat](frontend/src/pages/RectoratPage.vue), [Statistiques MESRS](frontend/src/pages/StatistiquesMesrsPage.vue).

### Évaluations et notes : une entrée de travail cohérente

La liste des évaluations sait déjà ouvrir les notes d’une évaluation. La page Notes propose pourtant de sélectionner à nouveau une évaluation et renvoie vers la liste.

Proposition : une entrée **« Évaluations et notes »**. Depuis une évaluation, « Saisir les notes » ouvre directement la saisie existante, en plein écran. Conserver cette saisie comme écran distinct, avec un retour clair à la liste. Éviter de réunir la liste, les formulaires et la grille de notes sur une même page.

Pour les rôles qui commencent habituellement par les notes, le raccourci actuel peut rester : simplifier ne doit pas allonger leur parcours.

Sources : [Évaluations](frontend/src/pages/EvaluationsPage.vue), [Notes](frontend/src/pages/NotesPage.vue).

### Examens, tirage et scan : rattacher les actions à l’examen

La fiche d’examen dispose déjà d’actions pour le tirage et le scan. Pour la gestion administrative, ces opérations peuvent être ouvertes depuis l’examen concerné, au lieu d’occuper trois entrées indépendantes.

Proposition : garder **« Organisation des examens »** dans le menu administratif et y ouvrir le tirage ou le contrôle d’entrée avec l’examen déjà choisi. Garder un accès direct au scan pour les surveillants et contrôleurs qui l’utilisent sur le terrain.

Ne pas fusionner immédiatement les modèles `Examen` et `Evaluation` : le premier gère l’organisation et les présences, le second les coefficients et les notes. Une fusion technique est un chantier métier distinct.

Sources : [Examens](frontend/src/pages/ExamensPage.vue), [Routes](frontend/src/router/routes.ts), [Modèles](backend/prisma/schema.prisma).

### Documents : regrouper l’accès, garder les tâches distinctes

Demandes, attestations, cartes et tarifs sont dispersés. La barre de parcours les traite comme une suite alors qu’ils ne constituent pas tous les étapes d’un même dossier.

Proposition : conserver le regroupement « Documents » déjà présent dans le menu, retirer sa répétition dans chaque page et placer les tarifs dans les paramètres. Depuis une demande, ouvrir le document à émettre avec son contexte lorsque ce lien existe déjà. Garder les listes de demandes et de documents émis séparées.

Les badges visiteurs concernent les accès au campus ; ils peuvent rejoindre Campus plutôt que les documents scolaires. Cartes et badges ont des règles distinctes et ne justifient pas un formulaire commun.

Sources : [Menu](frontend/src/layouts/MainLayout.vue), [Demandes](frontend/src/pages/DemandeDocumentsPage.vue), [Attestations](frontend/src/pages/AttestationsPage.vue), [Tarifs](frontend/src/pages/TarifsDemandeAdminPage.vue).

### Support et patrimoine : clarifier maintenant, fusionner seulement après étude

Deux inventaires existent : `EquipementCampus` pour le support et `EquipementPatrimoine` pour les acquisitions, la valeur et les réparations. Ils possèdent des identifiants et QR distincts.

Pour l’interface, faire du patrimoine le lieu de gestion de l’inventaire et du support le lieu de signalement et de traitement des incidents est une direction cohérente. Mais supprimer immédiatement l’inventaire du support empêcherait de gérer les équipements qui lui sont propres.

Première action : clarifier les intitulés et retirer les renvois génériques. Une unification des données demanderait une étude des correspondances, des QR et des tickets existants. Elle ne fait pas partie du premier chantier d’allègement.

Sources : [Support](frontend/src/pages/HelpdeskPage.vue), [Patrimoine](frontend/src/pages/PatrimoinePage.vue), [Modèles](backend/prisma/schema.prisma).

## 3. Rendre les pages plus intuitives

### Une tâche dominante par écran

Modèle proposé pour les listes courantes :

1. Titre et action principale.
2. Recherche et filtres réellement utiles au quotidien.
3. Liste des dossiers.
4. Détails et actions secondaires à l’ouverture d’un dossier.

Une ligne de synthèse peut rester si elle aide à décider quoi traiter. Les grandes synthèses et graphiques appartiennent principalement aux écrans de bilan.

Le composant `FilterBar` cache déjà les filtres avancés : conserver ce comportement. Montrer directement le filtre essentiel lorsque la tâche l’exige, par exemple le statut dans une file de documents à traiter. Laisser sexe, opérateur, plage de dates et autres critères occasionnels dans le panneau dépliable. Renommer « Filtres avancés » en « Filtres ».

Éviter les boutons secondaires tous au même niveau : l’action suivante du dossier reste visible, les actions rares vont dans le détail ou un menu court. Conserver les libellés des actions ; des icônes seules allègent visuellement mais demandent davantage d’interprétation.

### Des intitulés qui expliquent le périmètre

| Actuel | Proposition |
| --- | --- |
| Statistiques | Statistiques de présence |
| Rapports & états | Rapports de présence |
| Examens | Organisation des examens |
| Évaluations | Évaluations et notes, si l’entrée est regroupée |
| VOD des cours / Lecteur VOD | Cours en vidéo / Lire la vidéo |
| Support IT | Assistance informatique |
| Salles & QR | Salles |
| Rechercher un module | Rechercher une page |
| Snapshot archivé | Bilan archivé |
| Kanban | Retirer le choix ; si conservé pour une tâche justifiée, « Par étape » |

Conserver les termes universitaires usuels : délibération, promotion, attestation, vacataire. Une phrase courte peut expliquer un terme au moment où il devient utile. Éviter les longues explications répétées sur toutes les pages.

Sources : [Libellés de navigation](frontend/src/i18n/fr-FR/nav.ts), [Libellés du menu](frontend/src/i18n/fr-FR/layout.ts), [Statistiques MESRS](frontend/src/i18n/fr-FR/statistiquesMesrs.ts).

### Portail étudiant

Le portail présente les services puis l’inscription, les frais, les paiements récents, les résultats, les attestations et la restauration. Plusieurs services existent aussi dans le menu.

Réduire l’accueil à l’état de l’inscription, au solde et au dernier résultat, puis aux quelques accès les plus fréquents. Réunir frais et paiements récents dans un même bloc, avec l’historique dépliable. Garder les documents et les services secondaires accessibles sans afficher toutes leurs informations d’emblée. Réunir les liens vers demandes de documents et réclamations sous le libellé de menu « Mes démarches », en conservant leurs formulaires spécialisés.

Source : [Portail](frontend/src/pages/PortailPage.vue).

### Accueils et paramètres

L’accueil général répète une vingtaine de destinations possibles avant filtrage par rôle et services. La scolarité possède déjà un accueil consacré aux dossiers à traiter ; contrôleur, enseignant et étudiant ont aussi une destination adaptée.

Conserver ces accueils métier et réduire l’accueil général à quelques accès fréquents existants. Ne pas créer un tableau de bord supplémentaire.

Les paramètres affichent une liste de réglages puis les services, avec deux enregistrements séparés. Présenter clairement deux sections, « Règles de présence » et « Services de l’établissement », chacune avec son bouton d’enregistrement. Déplacer langue et thème dans le menu du compte pour alléger le bandeau. Éviter d’ajouter une page de préférences.

Sources : [Accueil général](frontend/src/pages/AccueilUniversityPage.vue), [Accueil scolarité](frontend/src/pages/AccueilScolaritePage.vue), [Paramètres](frontend/src/pages/ParametresPage.vue), [Services](frontend/src/components/ServicesActifs.vue), [Bandeau](frontend/src/layouts/MainLayout.vue).

## 4. Réduire le périmètre visible avec l’existant

Le réglage « Services de l’établissement » permet déjà de désactiver des services facultatifs. Utiliser ce mécanisme pour masquer ceux que l’établissement n’utilise pas réellement : élections, vidéos, formation continue, restauration, logements, badges ou autres services facultatifs selon ses besoins.

Aucune mesure d’usage n’a été consultée : cette liste désigne des candidats à examiner, pas des modules démontrés inutiles. Commencer par la désactivation réversible et la disparition de leurs entrées. La suppression définitive de code ou de données demanderait une décision de périmètre et une vérification des dépendances.

## 5. Ordre recommandé

| Ordre | Intervention | Effort relatif |
| --- | --- | --- |
| 1 | Retirer les renvois génériques, surtout les doubles rangées de Paie et Recettes ; corriger les intitulés | Faible |
| 2 | Réduire les compteurs sur les pages de travail ; simplifier le Support et les champs calculés | Faible à moyen |
| 3 | Retirer les changements de vue des listes courantes ; garder une présentation adaptée à chaque appareil | Moyen |
| 4 | Réduire le portail et l’accueil général ; déplacer les réglages rares | Moyen |
| 5 | Regrouper Rectorat/MESRS et les entrées Évaluations/Notes, Examens/Tirage/Scan | Moyen, selon les droits et les liens existants |

L’effort est une appréciation du code, sans estimation chiffrée. La désactivation de services inutilisés peut être faite indépendamment, après choix du périmètre de l’établissement.

Conserver les cinq rubriques du menu, les destinations par rôle, le pointage mobile, son fonctionnement hors ligne, les autorisations et la traçabilité. Garder la paie séparée des encaissements, et l’identité d’un étudiant séparée de ses inscriptions annuelles.

Pour valider les futurs changements, vérifier surtout que chaque rôle retrouve sa tâche, que les détails gardent leur contexte, que les actions nécessaires restent accessibles sur téléphone et que les anciens liens fonctionnent encore. Le succès attendu est concret : moins de commandes avant la liste et une action suivante plus facile à identifier.
