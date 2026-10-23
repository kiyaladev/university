# Audit de l’application University (alors nommée UniPrésence) — 2 octobre 2026

> Document figé. L’état courant et le travail restant sont dans [docs/suivi.md](../suivi.md).

> Actualisation : [analyse et vérifications du 6 octobre 2026](2026-10-06-analyse.md). Les résultats ci-dessous conservent leur date et leur périmètre d’origine.

## Verdict

**L’application dispose d’un socle fonctionnel et d’une présentation cohérente, mais tous les parcours ne sont pas validés et plusieurs incohérences restent à traiter.** La compilation seule ne suffisait pas : le parcours des écrans et les essais avec les comptes de chaque rôle ont révélé des erreurs API et des accès excessifs aux données. Des corrections locales ont été apportées et vérifiées pendant l’audit. Elles ne sont pas déployées.

Le parcours principal « planifier une séance → constater la présence → consulter le registre » est cohérent. Le pointage avec QR et code personnel, la persistance du constat, la mise à jour de la séance, la synchronisation d’un lot partiellement invalide et le paiement en simulation ont été exécutés avec succès sur une base isolée. Cela ne certifie ni les intégrations externes ni toutes les opérations des modules annexes.

La hiérarchie visuelle fonctionne globalement sur ordinateur et mobile : titres visibles, actions principales identifiables, séparation entre filtres et résultats, tableau de bord lisible. Le menu administratif et les longues listes méritent une simplification. Deux débordements horizontaux avérés ont été corrigés ; une vue en cartes par défaut sur téléphone améliorerait encore la lecture.

## Périmètre et preuves

Le dépôt courant comporte un important ensemble de modifications locales préexistantes. L’audit a conservé ces travaux et n’a effectué aucune migration, écriture métier ou connexion de démonstration sur la production.

Une base PostgreSQL jetable a été créée en local, puis supprimée avec ses comptes et secrets de recette après les vérifications : les **12 migrations** et le seed complet ont été exécutés. Le seed échouait initialement à la compilation ; ses types ont été corrigés avant de l’utiliser. Les appels SMS ont été dirigés vers une adresse locale inactive et Mobile Money est resté en simulation.

| Vérification | Résultat / portée |
| --- | --- |
| Backend | Compilation réussie ; 12 suites et **125 tests** réussis |
| Frontend | `vue-tsc --noEmit` et build PWA réussis |
| Écrans authentifiés | 248 vérifications : 174 couples rôle/écran à 1440 px et 74 vérifications à 375/768 px |
| Rôles | ADMIN, DIRECTION, SCOLARITE, CHEF_DEPARTEMENT, CONTROLEUR, ENSEIGNANT, ETUDIANT |
| API métier locale | Pointage QR + PIN, lecture persistée, synchronisation avec échec partiel, paiement simulé |
| Accès négatifs | Étudiant refusé sur le registre et les paiements ; enseignant limité à ses contrôles/séances ; accès étudiant à un autre dossier refusé |
| Impression d’inscription | Étudiant propriétaire : 200 ; autre dossier : 404 ; administrateur : 200 ; jeton invalide : 401 |
| Swagger en mode production local | Sans jeton ou avec jeton forgé : 401 ; enseignant : 403 ; administrateur : 200 sur docs, JSON et YAML |
| Déploiement public | Site HTTP 200, santé API `ok`, contrôle PWA antérieur réussi, y compris la coque hors ligne |
| Diff | `git diff --check` réussi |

La première matrice de 248 contrôles avait 15 échecs. Après les corrections fonctionnelles, la deuxième n’a plus de réponse API en erreur et présente un seul signal transitoire de page manquante sur les justificatifs. Ce signal ne s’est pas reproduit lors d’un contrôle individuel. Elle a aussi confirmé sept occurrences de débordement à 375 px, limitées aux pages étudiants/paiements suivant les rôles. Après correction, ces deux pages mesurent 375 px de largeur de document pour 375 px de fenêtre. **La dernière passe, après correction et attente du montage réel des pages, termine les 248 vérifications avec zéro erreur API/JavaScript et zéro débordement de document mesuré.** Les ressources externes de démonstration et avertissements i18n restent consignés séparément.

Le script [frontend/tests/audit.mjs](../../frontend/tests/audit.mjs) permet de rejouer les contrôles sur localhost avec les comptes du seed. Les détails dynamiques et chaque bouton de chaque module ne sont pas couverts par cette matrice.

