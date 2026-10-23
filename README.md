# University — plateforme de gestion universitaire (registre, scolarité, campus)

Plateforme née du moteur UniPrésence (contrôle numérique de la présence des
enseignants : le contrôleur pointe chaque salle depuis son téléphone, avec
horodatage serveur et preuves de passage — QR de la salle, géolocalisation,
signature de l'enseignant) et étendue en système universitaire complet.

- **Frontend** : Quasar 2 / Vue 3 / TypeScript / Pinia — **PWA installable**, conçue
  pour le téléphone du contrôleur comme pour les postes administratifs
- **Backend** : NestJS 11 / Prisma 6 / PostgreSQL, authentification JWT + RBAC
- **Ports** : front `5029`, API `5031` (base PostgreSQL **`university`**)

## Modules (feuille de route)

L’analyse du 6 octobre figure dans [AUDIT_2026_10_06.md](AUDIT_2026_10_06.md) ;
la mise en œuvre actuelle et ses dépendances sont dans [SUIVI_RECOMMANDATIONS.md](SUIVI_RECOMMANDATIONS.md).
L’accueil général est distinct de la synthèse de présence. Dans **Paramètres →
Services de l’établissement**, ADMIN sélectionne les modules utilisés. La
désactivation retire leurs liens et leurs API sans supprimer leurs données.
Les fonctions essentielles restent actives ; les pilotes sont explicitement signalés.

L’état réellement vérifié de chaque module est décrit dans [Maturité des modules](MATURITE_MODULES.md). Les cycles locaux validés, les fonctionnalités en pilote et les travaux restant à livrer sont distingués ; les intégrations SMS, Mobile Money et biométrie matérielle attendent leur qualification réelle. Les preuves et dépendances de déploiement sont suivies dans [Mise en œuvre des recommandations](SUIVI_RECOMMANDATIONS.md).

1. **Inscriptions en ligne & Paiement Mobile Money** — préinscription publique,
   dossiers, frais par promotion, paiements MM (Orange/MTN/Telecel, simulation ou
   passerelle opérateur), validation scolarité, attestation d'inscription A4.
2. **Paie des vacataires & heures complémentaires** — feuilles de paie mensuelles
   calculées depuis le service fait contrôlé (séances CONTROLEES), destinées à être
   validées puis payées, impression A4.
3. **Scolarité LMD & délibérations** — évaluations (CC/examen/rattrapage), saisie de
   notes /20, jury : moyenne UE pondérée par les crédits, ADMIS/AJOURNÉ/DÉFAILLANT,
   PV et bulletins A4.
4. **Attestations & vérification par QR** — émission numérotée, QR d'unicité sur le
   document, page de vérification publique journalisée (anti-fraude).
5. **Portail étudiant & SMS** — connexion par OTP SMS (passerelle otp-gateway),
   espace étudiant (inscription, paiements, résultats, attestations), diffusion de
   résultats et avis par SMS.
6. **Cités universitaires** — résidences, chambres, attributions à critères
   (score social/mérite), cycle EN_ATTENTE → ACCORDEE/REFUSEE.
7. **Bibliothèque numérique** — dépôt institutionnel (mémoires, thèses, cours),
   consultation/téléchargement public, adossé aux subventions AUF/UNESCO.
8. **Resto numérique** — portefeuille rechargeable Mobile Money, carte QR étudiante,
   validation repas au guichet.
9. **Réservation des salles/amphi** — calendrier hebdo par salle avec détection de
   conflits, lecture seule de l'emploi du temps.
10. **Stages & mémoires** — espace tripartite (étudiant, encadrant, tuteur),
    machine à états proposé → soutenu, planning des soutenances.
11. **Helpdesk IT** — QR sur les équipements, ticket en 2 clics, file de traitement
    DSI.
12. **Formation continue** — vitrine publique des formations payantes, inscription
    + paiement en ligne (recettes propres).

### Rôles

| Rôle | Périmètre |
|---|---|
| `ADMIN` | tout, y compris comptes et paramètres |
| `DIRECTION` | consultation globale, arbitrage (jury, paie, réservations…) |
| `SCOLARITE` | référentiels, inscriptions, notes, attestations |
| `CHEF_DEPARTEMENT` | son département |
| `CONTROLEUR` | contrôle de présence + guichet resto |
| `ENSEIGNANT` | consultation (séances, fiche) + encadrements & tickets |
| `ETUDIANT` | portail : donc inscription, paiements, résultats, attestations |

Le seed crée des comptes fictifs pour les recettes locales. Ne publiez pas leurs
identifiants et n’exécutez jamais le seed en production ; le backend de
production refuse les mots de passe de démonstration connus.

---

## 1. Ce que fait l'application

### Le geste métier : le pointage

Le contrôleur ouvre sa **feuille de contrôle du jour** (séances issues de l'emploi du
temps), entre dans la salle et consigne :

| Registre papier | UniPrésence |
|---|---|
| Nom de l'enseignant | pré-rempli depuis l'emploi du temps |
| Matière déroulée | champ « thème réellement déroulé » (comparé au thème prévu) |
| Durée de la séance | heure d'arrivée / heure de fin → durée effective calculée |
| — | statut : présent, retard, absent, remplacé, départ anticipé |
| — | nombre d'étudiants présents |
| — | preuves : scan du QR de la salle, position GPS, signature de l'enseignant |
| — | horodatage serveur + journal d'audit des corrections |

**La ligne blanche du cahier** : si le contrôleur trouve en salle un cours qui n'est
pas à l'emploi du temps (rattrapage, remplacement, salle changée), il ouvre une
**séance non programmée** depuis sa tournée — bouton flottant ou barre de tri — et la
pointe aussitôt. Il peut ouvrir une séance, pas modifier ni supprimer celles de
l'emploi du temps.

Le statut est **déduit automatiquement** de l'heure d'arrivée si le contrôleur ne
l'impose pas : dans la tolérance → *présent*, au-delà → *retard*, absence constatée
après le délai configuré → *absent* (seuils paramétrables).

### L'enseignant atteste devant le contrôleur

Le pointage du contrôleur ne suffit pas, mais l'enseignant n'atteste jamais seul :
**tout se passe en salle, sur l'appareil du contrôleur**, qui relève d'abord tous les
détails de la séance. Un seul des trois moyens suffit, et le pointage est refusé sans
aucun d'eux (paramètre `ATTESTATION_OBLIGATOIRE`).

| Moyen | Comment | Force |
|---|---|---|
| **Empreinte digitale** | lecteur relié au poste du contrôleur, comparaison au gabarit enrôlé par la scolarité (voir `biometrie/`) | la plus forte ; demande du matériel |
| **Code personnel** | l'enseignant compose son code à 4-6 chiffres sur l'écran du contrôleur | moyenne : un code peut se prêter |
| **Signature manuscrite** | il signe du doigt sur l'écran ; la signature est **reproduite dans le registre imprimé** | équivalent papier, toujours disponible |

> ⚠️ **Le capteur d'empreinte d'un téléphone ne peut pas servir** : Android ne reconnaît
> que les doigts enregistrés dans l'appareil lui-même — donc ceux de son propriétaire,
> jamais ceux d'un tiers. L'empreinte passe obligatoirement par un lecteur dédié.

### Le registre de présence est en consultation seule pour l’enseignant

Son compte consulte ses séances, son relevé et ses justificatifs. Le registre de
présence est en **lecture seule** (`LectureSeuleGuard`). Des exceptions limitées
autorisent le changement de mot de passe, les encadrements, les tickets IT, le vote,
le scan des examens affectés et les ressources VOD ; leurs services contrôlent aussi
le propriétaire et le périmètre. Il ne signe pas hors salle, ne note pas ses heures, ne dépose pas de
justificatif : la scolarité l'enregistre pour lui, sur pièce. C'est ce qui rend le
registre opposable.

**Mode hors ligne** : sans réseau dans les amphis, les pointages sont conservés dans
le navigateur et renvoyés en lot dès le retour de la connexion (`POST /controles/sync`).

### Autour du pointage

- **Structure académique** : années, départements, filières, promotions, salles.
- **Enseignants & matières**, **charges d'enseignement** (enseignant × matière ×
  promotion × volume horaire contractuel).
