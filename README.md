# University — plateforme de gestion universitaire (registre, scolarité, campus)

Plateforme née du moteur UniPrésence (contrôle numérique de la présence des
enseignants : le contrôleur pointe chaque salle depuis son téléphone, avec
horodatage serveur et preuves de passage — QR de la salle, géolocalisation,
signature de l'enseignant) et étendue en système universitaire complet.

- **Frontend** : Quasar 2 / Vue 3 / TypeScript / Pinia — **PWA installable**, conçue
  pour le téléphone du contrôleur comme pour les postes administratifs
- **Backend** : NestJS 11 / Prisma 6 / PostgreSQL, authentification JWT + RBAC
- **Ports** : front `5082`, API `5081` (base PostgreSQL **`university`**)

## Modules (feuille de route)

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

**Comptes de démonstration** : mot de passe commun `Passer@2026`
(`admin@unipresence.gn`, `direction@unipresence.gn`, `scolarite@unipresence.gn`,
`chef.info@unipresence.gn`, `controleur1@unipresence.gn`, `enseignant@unipresence.gn`)
+ étudiants `etudiant1|2|3@university.gn` / `Etu#2026`.

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

### L'enseignant est en consultation seule

Son compte lit ses séances, son relevé et ses justificatifs ; **toute écriture lui est
fermée par une garde globale** (`LectureSeuleGuard`), à la seule exception de son mot de
passe. Il ne signe pas hors salle, ne note pas ses heures, ne dépose pas de
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

Prérequis : Bun, Node 20+, PostgreSQL.

### Base de données

```bash
sudo -u postgres psql -c "CREATE USER unipresence WITH PASSWORD 'unipresence_pwd';"
sudo -u postgres psql -c "CREATE DATABASE unipresence OWNER unipresence;"
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

### Frontend

```bash
cd frontend
bun install
bun run dev                                            # http://localhost:5029 (mode PWA)
API_URL=https://mon-api.example.com/api bun run build  # → dist/pwa
```

> `API_URL` doit être une **vraie variable d'environnement au moment du build**
> (elle est injectée dans le bundle), pas un fichier `.env`.

### Comptes de démonstration

Mot de passe commun : `Passer@2026`

| Compte | Rôle |
|---|---|
| `admin@unipresence.gn` | Administrateur |
| `direction@unipresence.gn` | Direction des études |
| `scolarite@unipresence.gn` | Scolarité |
| `chef.info@unipresence.gn` | Chef de département |
| `controleur1@unipresence.gn` / `controleur2@unipresence.gn` | Contrôleurs |
| `enseignant@unipresence.gn` | Enseignant |

Le jeu de démonstration couvre 4 départements, 10 enseignants, 13 charges
d'enseignement, 6 semaines de séances passées déjà contrôlées et 2 semaines à venir.

---

## 3. Tests

```bash
cd backend  && bun run test       # 62 tests unitaires (Jest)
cd frontend && bun run typecheck  # vue-tsc
cd frontend && bun run test:e2e   # parcours navigateur (Playwright), API + front démarrés
cd frontend && bun run test:pwa   # manifeste, icônes, service worker, démarrage hors ligne
```

Le test de bout en bout accepte une URL : `node tests/smoke.mjs https://presence.naimba.com`.

Les tests unitaires couvrent les règles qui portent la valeur du dispositif :
déduction du statut de présence selon l'heure d'arrivée et les seuils paramétrés,
calcul de la durée effective, rejet d'un QR ne correspondant pas à la salle, contrôle
du rayon de géolocalisation, isolement des échecs lors d'une synchronisation hors
ligne, génération des séances (récurrence hebdomadaire, jours fériés, doublons), et
l'ensemble des règles d'attestation — code erroné, résultat biométrique non signé,
comparaison faite sur un autre gabarit que celui enrôlé, score sous le seuil,
résultat périmé — ainsi que la garde de lecture seule : un enseignant ne peut ni
pointer, ni corriger une séance, ni définir son propre code, ni déposer un justificatif.

Le test de fumée (`frontend/tests/smoke.mjs`) se connecte avec chaque rôle, visite les
16 écrans, effectue un pointage complet et échoue si la moindre erreur JavaScript ou
réponse HTTP en erreur survient.

---

## 4. Structure du code

```
backend/
  prisma/schema.prisma        modèle de données (14 entités)
  prisma/seed.ts              jeu de démonstration
  src/common/                 garde JWT/RBAC, service CRUD générique, utilitaires
  src/modules/auth/           connexion, profil, mot de passe
  src/modules/referentiel/    utilisateurs, années, structure, salles, enseignants,
                              matières, affectations
  src/modules/planification/  créneaux (emploi du temps) + séances + génération
  src/modules/controle/       pointage, synchronisation hors ligne, QR, audit
  src/modules/attestation/    code personnel et empreinte signée par la passerelle
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
| `ATTESTATION_OBLIGATOIRE` | **true** | l'enseignant doit attester par l'un des quatre moyens |
| `SIGNATURE_OBLIGATOIRE` | false | exige spécifiquement la signature manuscrite |
| `EMPREINTE_SCORE_MIN` | 60 | score minimal accepté du lecteur d'empreintes |
| `EFFECTIF_OBLIGATOIRE` | true | exige le comptage des étudiants |
| `NOM_ETABLISSEMENT` | — | en-tête des états imprimés |

---

## 5. Installer l'application sur le téléphone du contrôleur

L'application est une **PWA installable** : elle s'ajoute à l'écran d'accueil et
s'ouvre en plein écran, sans barre de navigateur, comme une application native.

- **Android (Chrome)** : ouvrir <https://presence.naimba.com>, puis le menu du compte
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
| Application | <https://presence.naimba.com> | nginx, statique depuis `frontend/dist/pwa` |
| API | <https://presence-api.naimba.com/api> | nginx → PM2 `unipresence-api` (port 5031) |
| Documentation API | <https://presence-api.naimba.com/api/docs> | Swagger |

Mise à jour :

```bash
cd backend  && bun run build && pm2 restart unipresence-api --update-env
cd frontend && API_URL=https://presence-api.naimba.com/api bun run build   # nginx sert dist/pwa
```

Vhosts : `/etc/nginx/sites-available/presence.naimba.com` et `presence-api.naimba.com`,
certificats Let's Encrypt renouvelés automatiquement par certbot.

**HTTPS** protège le jeton de session et les signatures manuscrites en transit ; il est
requis en production.

Le routeur est en mode `hash` : aucune règle de réécriture nginx n'est nécessaire.

Une tâche planifiée (1 h du matin) bascule automatiquement en `NON_TENUE` les séances
passées qui n'ont jamais été contrôlées — ce sont elles qui alimentent la ligne
« séances sans contrôle » des rapports.