Preuves conservées, toutes issues de données fictives :

- [Parcours API](preuves/2026-10-02/parcours-api.json) et [impression / Swagger](preuves/2026-10-02/acces-impression-swagger.json).
- [Matrice finale : 248 contrôles](preuves/2026-10-02/ecrans-valides.json).
- [Matrice avant les dernières corrections de disposition](preuves/2026-10-02/ecrans-avant-derniere-correction.json).
- [Tableau de bord mobile](preuves/2026-10-02/tableau-de-bord-mobile.png), [paiements mobile corrigés](preuves/2026-10-02/paiements-mobile.png), [étudiants mobile corrigés](preuves/2026-10-02/etudiants-mobile.png), [contrôle sur ordinateur](preuves/2026-10-02/controle-ordinateur.png).

## Problèmes constatés et corrections locales

| Problème reproduit | Correction |
| --- | --- |
| Un étudiant pouvait lister les 66 contrôles ; un enseignant voyait ceux des collègues | Droits du contrôleur et périmètre de consultation imposés côté API ; filtre URL et accès direct par identifiant contrôlés |
| Un enseignant pouvait lire une séance extérieure par son identifiant | Consultation individuelle alignée sur le périmètre de la liste ; chef sans département limité à un périmètre vide |
| Les listes d’enseignants et leurs objets imbriqués contenaient le PIN haché et le gabarit biométrique chiffré | Intercepteur global retirant les secrets des réponses JSON ; conservation des indicateurs booléens nécessaires à l’attestation |
| L’étudiant voyait 33 inscriptions et 32 paiements administratifs | Inscriptions et fiches limitées à son identité ; registre des paiements réservé à ses rôles de gestion |
| Un jeton étudiant permettait d’imprimer le certificat d’un autre dossier | Vérification du compte actif/révocation, du rôle et du propriétaire avant génération |
| Les cartes étudiantes renvoyaient 400 | Retrait de la sélection d’un champ Prisma inexistant ; typage du chargement lié à la carte |
| Réclamations : DIRECTION/SCOLARITE appelaient une liste d’utilisateurs réservée à ADMIN | Endpoint dédié aux agents assignables, limité aux rôles de gestion ; sélecteur aligné |
| Recettes : KPI appelés par SCOLARITE sans droit | Appel réservé aux rôles autorisés, sans élargir les permissions API |
| Restauration : CONTROLEUR chargeait portefeuilles, recharges et transactions interdites | Affichage et chargement limités au guichet autorisé pour ce rôle |
| Swagger : protection contournable et documents JSON/YAML accessibles | Vérification cryptographique du JWT, identité actuelle et rôle ADMIN sur les trois entrées |
| Erreurs métier renvoyées en HTML avec des détails internes | Filtre Nest corrigé : réponses JSON et erreurs serveur génériques ; conflits Prisma traités |
| Étudiants/paiements dépassaient la largeur mobile | Pagination commune pouvant revenir à la ligne ; suppression de la pagination Quasar doublant celle du serveur |
| La vérification OTP distinguait numéro connu et code absent | Erreurs publiques uniformisées ; création et rattachement du compte étudiant transactionnels |
| Les courses concurrentes pouvaient dépasser le solde resto ou rembourser/créditer deux fois | Débit conditionnel au solde et transitions d’annulation/recharge revendiquées dans la transaction |
| Les étiquettes QR Helpdesk perdaient le code exclu des lectures d’inventaire | Impression alimentée par une projection dédiée qui inclut le code QR |
| Une modification partielle de créneau pouvait rendre les heures ou dates incohérentes | Validation des valeurs effectives après fusion avec le créneau existant |

Autres corrections réalisées : clés i18n frontend dupliquées, repli français hors contexte HTTP pour les services centraux corrigés, structure du catalogue backend `common`, pied de page de connexion recouvrant les liens, ports documentés et port API par défaut, types du seed et URL locale par défaut du test de fumée.

## Cohérence et disposition : ce qui mérite d’être réorganisé

**Menu.** L’administrateur dispose de 48 écrans statiques autorisés ; le menu représente une longue liste de métiers différents. Les groupes actuels aident, mais obligent encore à beaucoup défiler. Garder une navigation principale courte, puis ouvrir les rubriques secondaires à la demande. Ne pas retirer les fonctions utiles aux agents : adapter leur visibilité au rôle et aux modules réellement activés.