- **Emploi du temps** : créneaux hebdomadaires avec détection des conflits
  (même salle / même enseignant / même promotion), puis **génération automatique**
  des séances sur une période, jours fériés exclus.
- **Justificatifs d'absence** : enregistrés par la scolarité sur pièce présentée par
  l'enseignant, arbitrés par la direction ; une absence validée devient une *absence
  excusée*.
- **Statistiques du contrôleur** : par salle (séances, contrôles, absences, effectif
  moyen, taux d'occupation, dernière visite — les salles jamais visitées se repèrent
  d'un coup d'œil) et par enseignant.
- **Rapports de direction** : tableau de bord, assiduité par enseignant / département,
  volume horaire réalisé vs contractuel, **état de paiement des vacataires** (heures
  contrôlées × taux horaire), registre de contrôle.
- **Impression A4** (HTML → PDF navigateur) : registre journalier, fiche individuelle
  d'assiduité, état de paiement, affiches QR des salles.
- **Export CSV** de chaque état (séparateur `;`, UTF-8 avec BOM : s'ouvre directement
  dans Excel / LibreOffice francophone).

### Rôles

| Rôle | Périmètre |
|---|---|
| `ADMIN` | tout, y compris comptes et paramètres |
| `DIRECTION` | consultation globale, arbitrage des justificatifs, correction des contrôles |
| `SCOLARITE` | référentiels, emploi du temps, génération des séances |
| `CHEF_DEPARTEMENT` | son département (enseignants, contrôles, justificatifs) |
| `CONTROLEUR` | feuille de contrôle et pointage, tenue de l'emploi du temps, statistiques par salle et par enseignant |
| `ENSEIGNANT` | **consultation seule** : ses séances, sa fiche d'assiduité, ses justificatifs |

