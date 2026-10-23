# Recommandations — University (alors nommée UniPrésence)

> Document figé (anciennement `audit/historique/2026-10-03/RECOMMANDATIONS.md`).
> Backlog vivant : [docs/suivi.md](../suivi.md).

État du suivi au 3 octobre 2026. Ce document conserve la liste d'origine et
indique maintenant ce qui est livré, ce qui reste à valider et les conditions
de mise en service.

> **Mise à jour du 3 octobre 2026 :** les lignes ci-dessous décrivent l’audit
> initial et ne reflètent plus seules l’état du produit. Plusieurs points ont
> été implémentés depuis : durcissement du login, chiffrement et consentement
> biométriques, purge et chiffrement de la file hors ligne, journal d’audit, rapports/paie,
> couverture des tournées, tests de reconnexion et import des référentiels CSV/XLSX. Pour l’état vérifié, les
> limites et les dépendances externes, consulter [AUDIT_APPLICATION.md](2026-10-02-audit-application.md),
> [SUIVI_RECOMMANDATIONS.md](2026-10-06-journal-recettes.md) et
> [MATURITE_MODULES.md](../suivi.md). Les essais d’import avec les fichiers métier, le multi-établissement et le verrouillage de toutes les mutations par année
> clôturée restent des décisions et travaux de produit ; la préparation hors
> ligne inclut désormais les affectations, salles et la création idempotente de
> séances. Le parcours Chromium isolé passe avec une API simulée ; l’essai sur
> l’API QA avec un compte contrôleur valide et sur appareil terrain reste à faire.

Chaque point indique ce que ça coûte de ne **pas** le faire.

---

La base active est à 12/20 migrations : 8 attendent leur planification en production. Les huit ont été appliquées à la restauration QA ; elle passe à 20/20 et l’index d’unicité des scans est présent, sans doublon historique. Aucune migration n’a été appliquée à la base active. Voir [le rapport de dérive](../../audit/recommandations/derive-deploiement.json).

## P0 — À faire avant qu'un vrai enseignant soit pointé

### 1. Sauvegarde de production — script et tâche basculés, copie hors serveur à configurer

`/opt/apps/university/scripts/backup-db.sh` produit un dump PostgreSQL vérifié, conserve 30 jours, nomme l’archive d’après la base active et copie vers `UNIPRESENCE_BACKUP_REMOTE` si cette destination est configurée. Le cron lit maintenant ce paramètre dans `backend/.env` sans exécuter le fichier comme du code ; une variable d’environnement garde la priorité. L’exemple de configuration est documenté dans `backend/.env.example`, mais reste vide tant qu’aucune cible SSH n’est fournie. La restauration QA précédente a récupéré 10 enseignants, 107 séances et 67 contrôles, puis passé les huit migrations. Un nouveau dump de `university` a été créé le 3 octobre à 16:24 (66 tables, SHA-256 vérifié, permissions 0600) ([preuve](../../audit/recommandations/sauvegarde-locale-2026-10-03-1624.json)). `node scripts/backup-db.spec.mjs` vérifie la rétention, les permissions, le checksum, le refus des dumps trop petits, la propagation d’un échec distant et la lecture de la destination depuis la configuration cron, sans toucher à PostgreSQL. Il reste à configurer une destination hors serveur. La tâche quotidienne de 03:15 appelle désormais le script courant.

### 2. Limiter les tentatives de connexion — implémenté, CORS et proxy de confiance vérifiés

La connexion applique une limite par adresse et compte, compte les échecs
concurrents par incrément atomique et écrit état de verrouillage et `AuditLog`
dans la même transaction ([preuve et limites](../../audit/recommandations/verrouillage-login-concurrent.json)) ;
les jetons sont invalidés après changement de mot de passe. Helmet et une
liste CORS configurable sont actifs. `CORS_ORIGINS` autorise l’interface
`https://university.naimba.com` ; l’API confirme cette origine et refuse les
origines inconnues. Nginx transmet `X-Forwarded-For` et `X-Forwarded-Proto`, et
Express ne fait confiance qu’à son proxy direct. Le processus API a été
rechargé ; `/api/docs` et `/api/docs-json` répondent 401 sans jeton et
`/api/health` répond 200. Seule la rotation des comptes de démonstration reste
à faire dans ce point.

