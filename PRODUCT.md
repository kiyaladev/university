# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

University est une plateforme de gestion universitaire : **sept rôles** partagent la
même installation, du contrôleur qui passe dans les amphis à l'étudiant qui
s'inscrit depuis son téléphone. Aucun n'est un cas particulier — chacun a son
poste de travail, son rythme et ses écrans.

**Le contrôleur pédagogique** est le terrain d'origine, et il reste le plus
exigeant : il circule d'une salle à l'autre pendant les heures de cours,
**debout, une main occupée**, entre dans un amphi ou une salle en cours de
séance, constate qui enseigne, fait signer ou scanner l'enseignant, et repart
vers la salle suivante. Il travaille sur un téléphone Android d'entrée de gamme,
souvent en pleine lumière, parfois sans réseau. Sa tournée dure une demi-journée
et enchaîne 10 à 30 salles.

**L'enseignant** intervient trente secondes par séance : devant le contrôleur, sur
l'appareil de celui-ci, il signe, compose son code personnel ou pose le doigt sur
le lecteur — puis reprend son cours. **Il ne consigne jamais rien lui-même** : ni
son heure, ni sa présence, ni un justificatif. Son compte est en consultation
seule, pour lire ses séances, son relevé et ses justificatifs.

**L'agent de scolarité** tient le guichet et la bascule administrative :
inscriptions, paiements, cartes, attestations, notes, délibérations, demandes de
documents. C'est le poste le plus dense : plusieurs agents, une journée entière devant
un guichet, et des files d'attente qui se forment.

**Le chef de département** pilote son département : enseignants, contrôles,
justificatifs, courrier, jury. Il ne voit pas ce qui n'est pas le sien.

**La direction des études** lit tout et arbitre : assiduité, volume horaire
réalisé, paiement des vacataires, validation des feuilles, rattrapages. Elle
arbitre, elle ne saisit pas.

**L'administrateur** tient les comptes, les paramètres, les services activables et
le journal d'audit. Il est le seul à voir les paramètres bruts.

**L'étudiant** passe par le portail : préinscription, inscription, paiement,
relevés de notes, attestations, démarches, résultats, carte et badge. Il ne
connaît jamais le registre des enseignants : il voit sa scolarité.

## Product Purpose

University remplace les registres papier et les fichiers dispersés d'une
université. Aujourd'hui un agent passe dans les salles avec un cahier où il
note à la main le nom de l'enseignant, la matière déroulée et la durée de la
séance ; à côté, la scolarité tient un dossier d'inscription par étudiant dans
des classeurs, un fichier de notes sur un poste, un cahier de recettes au
guichet. Ces supports ne se totalisent pas, se perdent, se recopient, et
n'opposent rien à une signature ajoutée après coup.

Le produit réussit quand le contrôleur préfère le téléphone au cahier — donc
quand pointer une salle prend moins de temps qu'écrire une ligne — et quand la
direction peut sortir, sans ressaisie, l'assiduité par enseignant, les heures
réellement assurées, l'état de paiement des vacataires, la situation des
inscriptions et des notes d'une promotion.

## Positioning

University est un **ERP universitaire**, pas un simple registre de présence : la
scolarité, les finances, les documents et les services de campus s'y appuient
sur le même référentiel — années, départements, filières, promotions, salles,
enseignants, matières, affectations — et sur la même discipline d'écriture.

Deux partis pris le distinguent d'une suite de logiciels administratifs :

- **Le pointage est contradictoire et non déclaratif** : le contrôleur relève
  tout, et l'enseignant atteste dans le même geste, en salle, sur l'appareil du
  contrôleur, par un moyen daté et opposable (signature reproduite au registre,
  code personnel, empreinte). Personne ne peut consigner sa propre présence :
  c'est ce qui distingue ce registre d'un logiciel de gestion scolaire, où
  l'enseignant déclare ses heures.
- **Ce qui est consigné est opposable** : horodatage serveur, moyen
  d'attestation consigné, corrections tracées au journal d'audit, et une année
  académique close qui verrouille les écritures. Le dossier imprimé vaut parce
  qu'on sait qui l'a écrit, quand et comment.

## Operating Context

- **La tournée** : une feuille de route des séances du jour, salle par salle, dans
  l'ordre des heures. Le contrôleur ne cherche pas, il descend sa liste.
- **La salle** : entrée en cours de séance, bruit, lumière du jour, lecture à bout
  de bras. L'échange avec l'enseignant doit tenir en un geste et ne pas
  interrompre le cours.
- **Le guichet** : l'agent de scolarité encaisse, vérifie, imprime, classe — au
  rythme de l'étudiant qui attend, avec la file derrière lui.
- **Le bureau** : direction, scolarité et chefs de département exploitent les
  données : assiduité, volume horaire, états de paiement, notes, délibérations,
  recettes et patrimoine.
- **Le réseau** : intermittent dans les amphis. Les pointages se font hors ligne et
  se synchronisent au retour du réseau ; le reste du produit assume le réseau de
  l'établissement.
- **Le papier ne disparaît pas** : le registre journalier, les PV de délibération,
  les feuilles de paie, les états de paiement et les listes s'impriment en A4
  pour être signés et tamponnés par le département et la direction.
  L'administration valide sur papier signé.
