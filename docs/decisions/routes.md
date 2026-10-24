# Routes sans appelant : décisions

Revue du lot 7 (branche `mc7/endpoints`). Pour chaque route candidate de la
liste « jamais appelée par le frontend », on a cherché l'appelant réel — le
front, les tests, mais aussi les **scripts de recette** de `backend/scripts/`.
Une route servie par une recette ne se supprime pas : la recette est un client
comme un autre.

Trois issues possibles :

- **BRANCHER** — l'écran existe déjà et la fonction a une valeur évidente ;
  on cable l'appel.
- **SUPPRIMER** — doublon d'une autre route, ou sans usage : route, service et
  tests associés disparaissent.
- **GARDER** — pas d'appelant front, mais une recette ou un script s'en sert :
  la route reste en place, telle quelle.

## Tableau des décisions

| Route | Appelant trouvé | Décision |
| --- | --- | --- |
| `GET /rectorat/dashboard` | aucun | SUPPRIMER |
| `GET /seances/mes-seances` | aucun | SUPPRIMER |
| `GET /documents/populaires` | aucun | BRANCHER |
| `GET /vod/recherche` | recette VOD | GARDER |
| `GET /vod/:id/stats` | recette VOD | BRANCHER |
| `POST /cartes-etudiantes/:id/verifier-nip` | recette validité identité | GARDER |
| `DELETE /creneaux/:id` | aucun | BRANCHER |
| `GET /patrimoine/equipements/par-qr/:qrCode` | recette modules pilotes | GARDER |
| `GET /resto/carte/:reference` | recette restaurant | GARDER |
| `GET /resto/portefeuille/me` | aucun | SUPPRIMER |
| `GET /resto/portefeuille/:etudiantId` | aucun | SUPPRIMER |
| `POST /resto/recharges/:id/simuler` | recette restaurant | GARDER |
| `GET /export/*` | `RapportsPage.vue` | GARDER (déjà branché) |

## Les suppressions

### `GET /rectorat/dashboard` — SUPPRIMER

Doublon strict de `GET /rectorat/chiffres`. La méthode de service
`dashboardRapide()` comptait l'effectif, les réclamations en cours, les
incidents d'aide sous 24 h et les équipements obsolètes ; `chiffres()` rend
exactement ces quatre compteurs, avec en plus le détail par promotion et par
filière. La page Rectorat consomme déjà `chiffres`. La route, le service et
ses deux tests (`rectorat.aggregats.spec.ts`) sont retirés ; le cas «
dashboard » disparaît aussi du test de rôles (`rectorat.controller.spec.ts`).

### `GET /seances/mes-seances` — SUPPRIMER

Doublon de `GET /seances` filtré sur `enseignantId`, dont le frontend se sert
déjà via `seancesService.liste`. L'écran « Mes séances » ne l'utilisait pas :
il passe par `/rapports/ma-fiche`, qui renvoie la fiche de l'enseignant pour
la semaine demandée. Deux chemins pour la même donnée, un seul conservé.

### `GET /resto/portefeuille/me` — SUPPRIMER

Doublon exact de `GET /portail/resto/me` : même service
(`monPortefeuille`), même rendu (portefeuille créé s'il est absent), même
public (étudiant). Le portail est l'interface de l'étudiant ; cette route
n'avait rien d'appoint.

### `GET /resto/portefeuille/:etudiantId` — SUPPRIMER

Détail d'un dossier étudiant côté restauration, sans appelant : ni le front,
ni la recette. Les écrans de gestion travaillent sur la liste des
portefeuilles (`GET /resto/portefeuilles`) et sur le rechargement
(`POST /resto/portefeuilles/:id/recharger`). Le service
`detailPortefeuille()` part avec elle.

## Les branchements

### `GET /documents/populaires` — BRANCHER

La vitrine publique de la bibliothèque (`BibliothequePubliquePage.vue`) s'ouvre
sur une recherche vide : le visiteur ne sait pas encore quoi demander. La
section « Les plus téléchargés » lui donne un point d'entrée et montre ce que
le fonds a de plus accessible. La section s'efface dès qu'un filtre parle
(recherche, type, département) pour ne pas doubler la liste.

L'appel est silencieux : si la route échoue, la vitrine reste utilisable.

> Note : le serveur n'envoie jamais la charge utile du fichier (`fichier` est
> omis des réponses). Le bouton de téléchargement s'appuie donc sur les
> métadonnées (`typeMime`, `tailleKo`) et non sur `doc.fichier`.

### `GET /vod/:id/stats` — BRANCHER

L'écran VOD affichait le nombre de vues dans une colonne, sans jamais
interroger le détail que le serveur sait calculer : vues, lectures
complètes, taux de complétion, durée moyenne et dernières vues. Le panneau
`DialogueStatsVod.vue` ouvre ces chiffres.

Le bouton n'apparaît que pour qui peut déjà agir sur la ressource
(`peutGererRessource`), ce qui reprend exactement la règle du serveur :
l'administration voit toutes les ressources, un enseignant seulement celles
qu'il a créées.

### `DELETE /creneaux/:id` — BRANCHER

L'emploi du temps (`EmploiDuTempsPage.vue`) savait créer et modifier un
créneau, jamais le retirer : la ligne hebdomadaire restait à l'écran, seule
jusqu'à l'année suivante. La suppression est portée par le dialogue du
créneau, avec confirmation explicite avant l'appel.

Le serveur refuse la suppression quand l'année est close
(`exigerAnneeOuverte`) ; le motif est affiché dans le bandeau du dialogue,
comme pour l'enregistrement.

## Les routes gardées

Ces routes n'ont pas d'appelant front, mais une recette s'en sert : les
supprimer casserait la recette. Elles restent en place, inchangées.

- `GET /vod/recherche` — `backend/scripts/recette-vod.cjs`. La recherche plein
  texte porte sur la transcription ; le catalogue `/vod?search=` ne cherche
  que le titre et la description. La route est conservée telle quelle, et le
  catalogue garde son filtre `search` (c'est lui que l'écran VOD utilise).
- `GET /vod/:id/stats` — utilisée par la recette VOD ; elle est en plus
  branchée au front (voir plus haut).
- `POST /cartes-etudiantes/:id/verifier-nip` — `recette-validite-identite.cjs`
  vérifie le NIP d'une carte contre la fiche étudiante.
- `GET /patrimoine/equipements/par-qr/:qrCode` — `recette-modules-pilotes.cjs`
  résout un équipement scanné. La route est publique : elle sert au lecteur
  de QR code, pas à l'IHM.
- `GET /resto/carte/:reference` — `recette-restaurant.cjs` : lecture de la
  carte au guichet de la restauration.
- `POST /resto/recharges/:id/simuler` — `recette-restaurant.cjs` : simulation
  d'une recharge avant validation.

## L'export CSV

`GET /export/*` (`rapports/export.controller.ts`) est **déjà branché** : la
page Rapports (`RapportsPage.vue`) construit `/export/${suffix}` et télécharge
le fichier via `telechargerFichier()`, qui porte l'en-tête
`Authorization` — `window.open` ne le peut pas. Les quatre exports
(`presence-enseignants`, `volume-horaire`, `etat-paiement`, `registre`) sont
donc consommés côté front. Aucune décision à prendre, et surtout aucune
suppression : le CSV serveur produit la liste complète, là où le front ne
travaille que sur la page affichée.