### 3. Protéger les gabarits d'empreinte — implémenté, politique RH à valider

`Enseignant.empreinteTemplate` est chiffré au repos. L'enrôlement exige un
consentement et conserve sa date et l'identité de l'agent ; une tâche
quotidienne efface les gabarits 90 jours après la désactivation de la fiche.
La sélection, l'effacement et la trace de purge sont maintenant atomiques ; le
gabarit lui-même ne figure jamais dans l'audit ([preuve](../../audit/recommandations/purge-biometrie-transaction.json)).
Il reste à faire valider que cette durée et la désactivation correspondent à
la fin de conservation autorisée. Le PIN et la signature restent disponibles.

### 4. Protéger les preuves de la file hors ligne — chiffrement local implémenté, recette d'intégration à finir

`stores/pointages.ts` retire le PIN, purge les entrées de plus de sept jours et
chiffre la file avec AES-GCM. La clé non extractible est conservée dans
IndexedDB ; migration, isolation par compte, synchronisation simulée et refus
d'un contenu altéré sont testés ([preuve](../../audit/recommandations/file-chiffree.json)).
Cela protège un dump de `localStorage`, mais une page compromise sur la même
origine peut demander au navigateur de déchiffrer. La recette sur appareil réel
reste à faire.

---

## P1 — Ce qui décide l’adoption

### 5. Le journal d'audit — écran implémenté, couverture avant/après élargie

L'écran « Journal » est réservé à ADMIN et DIRECTION et expose filtres,
acteur, actions, détails et horodatages. La recette PWA est enregistrée. Les
valeurs avant/après sont maintenant consignées pour les corrections de pointage,
les recalculs/transitions de paie et de paiements, les inscriptions au guichet,
les tarifs de frais, les saisies de notes, les fiches étudiantes, les recettes,
les demandes documentaires, le patrimoine, le courrier, les réservations, les
réclamations, le helpdesk, les stages, le plagiat, les élections, la VOD et les
téléchargements authentifiés de documents.
Les mutations couvertes journalisent l'état dans la même transaction que
l'écriture, avec des projections qui écartent les textes libres, documents,
coordonnées, téléphone et jetons QR. Les tentatives SMS ajoutent aussi un
événement réduit au statut, à la présence du contenu et à l'acteur ; ni numéro,
nom, message ni réponse fournisseur ne sont copiés dans l'audit. Une diffusion
SMS ajoute un événement de lot avant l'appel distant ; les résultats par
destinataire restent dans `Notification`, et les appels sont limités à dix
simultanément. Sur les réclamations, le journal
retient la vie du dossier — numéro, qualification, situation, affectation,
escalade, clôture — et la présence seule du sujet, de la description, des
messages, des notes internes et des pièces jointes ; il n'en recopie aucun
contenu, ni matricule, ni nom d'agent ; les actions anonymes ne conservent pas
le compte de leur auteur dans l'audit, et les lectures n'y produisent rien. Le
paiement d'une demande et son rattachement sont désormais atomiques ;
les réparations et le basculement de l'équipement le sont aussi. Les
modifications et désactivations étudiantes
excluent coordonnées, date de naissance, QR et secrets de compte
([preuve](../../audit/recommandations/journal-fiches-etudiantes.json),
[extension du 3 octobre](../../audit/recommandations/audit-avant-apres-2026-10-03.json),
[réclamations](../../audit/recommandations/journal-reclamations.json),
[helpdesk](../../audit/recommandations/journal-helpdesk.json),
[élections](../../audit/recommandations/journal-elections.json),
[VOD](../../audit/recommandations/journal-vod.json)).
La recette de l'écran Journal passe pour ADMIN et DIRECTION, en français et en anglais, à 1440 et 375 px, sur API simulée ([preuve UI](../../audit/recommandations/journal-interface-2026-10-03.json)). Les anciennes descriptions et les dépôts de vote ne sont pas exposés ;
les nouvelles projections restent réduites. Les consultations VOD n'entrent pas
dans le journal. Le résumé des diffusions SMS passe par une liste blanche côté
API, et le filtre de vote historique ainsi que le filtre acteur ont désormais
des tests directs. Les libellés du SMS et du téléchargement documentaire sont
vérifiés en français et en anglais, sur bureau et mobile
([preuve UI : huit parcours](../../audit/recommandations/journal-sms-2026-10-03.json)). Il reste à y vérifier des entrées réellement produites par ces dix
modules, puis à couvrir les autres modules sensibles.