---

## 2. Installation

Prérequis : Bun 1.4.2, Node 20+, PostgreSQL. Bun 1.4 est requis pour lire les overrides imbriqués et les lockfiles v3.

### Base de données locale

```bash
sudo -u postgres psql -c "CREATE USER university WITH PASSWORD 'university_pwd';"
sudo -u postgres psql -c "CREATE DATABASE university OWNER university;"
```

### Backend

```bash
cd backend
cp .env.example .env          # DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGINS
bun install
bunx prisma migrate deploy    # ou : bunx prisma migrate dev
bunx ts-node prisma/seed.ts   # jeu de démonstration (facultatif)
bun run build && bun run start        # API sur http://localhost:5031/api
```

Documentation interactive de l'API : <http://localhost:5031/api/docs>.

Une API de recette doit écouter seulement sur localhost : `HOST=127.0.0.1`.
Utiliser une base QA dédiée et des variables SMS/Mobile Money de recette.

### Frontend

```bash
cd frontend
bun install
bun run dev                                            # http://localhost:5029 (mode PWA)
API_URL=https://mon-api.example.com/api bun run build  # → dist/pwa
```

> `API_URL` doit être une **vraie variable d'environnement au moment du build**
> (elle est injectée dans le bundle), pas un fichier `.env`.

Les builds de production excluent `public/media/demonstration` et son précache.
Pour une recette fictive isolée, `QA_BUILD_DIR=/tmp/university-qa` et
`INCLUDE_DEMO_MEDIA=true` permettent d’inclure ces médias. Ce drapeau n’est
pris en compte qu’avec un répertoire QA explicite.

Le seed de recette crée plusieurs comptes fictifs, sans publier leurs
identifiants. Le jeu de démonstration couvre 4 départements, 10 enseignants, 13 charges
d'enseignement, 6 semaines de séances passées déjà contrôlées et 2 semaines à venir.

---

## 3. Tests

```bash
cd backend  && bun run test       # suite Jest backend (compteur actuel dans SUIVI_RECOMMANDATIONS.md)
cd frontend && bun run typecheck  # vue-tsc
cd frontend && bun run test:e2e   # parcours navigateur avec écritures, API + front QA locaux démarrés
cd frontend && PWA_BUILD_DIR=/tmp/university_qa_file_crypto bun run test:pwa # recette locale du build PWA, sans requête au site public
cd frontend && bun run test:file-chiffree
cd frontend && API_URL=http://127.0.0.1:15031/api QA_BUILD_DIR=/tmp/university_qa_file_crypto bun run build
cd frontend && bun run test:file-chiffree:integration # après le build ci-dessus, API simulée
```

