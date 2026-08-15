# Recommandations — UniPrésence

État au 14 août 2026. Le produit est en ligne (presence.naimba.com), 62 tests
backend au vert, le parcours du contrôleur tient debout. Ce document ne liste
pas ce qui marche : il liste ce qui manque, dans l'ordre où ça se paie.

Chaque point indique ce que ça coûte de ne **pas** le faire.

---

## P0 — À faire avant qu'un vrai enseignant soit pointé

### 1. Aucune sauvegarde de la base (½ journée)

`crontab` sauvegarde choco-com et TaxiHoro. UniPrésence, non. Une base
d'assiduité perdue, c'est un semestre de contrôle qui n'a jamais existé, et
c'est le genre d'incident qui tue le produit chez le premier client.

Reprendre `scripts/backup-db.sh` de choco-com : `pg_dump` quotidien à 3 h,
rétention 30 jours, plus une copie hors serveur (rsync ou objet distant). Une
sauvegarde qu'on n'a jamais restaurée n'existe pas : tester la restauration une
fois, sur une base jetable.

### 2. Le login n'a aucune limite de tentatives (1 journée)

`@nestjs/throttler` n'est pas installé, `helmet` non plus. `/auth/connexion`
accepte un nombre illimité d'essais. Sur une application dont tout l'argument
est « le registre n'est plus falsifiable », un compte contrôleur forcé par
dictionnaire ruine la démonstration.

- throttler global (par exemple 60 req/min) et strict sur `/auth/connexion`
  (10 tentatives / 15 min par IP + par compte) ;
- verrouillage temporaire du compte après N échecs, tracé dans `AuditLog` ;
- `helmet` + CORS restreint aux deux domaines ;
- JWT à 12 h sans révocation : ajouter une liste de jetons révoqués, ou au
  minimum invalider les jetons émis avant le dernier changement de mot de passe
  (comparer `iat` à `motDePasseModifieLe`).

### 3. Le gabarit d'empreinte est stocké en clair (2 jours)

`Enseignant.empreinteTemplate` est une colonne texte en clair. C'est une donnée
biométrique : le risque n'est pas seulement technique, il est syndical et
politique. Un enseignant qui apprend que son empreinte est dans une base
lisible par l'administrateur système a raison de refuser le dispositif.

- chiffrer la colonne au repos (clé applicative hors base, `pgcrypto` ou
  chiffrement applicatif) — le gabarit n'a jamais besoin d'être lu par un
  humain, seulement comparé ;
- écrire une note de consentement affichée à l'enrôlement, et la conserver
  (date, qui a enrôlé) ;
- durée de conservation explicite : suppression du gabarit à la fin du contrat
  de l'enseignant ;
- garder le PIN et la signature comme alternatives de plein droit, jamais
  comme sous-modes dégradés : un enseignant doit pouvoir refuser l'empreinte
  sans être compté absent.

### 4. La file hors ligne conserve les preuves en clair (1 journée)

`stores/pointages.ts` sérialise le pointage complet dans `localStorage`, donc
la signature manuscrite et, selon les cas, le code PIN saisi. Un téléphone de
contrôleur perdu, c'est un stock de preuves d'attestation exploitable.

Ne mettre en file que ce qui est nécessaire à la reconstitution côté serveur
(le résultat de vérification signé, pas le secret), purger la file après
synchronisation réussie — c'est déjà le cas — et ajouter une purge des entrées
de plus de 7 jours.

---

## P1 — Ce qui décide l'adoption

### 5. Le journal d'audit existe en base mais n'a aucun écran (1 jour)

Le modèle `AuditLog` est alimenté par `controle`, `attestation`, `auth`,
`justificatifs`. Personne ne peut le consulter. C'est pourtant le seul
contre-pouvoir du dispositif : sans lui, le contrôleur devient le nouveau point
de falsification, exactement le problème qu'on prétend résoudre.

Écran « Journal » réservé à la direction : qui a pointé quoi, quand, depuis
quelle adresse, et surtout **toute correction faite après coup**, avec l'ancienne
et la nouvelle valeur. Afficher l'heure serveur à côté de l'heure déclarée : un
pointage saisi à 18 h pour une séance de 8 h doit se voir.

### 6. Relevé PDF signé, par département et par semaine (2 jours)