### 6. Relevé PDF signé, par département et par semaine — implémenté, recette métier à faire

Le relevé PDF hebdomadaire signé par le chef de département est implémenté ;
les exports CSV restent disponibles pour l’exploitation des données.

Le PDF A4 hebdomadaire est généré pour le département du chef connecté, avec
en-tête, tableau des séances, indicateurs, signatures disponibles et numéro
unique. La signature manuscrite et le hash du document sont consignés dans le
journal. La recette par les chefs de département et la signature électronique
qualifiée restent à faire.

### 7. État des heures faites pour la paie des vacataires — module implémenté, règles comptables à valider

Le module de feuilles de paie calcule les heures constatées depuis les séances
contrôlées, compare le volume prévu, fige les taux et montants à la validation,
puis suit le paiement et produit un état imprimable. La recette locale du cycle
est passée. La comptabilité doit confirmer les règles d'arrondi, de retenue et
de taux avant tout mandat réel.

### 8. Préparer la tournée avant de perdre le réseau — implémenté, parcours terrain à valider

Le tableau de bord propose « Préparer hors ligne » et conserve les affectations
et salles sous le compte courant ; les créations de séance non programmée ont
une file dédiée, synchronisée avant les pointages associés. Le parcours
Chromium vérifie maintenant le Service Worker, la coupure réseau, la création
UUID, le rechargement hors ligne, puis une synchronisation unique via une API
locale simulée ([preuve](../../audit/recommandations/seances-hors-ligne.json)). Il
reste la validation avec l’API et le compte contrôleur QA, puis sur l’appareil
du terrain.

### 9. Import de l'existant (2 jours) — implémenté, données métier à qualifier

L'écran d'import accepte les CSV et les classeurs XLSX pour les enseignants,
les matières, les salles et les créneaux. Il reconnaît les en-têtes français
accentués/réordonnés, les titres préliminaires et les valeurs locales courantes ;
les heures et dates numériques Excel sont converties, les colonnes inconnues
sont signalées, et la lecture supporte UTF-8, Windows-1252 et UTF-16. L’aperçu
signale doublons et références invalides avant l’application partielle des lignes
valides. La recette sur les fichiers historiques réels reste à faire ; les cas
limites vérifiés figurent dans [la preuve](../../audit/recommandations/imports-cas-limites-2026-10-03.json)
et l’état détaillé dans [SUIVI_RECOMMANDATIONS.md](2026-10-06-journal-recettes.md).

---

## P2 — Ce qui en fait un produit et non une installation

### 10. Multi-établissement, maintenant (1 à 2 jours)

Zéro `etablissementId` dans le schéma. Ajouter la colonne et le filtrage global
tant qu'il n'y a qu'un client coûte une journée ; le faire après le deuxième
client, c'est une migration de données à risque sur une base de production, plus
un audit de chaque requête pour vérifier qu'aucune fuite inter-établissement ne
subsiste.

Le moment le moins cher est maintenant, avant Kankan.