Le test de bout en bout accepte une URL locale : `node tests/smoke.mjs http://localhost:5029`. Il effectue des écritures ; les cibles distantes exigent `QA_ALLOW_REMOTE=true` et une `API_URL` d’environnement QA. Ne pas l’exécuter sur la production.

La recette HTTP stages/helpdesk/bibliothèque/patrimoine/courrier/logement s’exécute avec
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:modules-pilotes`.
Elle exige la base fictive `university_recommandations_20261006` sur localhost
et l’API locale au port 15041, vérifie son identité avant écriture, puis retire
ses dossiers de test. Le fichier privé contient les variables de cette API QA ;
les jetons et secrets ne sont pas inscrits dans le rapport. Un chemin de rapport
JSON peut être passé au script.

La recette restaurant utilise les mêmes préconditions :
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:restaurant`.
Elle crée un étudiant fictif, vérifie les crédits espèces, les débits et
remboursements concurrents, puis la confirmation manuelle d’une recharge en
attente. Elle supprime ses données métier après exécution. Les traces d’audit
de recette restent conservées ; aucun opérateur Mobile Money n’est sollicité.

La recette VOD utilise également cette base et cette API :
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:vod`.
Elle vérifie les accès privés, les transitions concurrentes, la progression
étudiante, les compteurs et le journal. Le parcours navigateur à 375 px utilise
`cd frontend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:vod-cycle`.
Les ressources fictives sont retirées après chaque recette ; aucun cours réel
ou flux externe n’est téléchargé.

La recette formations s’exécute avec
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:formations`.
Elle contrôle publication/clôture concurrentes, capacité, confirmation manuelle
du paiement, annulation, registre, recette encaissée et impression protégée de
la confirmation d’inscription. Les dossiers et paiements fictifs sont retirés
après exécution. La validation pédagogique et le paiement opérateur réel
restent à qualifier.

La recette examens/tirage s’exécute avec
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:examens-tirage`.
Elle vérifie le surveillant, l’identité du scanneur, les scans concurrents,
les rejets et la clôture, puis le SHA-256, la séquence des étapes, l’impression
concurrente et le bordereau protégé. Elle retire ses examens, scans et tirages
fictifs ; aucune impression physique n’est déclenchée.
Le parcours navigateur à 375 px utilise
`cd frontend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:tirage-cycle`.
Il exécute les quatre transitions depuis les cartes et vérifie leurs états en base.

La recette de consolidation utilise
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:rectorat`.
Elle rapproche les effectifs et leurs promotions, génère un instantané,
annule une inscription fictive et vérifie que le bilan conservé reste inchangé.
Elle vérifie aussi les droits de génération et d’impression, puis retire ses
données de recette. La transmission au ministère reste à qualifier.

Le contrôle de validité des cartes et attestations utilise
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:validite-identite`.
Il vérifie le refus du NIP et du QR après expiration, le journal correspondant,
les impressions administrative/propriétaire protégées, le refus tiers et la
confidentialité du motif de révocation. Quatre décisions simultanées sur chaque
registre doivent produire une seule révocation/annulation et un seul audit.
Il vérifie aussi le badge expiré puis prolongé et le refus des mutations après
annulation. Il retire ses documents, son étudiant et son compte fictifs ; les
rattachements/dédoublonnages des attestations, le renouvellement des cartes et
l’impression physique restent à qualifier.

La recette de rattachement des attestations utilise
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:rattachement-attestations`.
Elle refuse les inscriptions absentes ou liées à un autre étudiant, à une autre
année ou promotion ; elle dérive l’année et la promotion de l’inscription.
Elle vérifie l’émission concurrente unique, le changement de type sans doublon,
puis la réémission après révocation en conservant l’invalidité de l’ancien QR.
Ses attestations, inscriptions, étudiant, année et promotion fictifs sont supprimés.

Le formulaire mobile se vérifie avec
`cd frontend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:attestation-rattachement`.
À 375 px, il change étudiant, année et promotion, efface les sélections incompatibles,
retarde une vraie réponse API pour vérifier qu’elle ne remplace pas le dernier
parcours choisi, puis émet et contrôle le rattachement en base. Le service worker
est bloqué pour permettre cette interception réseau. Les données fictives sont
retirées ; les impressions et scans physiques restent à qualifier.