**État de la recommandation : corrigé en recette locale.** La barre latérale présente maintenant les tâches fréquentes du rôle puis cinq rubriques repliables (Présences, Scolarité, Finances, Campus, Administration), avec recherche, ouverture de la rubrique de la page active et fermeture après navigation mobile. Les sept rôles et l’absence de doublons sont vérifiés dans [navigation.json](preuves/2026-10-03/navigation.json). Les retours d’un contrôleur et d’un agent de scolarité restent à recueillir avant validation métier.

Organisation proposée :

| Rubrique principale | Contenu |
| --- | --- |
| Présences | Tournée, séances, justificatifs, statistiques |
| Scolarité | Étudiants, inscriptions, examens, notes, documents |
| Finances | Paiements, recettes, paie |
| Campus | Bibliothèque, restauration, patrimoine, helpdesk, vie universitaire |
| Administration | Référentiels, comptes, paramètres, journal d’audit |

**Accueil par métier.** Le contrôleur devrait arriver directement sur sa tournée. La scolarité devrait voir les dossiers à traiter et les documents en attente. La direction devrait conserver la synthèse et les arbitrages. L’enseignant devrait disposer d’une entrée « Mes séances », plutôt que de deux entrées « Séances » et « Mes séances » menant à des listes de même périmètre.

**Listes sur téléphone.** Les tableaux larges défilent à l’intérieur de leur conteneur, ce qui est acceptable pour une comparaison ponctuelle. Les vues en cartes déjà présentes devraient être le choix initial à 375 px, avec une préférence mémorisée. Les descriptions de page doivent occuper toute la largeur au-dessus des boutons : sur paiements, la description se retrouve dans une colonne étroite à côté de l’action et allonge inutilement le haut de page.

**Composants.** Centraliser les comportements répétés — titres/actions, filtres, pagination, états vide/erreur — sans fusionner les services métier. La suppression de la double pagination illustre une simplification utile. Les droits d’affichage devraient provenir d’une matrice commune explicite, tout en restant vérifiés indépendamment côté API.

## Tâches restantes, par priorité