### 11. Clôture de période — garde-fous renforcés, revue globale et politique de correction à définir

La clôture bloque maintenant les créations et corrections directes de
pointage, ainsi que la suppression. Les principales écritures de scolarité,
inscription, attestation, cité, planification et tirage vérifient aussi l'année.
La revue relève les parcours indirects à trancher dans la [matrice des mutations](../../audit/recommandations/matrice-mutations-annee-2026-10-03.json).
Une correction historique ne peut pas encore être demandée via un flux dédié :
il faut définir qui l'autorise, avec quel motif et quelle trace, avant de
l'implémenter.

### 12. Mesurer les contrôleurs, pas seulement les enseignants — implémenté, tournées réelles à renseigner

Les séances peuvent être attribuées une à une ou en groupe par période et
département, après prévisualisation. Le rapport distingue les séances visitées,
manquées ou reprises par un collègue, et mesure le taux réalisé par le contrôleur
prévu. Les équipes doivent attribuer leurs tournées réelles pour obtenir des
indicateurs fidèles ; voir [la preuve](../../audit/recommandations/couverture-controleurs.json).

### 13. Tests là où le risque est réel — couverture renforcée, recette navigateur restante

La suite backend passe 819 tests dans 101 suites. Les mutations des comptes,
fiches étudiantes, codes PIN, enseignants, matières, salles, cités, paramètres et bibliothèque sont auditées dans leur transaction, avec des
instantanés réduits qui excluent les secrets et données personnelles sensibles.
Le rejeu séquentiel avec `--detectOpenHandles` passe sans `--forceExit` et ne
signale aucun handle bloquant ; le script `test` utilise désormais le mode
séquentiel. Les contrôles ciblent les
périmètres de rôle, les cycles métier, les écritures concurrentes, les imports,
la création hors ligne et les synchronisations partielles/idempotentes. Les
scénarios navigateur couvrent aussi les vues par rôle, la reconnexion et la
navigation ; le parcours d’exploitation complet attend encore un compte QA
fonctionnel et les validations terrain.

---

## P3 — Plus tard, et seulement si le terrain le demande

- **APK** (Trusted Web Activity autour de la PWA) : utile surtout pour piloter
  un lecteur d'empreinte natif et pour la distribution hors Play Store. Ne rien
  faire tant que la PWA ne bloque personne.
- **SMS d'alerte** au chef de département sur absence non justifiée : la
  passerelle `otp-gateway` (Termux) est déjà en place, donc c'est quelques
  heures de travail — mais à n'activer qu'une fois le produit accepté, sinon
  l'outil est perçu comme un mouchard avant d'être perçu comme utile.
- **Signature de clôture de tournée** par le contrôleur, avec récapitulatif
  quotidien.

---

## Ce que je ne recommande pas

- **Reconnaissance faciale ou comptage automatique des étudiants.** Coût élevé,
  fiabilité médiocre en amphi, et rejet garanti. L'effectif saisi à la main par
  le contrôleur suffit largement à l'usage.
- **Laisser l'enseignant pointer lui-même, même « en dépannage ».** C'est la
  règle qui fonde le produit ; la première exception la videra de son sens.
- **Ajouter des écrans.** Il y a 67 pages dans `frontend/src/pages`. La
  navigation de la sidebar est regroupée en cinq rubriques repliables, avec
  raccourcis et recherche ; le parcours est vérifié sur sept rôles, y compris
  sur mobile ([preuve](../../audit/recommandations/navigation.json)). Les manques
  restants sont des règles, des exports et de la robustesse.

---

## Si je devais tenir un ordre

Semaine 1 : sauvegardes, throttler, chiffrement du gabarit, purge de la file.
Semaine 2 : journal d'audit visible, relevé PDF.
Semaine 3 : état de paie des vacataires, préparation de tournée hors ligne.
Semaine 4 : import Excel, multi-établissement.

À l'issue, le produit est présentable à une seconde université sans dette.