Les recettes de régie utilisent `bun run test:qa:regie` depuis `backend` et
`bun run test:qa:regie-cycle` depuis `frontend`, avec `QA_ENV_FILE` et,
pour le navigateur, `QA_SESSION_FILE`. Le guichet mobile émet et encaisse
une recette fictive ; la recette HTTP vérifie droits, concurrence, paiement
unique, gel comptable et indicateurs. Les données fictives sont supprimées.
La caisse réelle et le rapprochement restent à qualifier.

L’affectation VOD privée utilise `bun run test:qa:vod-affectation` depuis
`frontend`, avec `QA_ENV_FILE` et `QA_SESSION_FILE`. À 375 px, la recette
enregistre une inscription bénéficiaire, vérifie la réouverture, retire puis
rétablit son accès et refuse un autre étudiant. Les libellés FR/EN et le
formulaire enseignant sont contrôlés. Cette affectation concerne une seule
inscription ; la diffusion de médias réels et la validation pédagogique restent
à qualifier. Les ressources fictives sont supprimées en fin de recette.

Pour préparer les sessions métier locales, après compilation du backend :
`cd backend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:session`.
Ce script appelle AuthService.login sur la seule base QA avec les mots de passe
fictifs, contrôle les six identités sur `/auth/me` et conserve les jetons dans
`/tmp/university-recommandations-qa-session.json` avec droits `0600`.
Passer ensuite `QA_SESSION_FILE=/tmp/university-recommandations-qa-session.json`
aux recettes compatibles. Ce mode teste les parcours métier avec des sessions
authentifiées ; il ne qualifie pas le point d’entrée HTTP de connexion.
Le contrôle des libellés FR/EN des attestations accepte aussi cette session privée.

Le parcours navigateur de création et paraphe du courrier utilise les mêmes
préconditions : `cd frontend && QA_ENV_FILE=/chemin/prive/qa-env.json bun run test:qa:courrier-cycle`.
Il vérifie l’enregistrement sans date facultative, la liste filtrée, l’étape
courante et la persistance du paraphe à 375 px, puis retire sa fiche fictive.

Les tests unitaires couvrent les règles qui portent la valeur du dispositif :
déduction du statut de présence selon l'heure d'arrivée et les seuils paramétrés,
calcul de la durée effective, rejet d'un QR ne correspondant pas à la salle, contrôle
du rayon de géolocalisation, isolement des échecs lors d'une synchronisation hors
ligne, génération des séances (récurrence hebdomadaire, jours fériés, doublons), et
l'ensemble des règles d'attestation — code erroné, résultat biométrique non signé,
comparaison faite sur un autre gabarit que celui enrôlé, score sous le seuil,
résultat périmé — ainsi que la garde de lecture seule : un enseignant ne peut ni
pointer, ni corriger une séance, ni définir son propre code, ni déposer un justificatif.

Le test de fumée (`frontend/tests/smoke.mjs`) exige une API de recette et des comptes
autorisés. Le test `file-chiffree:integration` sert un build QA isolé, simule l'API et
vérifie le chiffrement, la migration des files historiques puis le retrait après
synchronisation. Les validations terrain et opérateur sont suivies séparément dans
`SUIVI_RECOMMANDATIONS.md`.

---

## 4. Structure du code

```
backend/
  prisma/schema.prisma        modèle de données (65 modèles)
  prisma/seed.ts              jeu de démonstration
  src/common/                 garde JWT/RBAC, service CRUD générique, utilitaires
  src/modules/auth/           connexion, profil, mot de passe
  src/modules/referentiel/    utilisateurs, années, structure, salles, enseignants,
                              matières, affectations
  src/modules/planification/  créneaux (emploi du temps) + séances + génération
  src/modules/controle/       pointage, synchronisation hors ligne, QR, audit
  src/modules/moyens-attestation/ code personnel et empreinte signée par la passerelle
  src/common/guards.ts        JWT, rôles, et lecture seule du compte enseignant
  src/modules/justificatifs/  dépôt et arbitrage des absences
  src/modules/rapports/       statistiques + états imprimables HTML A4
  src/modules/parametres/     règles de contrôle paramétrables

frontend/src/
  pages/                      un écran par usage (contrôle, séances, rapports…)
  components/                 PointageDialog, AttestationEnseignant, QrScanner, SignaturePad
  stores/auth.ts              session et rôles
  stores/pointages.ts         file d'attente hors ligne

biometrie/                    passerelle locale vers le lecteur d'empreintes (README dédié)
```

