# Recette navigateur de la PWA compilée — 24 octobre 2026

Recette de l'interface **compilée** (mode PWA), et non du serveur de
développement : le produit livré est un service worker, un routeur en mode
« hash » et une coque mise en cache. Les constats ci-dessous portent donc sur
le livrable réel.

Aucun code applicatif n'a été modifié : cette recette **signale** les défauts
constatés, elle ne les corrige pas.

## 1. Environnement de recette

| Élément | Valeur |
| --- | --- |
| Build | `QA_BUILD_DIR=/tmp/mc/l7/build-nav API_URL=http://127.0.0.1:15041/api quasar build -m pwa` (Quasar 2.35.2, Vite 8.3.5) |
| Front | petit serveur statique Node sur `http://127.0.0.1:5029` (port choisi dans `CORS_ORIGINS` de l'API de recette) |
| API | API du lot 7 compilée dans ce worktree, `http://127.0.0.1:15041/api`, base jetable `university_qa_9` recréée depuis le modèle `seedtest` par `/tmp/mc/l7/recette-run.sh` |
| Rôles | `admin@unipresence.gn`, `scolarite@unipresence.gn`, `enseignant@unipresence.gn`, `controleur1@unipresence.gn` (`Passer@2026`), `etudiant1@university.gn` (`Etu#2026`) |
| Navigateur | Playwright / Chromium, viewport 1440 × 950, locale `fr-FR` |

## 2. Scénarios ajoutés

| Fichier | Objet |
| --- | --- |
| `frontend/tests/navigateur-outillage.mjs` | serveur statique, rôles, connexion, relevé des erreurs console / exceptions / réponses 4xx-5xx, jetons de session en cache |
| `frontend/tests/navigateur-parcours.mjs` | connexion puis ouverture de **chaque** entrée du menu, pour chaque rôle |
| `frontend/tests/navigateur-fonctionnalites.mjs` | création d'examen, grille des frais, moyens de preuve, correction de pointage, pages découpées |
| `frontend/tests/navigateur-langue-hors-ligne.mjs` | changement de langue fr/en, titres, mode hors ligne et chiffrement de la file des séances |
| `frontend/tests/navigateur-tableau.mjs` | compose le tableau « écran × rôle » à partir des preuves |

Exécution : `QA_FRONT_PORT=5029 node tests/navigateur-<scénario>.mjs <build> <dossier des preuves>`.

## 3. Résultat du parcours complet (menu entier, 5 rôles)

**110 écrans ouverts, 110 OK, 0 KO.** Aucune erreur de console, aucune
exception de page, aucune réponse 4xx/5xx inattendue, aucun écran vide, et un
titre de document portant « University » sur **les 52 titres distincts**
rencontrés.

| Écran | ADMIN | SCOLARITE | ENSEIGNANT | CONTROLEUR | ETUDIANT |
| --- | --- | --- | --- | --- | --- |
| / | OK | — | — | — | — |
| /controle | OK | — | — | OK | — |
| /inscriptions | OK | OK | — | — | — |
| /suivi-presences | OK | OK | — | OK | — |
| /emploi-du-temps | OK | OK | OK | OK | OK |
| /seances | OK | OK | — | OK | — |
| /justificatifs | OK | OK | OK | — | — |
| /moyens-attestation | OK | OK | — | — | — |
| /corrections-pointages | OK | — | — | OK | — |
| /documents | OK | OK | — | — | — |
| /etudiants | OK | OK | — | — | — |
| /scolarite | OK | OK | — | — | — |
| /evaluations | OK | OK | — | — | — |
| /examens | OK | OK | — | — | — |
| /deliberations | OK | OK | — | — | — |
| /reclamations | OK | OK | — | — | — |
| /stages | OK | OK | OK | — | — |
| /paiements | OK | OK | — | — | — |
| /recettes | OK | OK | — | — | — |
| /paie | OK | OK | — | — | — |
| /frais | OK | OK | — | — | — |
| /vod | OK | OK | OK | OK | OK |
| /elections/vote | OK | OK | OK | OK | OK |
| /badges | OK | OK | — | — | — |
| /cites | OK | OK | — | — | — |
| /resto | OK | OK | — | OK | — |
| /bibliotheque-gestion | OK | OK | OK | — | — |
| /formations-admin | OK | OK | — | — | — |
| /reservations | OK | OK | OK | OK | — |
| /helpdesk | OK | OK | OK | OK | — |
| /elections | OK | OK | — | — | — |
| /patrimoine | OK | OK | — | — | — |
| /affectations | OK | OK | — | — | — |
| /enseignants | OK | OK | — | — | — |
| /matieres | OK | OK | — | — | — |
| /structure | OK | OK | — | — | — |
| /salles | OK | OK | — | OK | — |
| /imports | OK | OK | — | — | — |
| /plagiat | OK | — | — | — | — |
| /audit | OK | — | — | — | — |
| /bilan | OK | — | — | — | — |
| /courrier | OK | OK | — | — | — |
| /notifications | OK | OK | — | — | — |
| /utilisateurs | OK | — | — | — | — |
| /parametres | OK | — | — | — | — |
| /mes-seances | — | — | OK | — | — |
| /examens/scan | — | — | OK | OK | — |
| /portail | — | — | — | — | OK |
| /ma-carte | — | — | — | — | OK |
| /mes-demarches | — | — | — | — | OK |

« — » : l'entrée n'est pas au menu de ce rôle (le manifeste de navigation
fait foi), pas un écran en échec.

## 4. Scénarios fonctionnels — 12 OK, 0 KO

| Scénario | Résultat |
| --- | --- |
| Création d'un examen | Examen « Examen recette navigateur 202610241059 » (code `RECNAV571794`) créé depuis le dialogue « Planifier un examen », notification « Examen planifié », examen présent dans la liste |
| Grille des frais (/frais) | Écran complet, aucun défaut |
| Moyens de preuve (/moyens-attestation) | Écran complet, aucun défaut |
| Correction de pointage (/corrections-pointages) | Écran complet, aucun défaut |
| Pages découpées | /seances, /paiements, /inscriptions : blocs de contenu présents ; /cites (3 onglets), /patrimoine (3), /resto (3), /stages (2) : chaque onglet s'ouvre et affiche son contenu |

## 5. Langue et titre — 4 OK

Écran français → choix « English » dans le menu du compte → interface
entièrement en anglais (`html lang="en"`, menu « Attendance / Registrar /
Finance / Campus / Administration ») → rechargement : la langue est conservée
(`university_lang = en-US`) → retour au français (`html lang="fr"`). Le titre
reste « University » dans les deux langues.

Titres des écrans publics également contrôlés : `/connexion`,
`/bibliotheque`, `/formations`, `/verification` portent tous « University ».

## 6. Mode hors ligne — 5 OK, 1 KO

| Contrôle | Résultat |
| --- | --- |
| Service worker | Coque mise en cache, page contrôlée après 6 007 ms |
| Mise en file d'une séance hors ligne | Séance en file, identifiant client UUID |
| **File des séances chiffrée** | Clé `university_file_seances_<compte>` : 878 caractères, préfixe `upf1:` (AES-GCM), aucune donnée en clair |
| Rechargement hors ligne | Session conservée, file déchiffrée et restituée (une séance), écran rendu |
| **Aucune donnée en clair dans localStorage** | **KO** — voir le constat n° 1 |

## 7. Constats

### Constat 1 — les caches de tournée préparée restent en clair dans localStorage

- **Écran** : Contrôle (`/#/controle`), écran hors ligne du contrôleur.
- **Étapes** : connexion contrôleur → preparation de la tournée (affectations
  et salles mises en cache) → coupure réseau → lecture de `localStorage`.
- **Attendu** : rien de lisible dans le stockage local ; la file des séances
  comme les caches voisins doivent être chiffrés au repos.
- **Obtenu** : la file des séances et la file des pointages sont bien chiffrées
  (`upf1:`), mais deux clés voisines restent en JSON clair :
  - `university_affectations_tournee_<compte>` → contient l'intitulé de
    l'affectation (« Recette navigateur ») ;
  - `university_salles_tournee_<compte>` → contient le code et le nom de la
    salle (« Salle recette en clair »).
- **Impact** : sur un téléphone de contrôleur partagé ou égaré, la tournée du
  jour (matière, enseignant, salle) reste lisible sur l'appareil, alors que la
  file d'attente est protégée. Les deux caches sont écrits par
  `src/stores/seances.ts` (`enregistrerAffectations`, `enregistrerSalles`),
  qui les sérialise en clair alors que la file utilise
  `ecrireFileHorsLigne`.
- **Capture** : `preuves/2026-10-24/navigateur-hors-ligne-en-clair.png`
  (les PNG ne sont pas versionnés, voir `docs/audits/README.md`).
- **Correction envisagée** : passer `enregistrerAffectations` et
  `enregistrerSalles` par `ecrireFileChiffree`, comme la file.

### Constat 2 — le champ date ne s'ouvre qu'au clic sur l'icône du calendrier

- **Écran** : Scolarité → Organisation des examens → « Planifier un examen ».
- **Étapes** : ouvrir le dialogue, cliquer dans le champ « Date de l'examen ».
- **Attendu** : le calendrier s'ouvre (le champ est en lecture seule, le
  calendrier est l'unique moyen de le renseigner).
- **Obtenu** : rien ne se passe. Le calendrier ne s'ouvre qu'au clic sur la
  petite icône `event` à gauche du champ. Testé sur le clic dans le champ
  (`input`), sur la zone de saisie (`.q-field__native`) et sur le conteneur
  (`.q-field__control`) : aucun n'ouvre le calendrier ; seule l'icône le fait.
- **Impact** : à l'écran comme au doigt (la zone cliquable utile se réduit à
  une icône de 16 px), la saisie de la date d'un examen ou d'une séance est
  peu évidente. Le composant concerné est
  `src/shared/components/ChampDate.vue` (le `@click="ouvrir"` posé sur
  `q-input` n'attrape pas le clic dans le champ).
- **Capture** : `preuves/2026-10-24/navigateur-creer-examen-dialogue.png`.
- **Correction envisagée** : poser le gestionnaire de clic sur
  `.q-field__control` (ou sur le `q-input` en écoute non native).

### Point d'attention — la connexion est limitée à dix tentatives par quart d'heure

`POST /auth/login` renvoie **429** au-delà de dix tentatives par compte et
par adresse réelle en quinze minutes (garde `DebitGuard`). C'est le
comportement voulu — une faculté derrière un même NAT ne doit pas se
bloquer — mais il gêne une recette qui se connecte à chaque écran : les
scénarios récupèrent donc un jeton une fois et le réutilisent
(`jetonPourRole`, cache dans `QA_SESSION_FILE`), la connexion par le
formulaire restant vérifiée par le parcours.

## 8. Preuves

| Fichier | Contenu |
| --- | --- |
| `preuves/2026-10-24/navigateur-parcours.json` | 110 écrans × 5 rôles : titre, erreurs, statut |
| `preuves/2026-10-24/navigateur-fonctionnalites.json` | 12 scénarios fonctionnels |
| `preuves/2026-10-24/navigateur-langue-hors-ligne.json` | 10 scénarios langue et hors ligne, anomalies |

Captures PNG dans le même dossier (non versionnées, comme le reste des
captures de recettes).

## 9. Limites de la recette

- La recette porte sur la **base jetable** `seedtest` : certains écrans n'ont
  donc aucune donnée à afficher (tableaux vides), et les parcours de création
  n'ont été exercés que là où la mission le demandait (examen). La correction
  d'un pointage, le pointage d'une séance et l'encaissement d'un paiement n'ont
  pas été écrits — ils sont couverts par les recettes métier du lot.
- Les écritures ne sont pas rejouées : la base de recette n'est pas
  réinitialisée entre les rôles.
- Le nombre d'écrans testés dépend du menu réellement servi : un écran hors
  menu (par exemple `/bilan` pour la scolarité) n'est pas contrôlé.
