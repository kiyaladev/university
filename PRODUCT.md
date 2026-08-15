# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Le contrôleur pédagogique** est l'utilisateur premier, et sa situation dicte tout :
il circule d'une salle à l'autre pendant les heures de cours, **debout, une main
occupée**, entre dans un amphi ou une salle en cours de séance, constate qui enseigne,
fait signer ou scanner l'enseignant, et repart vers la salle suivante. Il travaille sur
un téléphone Android d'entrée de gamme, souvent en pleine lumière, parfois sans réseau.
Sa tournée dure une demi-journée et enchaîne 10 à 30 salles.

**L'enseignant** intervient trente secondes par séance : devant le contrôleur, sur
l'appareil de celui-ci, il signe, compose son code personnel ou pose le doigt sur le
lecteur — puis reprend son cours. **Il ne consigne jamais rien lui-même** : ni son
heure, ni sa présence, ni un justificatif. Son compte est en consultation seule, pour
lire ses séances et son relevé.

**La direction des études, la scolarité et les chefs de département** exploitent les
données au bureau : assiduité, volume horaire réalisé, paiement des vacataires,
registre imprimé à signer et archiver.

## Product Purpose

UniPrésence remplace le registre papier du contrôleur dans les universités. Aujourd'hui
un agent passe dans les salles avec un cahier où il note à la main le nom de
l'enseignant, la matière déroulée et la durée de la séance. Ce cahier ne se totalise
pas, se perd, se recopie, et n'oppose rien à une signature ajoutée après coup.

Le produit réussit quand le contrôleur préfère le téléphone au cahier — donc quand
pointer une salle prend moins de temps qu'écrire une ligne — et quand la direction
peut sortir, sans ressaisie, l'assiduité par enseignant, les heures réellement
assurées et l'état de paiement des vacataires.

## Positioning

Le pointage est **contradictoire et non déclaratif** : le contrôleur relève tout, et
l'enseignant atteste dans le même geste, en salle, sur l'appareil du contrôleur, par un
moyen daté et opposable (signature reproduite au registre, code personnel, empreinte).
Personne ne peut consigner sa propre présence : c'est ce qui distingue ce registre d'un
logiciel de gestion scolaire, où l'enseignant déclare ses heures.

## Operating Context

- **La tournée** : une feuille de route des séances du jour, salle par salle, dans
  l'ordre des heures. Le contrôleur ne cherche pas, il descend sa liste.
- **La salle** : entrée en cours de séance, bruit, lumière du jour, lecture à bout de
  bras. L'échange avec l'enseignant doit tenir en un geste et ne pas interrompre le
  cours.
- **Le réseau** : intermittent dans les amphis. Les pointages se font hors ligne et se
  synchronisent au retour du réseau.
- **Le papier ne disparaît pas** : le registre journalier, la fiche d'assiduité et
  l'état de paiement s'impriment en A4 pour être signés et tamponnés par le
  département et la direction. L'administration valide sur papier signé.
- **La preuve du passage** : QR affiché à l'entrée de chaque salle, position GPS
  optionnelle, horodatage serveur, journal d'audit des corrections.
- **La séparation des rôles** : le contrôleur consigne, la scolarité administre les
  moyens d'attestation et enregistre les justificatifs sur pièce, la direction arbitre,
  l'enseignant consulte. Aucune écriture n'est ouverte au compte enseignant.

## Capabilities and Constraints

Année académique, départements, filières, promotions, salles, enseignants, matières,
charges d'enseignement ; emploi du temps hebdomadaire avec détection de conflits et
génération des séances ; feuille de contrôle et pointage ; attestation de l'enseignant
en salle (trois moyens) ; justificatifs d'absence avec arbitrage ; rapports d'assiduité, volume
horaire, état de paiement des vacataires ; impressions A4 et exports CSV ; six rôles.

Contraintes durables : français ; Android bas de gamme et petits écrans en priorité ;
fonctionnement hors ligne du pointage ; **l'enseignant est en lecture seule** ;
l'attestation se donne uniquement en salle, sur l'appareil du contrôleur. Le capteur
d'empreinte d'un téléphone ne sait reconnaître que les doigts enregistrés dans
l'appareil : l'empreinte passe donc obligatoirement par un lecteur dédié relié au poste
de contrôle.

## Brand Commitments

Nom : **UniPrésence**. Couleurs : rouge, jaune et vert — les couleurs nationales,
employées légèrement, réservées aux états relevés (assuré, retard, absence). Langue :
français, registre administratif clair, jamais familier. Vocabulaire métier à préserver tel quel : contrôleur, séance, pointage,
attestation, registre, vacataire, promotion, créneau, justificatif.

## Evidence on Hand

- Déployé et fonctionnel : <https://presence.naimba.com> (API `presence-api.naimba.com`).
- Code : `frontend/` (Quasar 2 / Vue 3), `backend/` (NestJS 11 / Prisma / PostgreSQL),
  `biometrie/` (passerelle lecteur d'empreintes).
- Jeu de démonstration **synthétique et assumé comme tel** : université guinéenne type,
  4 départements, 10 enseignants, 6 semaines de contrôles. Aucun établissement client,
  aucun chiffre d'adoption, aucun tarif n'existe : ne rien inventer de tel.
- Prospect en cours : une université en Guinée (Kankan). Rien n'est signé.

## Product Principles

1. **La tournée commande.** Tout ce qui n'aide pas à pointer la salle suivante passe
   après. L'écran de contrôle est le produit ; le reste est l'administration du produit.
2. **Un geste, deux signatures, un seul appareil.** Le constat du contrôleur et
   l'attestation de l'enseignant sont un seul moment, en salle, sur l'appareil du
   contrôleur. Rien ne se signe à distance, rien ne se déclare après coup.
3. **Lisible à bout de bras, utilisable à une main.** Grands objets tactiles, contraste
   de plein jour, actions à portée du pouce.
4. **Le terrain d'abord, le bureau ensuite.** Hors ligne, lenteur réseau et appareils
   modestes sont la norme, pas le cas dégradé.
5. **Ce qui est consigné est opposable.** Horodatage serveur, moyen d'attestation
   consigné, corrections tracées : le registre numérique doit tenir devant une
   contestation.

## Accessibility & Inclusion

Lecture en plein soleil sur écran bon marché : contraste élevé exigé (AA au minimum,
AAA sur les textes de la feuille de contrôle). Cibles tactiles d'au moins 48 px.
Aucune information portée par la seule couleur — les statuts portent une forme ou un
mot. Interface entièrement en français.

<!-- Faits déduits du dépôt et de la conversation avec le commanditaire plutôt que
     d'un entretien dédié : l'entretien a été remplacé par cette inférence sur
     instruction explicite de l'utilisateur (directive de but « ne pas s'arrêter pour
     demander »). Tout est vérifiable dans le code et l'historique du projet. -->