### Paramètres de contrôle (écran *Paramètres*, table `Parametre`)

| Clé | Défaut | Effet |
|---|---|---|
| `TOLERANCE_RETARD_MIN` | 15 | minutes avant de considérer un retard |
| `ABSENCE_APRES_MIN` | 30 | au-delà, l'enseignant est déclaré absent |
| `QR_OBLIGATOIRE` | false | exige le scan du QR de la salle |
| `GEOLOC_OBLIGATOIRE` | false | exige une position GPS dans le rayon de la salle |
| `ATTESTATION_OBLIGATOIRE` | **true** | l'enseignant doit attester par l'un des trois moyens |
| `SIGNATURE_OBLIGATOIRE` | false | exige spécifiquement la signature manuscrite |
| `EMPREINTE_SCORE_MIN` | 60 | score minimal accepté du lecteur d'empreintes |
| `EFFECTIF_OBLIGATOIRE` | true | exige le comptage des étudiants |
| `NOM_ETABLISSEMENT` | — | en-tête des états imprimés |

---

## 5. Installer l'application sur le téléphone du contrôleur

L'application est une **PWA installable** : elle s'ajoute à l'écran d'accueil et
s'ouvre en plein écran, sans barre de navigateur, comme une application native.

- **Android (Chrome)** : ouvrir <https://university.naimba.com>, puis le menu du compte
  en haut à droite → « Installer sur cet appareil ». Le navigateur propose aussi sa
  propre bannière, mais elle passe souvent inaperçue.
- **iOS (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

Ce qui change une fois installée : l'application **démarre sans réseau** (la coque est
mise en cache), les pointages faits hors ligne partent de la file d'attente au retour
de la connexion, et l'icône est une plaque du panneau — coche à la craie sur fond
d'encre, les trois couleurs nationales en pied.

Une mise à jour déployée n'écrase pas la session en cours : l'application prévient
« Nouvelle version disponible » et laisse le contrôleur recharger quand sa tournée le
permet, plutôt que de changer d'écran sous ses doigts au milieu d'une salle.

Les icônes sont produites depuis `frontend/public/icons/icone-source.svg` (et sa
variante `icone-maskable.svg`, dont le motif tient dans la zone sûre des lanceurs
Android) :

```bash
cd frontend/public/icons
for t in 128 192 256 384 512; do convert -background none -density 400 -resize ${t}x${t} icone-source.svg icon-${t}x${t}.png; done
```

---

## 6. Déploiement

En production sur cette machine :

| | Adresse | Servi par |
|---|---|---|
| Application | <https://university.naimba.com> | nginx, statique depuis `frontend/dist/pwa` |
| API | <https://university-api.naimba.com/api> | nginx → PM2 `university-api` (port 5081) |
| Documentation API | <https://university-api.naimba.com/api/docs> | Swagger |

Avant une mise à jour, suivre les préconditions de [suivi des recommandations](SUIVI_RECOMMANDATIONS.md) : sauvegarde hors serveur vérifiée, revue des neuf migrations en attente et rotation des dix comptes de démonstration. Le processus chargé et la base configurée doivent être vérifiés sur le serveur avant toute intervention.

Inspection reproductible en lecture seule :
`node scripts/preflight-deploiement.cjs /tmp/university-preflight.json`.
Un rapport sans blocage ne remplace pas la preuve de copie et de restauration hors serveur.

Une fois ces préconditions levées :

```bash
cd backend  && bun run build && pm2 restart university-api --update-env
cd frontend && API_URL=https://university-api.naimba.com/api bun run build   # nginx sert dist/pwa
```

Vhosts : `/etc/nginx/sites-available/university.naimba.com` et `university-api.naimba.com`,
certificats Let's Encrypt renouvelés automatiquement par certbot.

**HTTPS** protège le jeton de session et les signatures manuscrites en transit ; il est
requis en production.