- **La preuve** : QR affiché à l'entrée de chaque salle, position GPS
  optionnelle, horodatage serveur, journal d'audit des corrections ; attestations,
  cartes et badges numérotés vérifiables par QR.
- **La séparation des rôles** : le contrôleur consigne, la scolarité administre les
  moyens d'attestation et enregistre les justificatifs sur pièce, la direction
  arbitre, le chef de département répond de son département, l'enseignant
  consulte, l'étudiant ne voit que sa scolarité. Aucune écriture n'est ouverte au
  compte enseignant.

## Capabilities and Constraints

**33 modules** en un backend NestJS et une interface Quasar, regroupés en
services activables par l'administrateur :

- **Présences** : contrôle et pointage, séances, emploi du temps, attestation en
  salle (signature, code, empreinte), justificatifs, statistiques et rapports ;
- **Planification** : créneaux hebdomadaires, détection de conflits, génération des
  séances ;
- **Scolarité** : étudiants, inscriptions, évaluations et notes, examens, tirage
  et sécurité des épreuves, délibérations, bulletins, stages, réclamations ;
- **Documents** : attestations, cartes étudiantes, badges, demandes de
  documents, courrier, numérotation et QR de vérification ;
- **Finances** : paiements (inscriptions, documents, formations, restauration,
  recettes externes), frais, recettes, paie des vacataires ;
- **Campus** : cités, restauration, réservations, assistance, patrimoine,
  élections, bibliothèque, VOD, formations continues, helpdesk ;
- **Portail étudiant** et **rectorat**, plus les briques transverses :
  authentification, référentiel, paramètres, imports, audit, notifications SMS.

Contraintes durables : français (langue de référence) et anglais ; Android bas de
gamme et petits écrans en priorité ; fonctionnement hors ligne du pointage ;
**l'enseignant est en lecture seule** ; l'attestation se donne uniquement en
salle, sur l'appareil du contrôleur. Le capteur d'empreinte d'un téléphone ne sait
reconnaître que les doigts enregistrés dans l'appareil : l'empreinte passe donc
obligatoirement par un lecteur dédié relié au poste de contrôle. Une année
académique close interdit toute écriture rattachée.

## Brand Commitments

Nom : **University**. Couleurs : rouge, jaune et vert — les couleurs nationales,
employées légèrement, réservées aux états relevés (assuré, retard, absence).
Langue : français, registre administratif clair, jamais familier ; l'anglais
traduit le même registre. Vocabulaire métier à préserver tel quel : contrôleur,
séance, pointage, attestation, registre, vacataire, promotion, créneau,
justificatif, délibération, recette, campus.

## Evidence on Hand

- Déployé et fonctionnel : <https://university.naimba.com> (API
  `university-api.naimba.com/api`).
- Code : `frontend/` (Quasar 2 / Vue 3), `backend/` (NestJS 11 / Prisma /
  PostgreSQL), `biometrie/` (passerelle lecteur d'empreintes).
- Jeu de démonstration **synthétique et assumé comme tel** : université guinéenne
  type, 4 départements, 10 enseignants, 6 semaines de contrôles. Aucun
  établissement client, aucun chiffre d'adoption, aucun tarif n'existe : ne rien
  inventer de tel.
- Prospect en cours : une université en Guinée (Kankan). Rien n'est signé.

## Product Principles

1. **Le terrain d'abord, le bureau ensuite.** La tournée commande : tout ce qui
   n'aide pas à pointer la salle suivante passe après. Hors ligne, lenteur réseau
   et appareils modestes sont la norme, pas le cas dégradé. Le reste de
   l'administration est l'administration du produit.
2. **Un geste, deux signatures, un seul appareil.** Le constat du contrôleur et
   l'attestation de l'enseignant sont un seul moment, en salle, sur l'appareil du
   contrôleur. Rien ne se signe à distance, rien ne se déclare après coup.
3. **Lisible à bout de bras, utilisable à une main.** Grands objets tactiles,
   contraste de plein jour, actions à portée du pouce — au guichet comme dans
   l'amphi.
4. **Un seul référentiel, plusieurs métiers.** Présences, scolarité, finances et
   campus parlent des mêmes années, des mêmes promotions et des mêmes
   enseignants : une donnée saisie une fois ne se ressaisit pas.
5. **Ce qui est consigné est opposable.** Horodatage serveur, moyen d'attestation
   consigné, corrections tracées, journal d'audit : le dossier numérique doit
   tenir devant une contestation.

## Accessibility & Inclusion

Lecture en plein soleil sur écran bon marché : contraste élevé exigé (AA au
minimum, AAA sur les textes de la feuille de contrôle). Cibles tactiles d'au moins
48 px. Aucune information portée par la seule couleur — les statuts portent une
forme ou un mot. Interface en français et en anglais, sans état d'exception
propre à l'une des deux langues.

<!-- Faits déduits du dépôt et de la conversation avec le commanditaire plutôt que
     d'un entretien dédié : l'entretien a été remplacé par cette inférence sur
     instruction explicite de l'utilisateur (directive de but « ne pas s'arrêter pour
     demander »). Tout est vérifiable dans le code et l'historique du projet. -->