L'export est en CSV uniquement. Dans une administration universitaire, le
livrable qui fait foi est une feuille signée par le chef de département. Tant
qu'on ne produit pas ce papier, l'application est un doublon du registre, pas
son remplaçant.

PDF avec en-tête de l'établissement, le tableau des séances, les taux, les
signatures/empreintes reproduites en vignette, et un numéro de relevé. C'est ce
document qu'on montre au doyen, pas un écran.

### 7. État des heures faites pour la paie des vacataires (3 jours)

C'est l'argument économique, et il est absent. Les universités paient des
vacations sur des heures déclarées ; UniPrésence connaît les heures
**réellement** faites, attestées et horodatées.

Produire un état par enseignant et par période : heures dues au contrat, heures
constatées, écart, montant à mandater selon le taux horaire. C'est le seul
module qui transforme l'application d'un coût administratif en une économie
chiffrable — et c'est ce qui débloque un budget à Kankan.

### 8. Préparer la tournée avant de perdre le réseau (1 jour)

La file d'attente d'écriture existe et fonctionne. La lecture, non : le service
worker est en `NetworkFirst`, donc les séances du jour ne sont dans le cache que
si le contrôleur a déjà ouvert la page pendant qu'il avait du réseau. Dans un
amphi au sous-sol, il ouvre l'application et ne voit rien.

Bouton « Préparer ma tournée » sur le tableau de bord : télécharge les séances
du jour, les enseignants et les salles concernées, affiche l'heure du dernier
rafraîchissement. Et faire passer la création de séance non programmée par la
même file d'attente que le pointage : aujourd'hui elle échoue hors ligne.

### 9. Import de l'existant (2 jours)

Il n'y a aucun import. Démarrer à Kankan signifie saisir à la main les
enseignants, les matières, les promotions et l'emploi du temps complet. Personne
ne le fera, et le projet mourra à l'installation.

Import Excel/CSV avec prévisualisation et rapport d'erreurs ligne à ligne pour
les enseignants, les matières, les salles et les créneaux. Prévoir que les
fichiers reçus seront sales : accents, colonnes déplacées, doublons.

---

## P2 — Ce qui en fait un produit et non une installation

### 10. Multi-établissement, maintenant (1 à 2 jours)

Zéro `etablissementId` dans le schéma. Ajouter la colonne et le filtrage global
tant qu'il n'y a qu'un client coûte une journée ; le faire après le deuxième
client, c'est une migration de données à risque sur une base de production, plus
un audit de chaque requête pour vérifier qu'aucune fuite inter-établissement ne
subsiste.

Le moment le moins cher est maintenant, avant Kankan.

### 11. Clôture de période (1 jour)

`AnneeAcademique` existe, mais rien n'empêche de pointer rétroactivement un
semestre clos. Un état de paie signé doit reposer sur des données figées :
clôturer une période verrouille les pointages, toute modification ultérieure
passe par une correction tracée et visible dans le journal.

### 12. Mesurer les contrôleurs, pas seulement les enseignants (1 jour)

Les statistiques disent quels enseignants sont absents. Elles ne disent pas
quelles séances programmées n'ont jamais été visitées, ni quel contrôleur
couvre 30 % de sa tournée. Le taux de couverture du contrôle est la première
question que posera un vice-recteur, et l'application ne sait pas y répondre.

### 13. Tests là où le risque est réel (1 jour)

62 tests backend, dont la règle « l'enseignant ne peut que consulter ». Côté
front, un seul parcours fumée. Deux manques précis : aucun test ne vérifie que
l'interface enseignant n'offre aucune action d'écriture, et aucun test ne
couvre la file hors ligne (mise en file, doublon de séance, synchronisation
partielle) alors que c'est le code le plus difficile à déboguer sur le terrain.

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
- **Ajouter des écrans.** Il y en a 17. Les manques listés ici sont des règles,
  des exports et de la robustesse, pas des pages.

---

## Si je devais tenir un ordre

Semaine 1 : sauvegardes, throttler, chiffrement du gabarit, purge de la file.
Semaine 2 : journal d'audit visible, relevé PDF.
Semaine 3 : état de paie des vacataires, préparation de tournée hors ligne.
Semaine 4 : import Excel, multi-établissement.

À l'issue, le produit est présentable à une seconde université sans dette.