Le routeur est en mode `hash` : aucune règle de réécriture nginx n'est nécessaire.

Une tâche planifiée (1 h du matin) bascule automatiquement en `NON_TENUE` les séances
passées qui n'ont jamais été contrôlées — ce sont elles qui alimentent la ligne
« séances sans contrôle » des rapports.

La recette du cloisonnement du courrier utilise `bun run test:qa:courrier-departements`
depuis `backend` avec `QA_ENV_FILE` et `QA_SESSION_FILE`. Elle crée deux départements
et trois chefs fictifs, contrôle liste/détail/impression/paraphe, création et
réacheminement avant signature, puis nettoie les fixtures. Le formulaire mobile
`test:qa:courrier-cycle` accepte également la session privée et vérifie le département
choisi. La migration `20261006130000_courrier_departement` laisse les courriers
historiques sans département : ils ne sont plus diffusés à tous les chefs.
ADMIN/SCOLARITE peuvent les affecter avant le premier paraphe ; un circuit déjà
paraphé conserve son routage et reste gérable par l’administration.

La recette des justificatifs utilise `bun run test:qa:justificatifs` depuis
`backend`, avec `QA_ENV_FILE` et `QA_SESSION_FILE`. Elle crée une année isolée,
deux départements, des enseignants intervenant hors de leur département et
des chefs fictifs ; lecture/dépôt/décision, confidentialité des pièces, décisions
concurrentes et refus après clôture sont vérifiés sur l’API réelle. Le traitement
normal accepte VALIDE ou REJETE uniquement depuis EN_ATTENTE. Une décision
traitée et sa preuve sont conservées ; les règles d’une correction dédiée restent
à définir. Les fixtures sont retirées en fin de recette. Les sessions issues
d’AuthService.login ne qualifient pas le point d’entrée HTTP de connexion.

Le parcours existant de prolongation des cartes utilise `bun run test:qa:carte-prolongation`
depuis `frontend`, avec `QA_ENV_FILE` et `QA_SESSION_FILE`. Il crée une identité
fictive et une carte expirée, prolonge sa date via le formulaire SCOLARITE à 375 px,
contrôle identité/QR/NIP conservés et de nouveau utilisables, puis fait concourir
révocation et prolongation. Il vérifie les refus et le retrait de l’action de
modification après révocation, puis retire les fixtures. Il qualifie la prolongation
de la carte existante ; le remplacement par une nouvelle carte/QR avec historique
et les impressions/scans physiques restent à définir ou qualifier.

La recette du rattrapage utilise `bun run test:qa:rattrapage` depuis `backend`,
avec `QA_ENV_FILE` et `QA_SESSION_FILE`. Elle crée une année et une promotion
isolées, quatre étudiants, deux UE avec crédits 3/1 et des épreuves avec
coefficients 1/3. Création/saisie/clôture des épreuves, normale puis rattrapage,
validations concurrentes, moyennes/rangs/taux, gel et bulletins sont vérifiés
sur l’API réelle, ainsi que les refus entre deux chefs de départements.
Toutes les fixtures sont supprimées ; impression physique et validation
pédagogique humaine restent à qualifier.

La recette des élections utilise `bun run test:qa:elections` depuis `backend`, avec les mêmes variables `QA_ENV_FILE` et `QA_SESSION_FILE` réservées à la base QA. Elle qualifie les dates, les rôles de gestion, les transitions concurrentes, le bulletin unique, le vote enseignant et le résultat proclamé, puis supprime ses fixtures. La validation humaine des règles électorales reste nécessaire.

La recette ciblée `bun run test:qa:helpdesk-concurrence` (depuis `backend`, avec `QA_ENV_FILE` et `QA_SESSION_FILE`) vérifie les transitions simultanées des tickets sur la seule base QA, leurs traces et le refus des tiers, puis supprime ses fixtures.

La recette `bun run test:qa:planning` depuis `backend` (variables `QA_ENV_FILE` et `QA_SESSION_FILE`) qualifie créneaux, génération bornée avec jour exclu, rejeu, rôles, synchronisation UUID des séances et clôture d’année sur ses propres référentiels QA, puis les supprime. Elle ne qualifie pas les pointages hors ligne ni l’appareil terrain.
