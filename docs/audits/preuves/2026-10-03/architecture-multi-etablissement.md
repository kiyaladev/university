# Architecture multi-établissement — proposition

État au 3 octobre 2026 : cadrage local en lecture seule. Aucun changement de
schéma ni aucune migration n’a été appliqué.

## État constaté

- Le schéma Prisma compte 65 modèles et ne porte aucun `etablissementId` ni
  modèle `Etablissement`.
- `User` porte un rôle global, un département éventuel et un lien enseignant ou
  étudiant ; `AuthUser` et le JWT ne transportent aucun établissement actif.
- 33 routes `@Public()` apparaissent dans 19 fichiers. Plusieurs concernent
  les dépôts publics, les QR et les vérifications sans session ; leur
  établissement doit venir d’une résolution serveur approuvée (hôte/config),
  jamais d’un identifiant libre fourni par l’appelant.
- Le client ajoute le JWT à l’API, persiste le jeton dans `localStorage` et
  chiffre les files hors ligne en les indexant par compte. Aucun de ces formats
  ne porte actuellement un établissement ; les sessions, caches et files
  devront être séparés et purgés lors d’un changement d’établissement.
- `Parametre` est un réglage partagé, dont le nom d’établissement est lu par
  plusieurs documents et impressions.
- Les accès directs SQL repérés sont les verrous d’année et de promotion, la
  notification des résultats et la recherche plein texte de bibliothèque. Le
  relevé complet trouve huit invocations dans six fichiers : verrous d’année
  et de promotion, deux requêtes FTS, agrégations de recette de formation,
  obsolescence du patrimoine (deux services), répartition des notifications.
  Les requêtes d’agrégation doivent filtrer explicitement le tenant.
- Les comptes ADMIN actuels sont des administrateurs métier de l’installation ;
  il faudra distinguer leur rôle dans un établissement d’un éventuel opérateur
  de plateforme.
- Le schéma comprend 205 relations, 56 contraintes uniques et 61 index ; un
  inventaire source ne suffit pas à vérifier les contraintes réellement
  présentes dans la base.
- L’index partiel `AnneeAcademique_active_key` est actuellement global et
  n’autorise qu’une seule année active sur toute la base. Il doit devenir
  unique par établissement avant qu’on puisse en activer une par tenant.
- Une requête `SELECT` en lecture seule sur la base `university` confirme
  PostgreSQL 16.15. Cela confirme la version du serveur, pas la présence ni
  l’absence de doublons ou de liens croisés ; ces contrôles restent à faire
  sur la copie QA avant une migration.
- `Parametre` utilise sa clé comme identifiant primaire ; les réglages locaux
  demandent donc une clé primaire composée (établissement, clé), ou un nouveau
  identifiant technique avec une unicité composée.
- `User` peut être supprimé physiquement via le CRUD générique ; 46 relations
  vers lui sont `ON DELETE SET NULL`. Les événements et autres données qui
  doivent garder leur établissement ne peuvent pas hériter de l’acteur seul.

## Modèle proposé

Pour le premier déploiement multi-établissement, chaque compte appartient à un
seul établissement. Ajouter une table `Etablissement`, une clé étrangère
obligatoire sur `User` et un tenant explicite sur les entités métier racines.
Pour les enfants, soit recopier le tenant avec une contrainte composite qui
garantit que parent et enfant appartiennent au même établissement, soit toujours
borner la lecture par leur parent déjà filtré. Ne pas laisser une relation
transversale devenir un chemin de contournement.

La requête d’accès doit appliquer le tenant dans `where` avant lecture ou
écriture. Les exports, pièces jointes, documents protégés, résultats de
recherche, caches et réponses hors ligne doivent reprendre le même périmètre.
Les deux requêtes SQL métier doivent recevoir le tenant et être testées avec
deux établissements. Le contrôle ne doit pas dépendre d’un `etablissementId`
envoyé par le client : le service le tire du compte authentifié.

Si un compte doit accéder à plusieurs établissements, remplacer cette
association directe par une relation `MembreEtablissement` et lier le jeton à
un établissement actif vérifié côté serveur. Cela ajoute un parcours de
changement d’établissement et des règles pour les administrateurs globaux ; ne
pas simuler ce besoin par un tableau d’identifiants fourni au client.

Une colonne `etablissementId` seule n’installe aucune barrière. La garantie
demande la convergence des contraintes de base (y compris les clés étrangères
composées), des filtres avant chaque lecture/écriture, des requêtes SQL, des
tâches planifiées et des routes publiques. Le processus Prisma ne peut pas
déduire le tenant de données sans utilisateur : les crons doivent itérer les
établissements, et les dépôts publics doivent les résoudre depuis un hôte ou
une configuration serveur approuvée.

## Migration proposée

1. Sauvegarder la base `university`, restaurer une copie jetable et inventorier
   chaque modèle, table de jonction, index unique, contrainte, fichier et tâche
   planifiée.
2. Créer l’établissement courant et ajouter des colonnes tenant nullables aux
   modèles racines, sans modifier la production.
3. Backfiller toutes les lignes existantes vers l’établissement courant ;
   vérifier que chaque relation lie des lignes du même tenant et qu’aucune ligne
   orpheline ne subsiste.
4. Ajouter les index uniques composites et les clés étrangères composites
   nécessaires, puis rendre les clés obligatoires.
5. Ajouter le contexte tenant à l’authentification et appliquer les filtres aux
   lectures et écritures des services, y compris aux opérations de lot et aux
   traitements planifiés.
6. Vérifier les documents, QR, exports, recherche, caches PWA, stockage des
   pièces, paramètres d’établissement et appels SQL directs.
7. Exécuter les migrations uniquement après comparaison de sauvegarde et
   restauration QA ; tester systématiquement que deux tenants ne peuvent ni
   lire, ni modifier, ni référencer les données de l’autre.

## Décisions encore requises

- Compte : un établissement unique, ou plusieurs avec appartenance vérifiée ?
  Proposition par défaut : un établissement par compte.
- Administration : ADMIN local uniquement, ou rôle d’opérateur plateforme
  distinct ? Proposition par défaut : ADMIN local, sans accès inter-tenant.
- Connexion : email globalement unique, ou unique par tenant avec sélection de
  l’établissement avant connexion ? Proposition par défaut : email global,
  puisque le formulaire et le JWT actuels ne portent pas de tenant.
- Années, catégories de patrimoine et tarifs documentaires : locaux par
  établissement ou référentiels partagés ? Proposition par défaut : locaux,
  avec une année active par établissement.
- Identité des enseignants/étudiants : profils indépendants par établissement
  ou identité globale membre de plusieurs établissements ? Proposition par
  défaut : profils locaux distincts jusqu’à un besoin de partage confirmé.
- QR : unicité globale (plus simple pour une vérification sans sélection de
  tenant) ou unique par établissement ? Proposition par défaut : globale.
- Données réellement partagées : identifier avant le backfill toute
  nomenclature nationale ou ressource partagée ; aucun référentiel métier
  transversal n’est créé implicitement.