| Priorité | Tâche et critère de fin |
| --- | --- |
| Immédiate | **Revue source terminée, recette d’accès encore ouverte** : les 190 routes GET ont été relues par module ; les défauts confirmés ont été corrigés et les pistes heuristiques classées ([rapport](preuves/2026-10-03/revue-routes-manuelle-2026-10-03.json)). Les 26 routes de documents/impression sont protégées par JWT et rôle, avec tests de périmètre ; l’essai avec données et compte QA reste à faire. La vérification en production et deux règles métier restent ouvertes : rattachement public d’un dossier étudiant et portée inter-départements du chef. |
| Immédiate | **Partiellement résolu en code, production encore ouverte** : l’écran ne publie plus les identifiants ([preuve QA](preuves/2026-10-03/demo-ui.json)), et le backend refuse le mot de passe seed ainsi que les anciens jetons correspondants en mode production ([tests AuthService](../../backend/src/modules/auth/auth.service.spec.ts)). L’inspection de base a néanmoins trouvé dix comptes seed encore actifs ; il faut faire tourner au moins un compte administrateur avant déploiement du garde, puis vérifier le serveur et les comptes réels. Aucun essai de connexion de démonstration n’a été fait sur le domaine public. |
| Haute | **Résolu** : le vote enseignant est une exception explicite à `LectureSeuleGuard` sur la seule route `POST /api/elections/vote`. Le service applique le scrutin et le vote unique ; les tests de garde autorisent cette route et refusent ses variantes/cas de contournement. Voir [la recette de sécurité](preuves/2026-10-03/recette-securite.json) et [les tests du garde](../../backend/src/common/guards.spec.ts). |
| Haute | **Recette locale réalisée pour les parcours listés** : validation d’inscription, demande/paiement/remise de document, saisie et délibération des notes, réclamation, décision/collision de réservation et calcul/paiement de paie. Les 44 contrôles HTTP sont consignés dans [cycles-metier.json](preuves/2026-10-03/cycles-metier.json). Les autres transitions de chaque module restent soumises à la recette métier décrite dans [MATURITE_MODULES.md](../suivi.md). |
| Haute | **Reconnexion et parcours Chromium hors ligne simulé vérifiés ; recette terrain ouverte** : la file persistée, le rejeu, l’auteur, les conflits, le retrait des PIN et la course de changement de compte ont été parcourus. Le navigateur crée et recharge une séance hors ligne, puis la synchronise une seule fois vers une API HTTP simulée ([preuve](preuves/2026-10-03/seances-hors-ligne.json)). Il reste à valider avec l’API/base QA, un compte contrôleur valide et l’appareil terrain ; les comptes QA actuellement disponibles sont refusés par l’API. Voir aussi [reconnexion](preuves/2026-10-03/reconnexion.json) et [isolation de compte](preuves/2026-10-03/changement-compte-file.json). |
| Haute | Qualifier SMS/OTP, Mobile Money réel et lecteur biométrique avec leurs passerelles de recette. Un paiement simulé n’est pas un encaissement opérateur validé. |
| Haute | Prouver une restauration de sauvegarde et la copie hors serveur ; vérifier la migration des anciennes empreintes sur la vraie base. Les avertissements des tests concernent des fixtures et ne démontrent pas un défaut de la production. |
| Moyenne | **Résolu** : l’écran de journal d’audit est accessible à ADMIN/DIRECTION, avec filtres par dates/acteur/action/entité, horodatage serveur, détail avant/après et heure déclarée quand elle existe. Le parcours a été vérifié aux formats bureau et mobile pour les deux rôles ([journal.json](preuves/2026-10-03/journal.json), [journal-pwa.json](preuves/2026-10-03/journal-pwa.json)). |
| Moyenne | **Parité FR/EN vérifiée ; recette linguistique protégée à compléter** : les catalogues comptent 5 460 clés par langue sans clé manquante, HTML ni namespace placeholder ([vérification](preuves/2026-10-03/verification-locale-2026-10-03.json)). Colonnes, options de filtre et libellés de filtres avancés suivent le changement de langue ; les options statut/genre ont passé un parcours FR→EN→FR sur API simulée ([preuve](preuves/2026-10-03/options-langues-2026-10-03.json)). L’audit complet des vues protégées reste à rejouer avec un compte QA valide. Les noms de paramètres QR sont conservés à l’identique pour respecter le protocole ([textes-statiques.json](preuves/2026-10-03/textes-statiques.json)). |
| Moyenne | **Résolu pour les ressources du seed** : URLs remplacées par médias locaux ou placeholders identifiés, lus sans erreur réseau en QA ([medias.json](preuves/2026-10-03/medias.json)). Cela ne qualifie pas les médias réels. |
| Moyenne | **Navigation locale réorganisée et rejouée** pour les sept rôles, avec rubriques repliables, recherche, accueil par métier et vues mobiles ([navigation.json](preuves/2026-10-03/navigation.json)). Le 3 octobre, le parcours Chromium confirme les raccourcis, l’accordéon, la recherche et le menu mobile pour chaque rôle ; la recette clavier vérifie aussi focus, Échap, retour au déclencheur et largeur 320 px ([clavier.json](preuves/2026-10-03/clavier.json)). La validation des tâches quotidiennes par un contrôleur et un agent de scolarité reste attendue. |
| Moyenne | **Documentation de maturité et recette automatisée rejouée** : états par module dans [MATURITE_MODULES.md](../suivi.md), axe-core 4.13.0 sans violation sur 19 configurations ; les 134 nœuds de contraste laissés en vérification manuelle ont un minimum calculé de 4,86:1 ([accessibilite.json](preuves/2026-10-03/accessibilite.json)). Navigation sept rôles et clavier vérifiés en QA ; la revue avec lecteur d’écran reste à faire ([navigation.json](preuves/2026-10-03/navigation.json), [clavier.json](preuves/2026-10-03/clavier.json)). |

## Limites et conclusion opérationnelle

Ce rapport porte sur le code local. Le site public répond, mais son état déployé n’a pas été démontré identique à ce worktree. Aucun changement n’a été publié.

La navigation, le chargement des listes et plusieurs opérations centrales ont été vérifiés avec des données fictives. Les détails dynamiques, tous les formulaires, l’accessibilité complète, les performances sous charge, les sauvegardes et les intégrations réelles restent hors certification. Il existe donc une base exploitable, avec des corrections concrètes réalisées, mais pas de justification pour annoncer « tout est fonctionnel ». La prochaine étape utile est une recette par métier et une revue complète des droits de lecture, avant d’élargir encore le nombre de modules.
