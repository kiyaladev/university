# Biométrie

> **Statut : prototype.** La passerelle de `biometrie/` fonctionne avec un
> **simulateur** de lecteur ; aucun lecteur réel n'a encore été branché ni
> qualifié. Le mode de fonctionnement retenu sur le terrain est l’application
> Android avec lecteur USB-OTG ([android.md](android.md)).

L’enseignant atteste sa présence devant le contrôleur par l’un de trois moyens :
empreinte, code personnel ou signature manuscrite (paramètre
`ATTESTATION_OBLIGATOIRE`). L’empreinte est le plus fort, mais demande un
lecteur dédié : **le capteur d’un téléphone ne reconnaît que les doigts
enregistrés par son propriétaire**, jamais ceux d’un tiers.

## Deux chemins de preuve

| Chemin | Où tourne la lecture | Signature du résultat | Statut |
| --- | --- | --- | --- |
| Application Android + lecteur USB-OTG | dans l’APK (`LecteurMantra.java`, repli sur un lecteur simulé sans SDK) | HMAC-SHA256 avec la **clé propre de l’appareil**, obtenue à l’enrôlement (`POST /attestation/appareils`), révocable (`DELETE /attestation/appareils/:id`) | chaîne complète, matériel réel non qualifié |
| Passerelle locale `biometrie/` | service Bun sur le poste du contrôleur | HMAC-SHA256 avec la **clé propre de l’appareil** si le poste est enrôlé, sinon avec le secret partagé `BIOMETRIE_SECRET` | prototype, simulateur uniquement |

L’API rejette tout résultat mal signé, périmé de plus de 5 minutes, comparé à un
autre gabarit que celui enrôlé, ou dont le score est sous `EMPREINTE_SCORE_MIN`
(60 par défaut). En production, si `BIOMETRIE_SECRET` est absent ou vaut la
valeur d’exemple, le chemin passerelle est désactivé (erreur 400) ; les
appareils enrôlés gardent leur clé propre.

Une preuve acceptée est **consommée** : elle est inscrite au registre
`PreuveConsommee`, et la même preuve présentée une seconde fois est refusée
(409). Sans ce registre, une preuve interceptée restait rejouable pendant les
cinq minutes de sa fenêtre d’acceptation, sur le même poste. Voir
« Anti-rejeu côté API » plus bas.

Les gabarits sont chiffrés au repos (`BIOMETRIE_CHIFFREMENT_CLE`) et purgés
après `BIOMETRIE_CONSERVATION_JOURS` (90) jours de fiche désactivée, par une
tâche planifiée qui écrit l’effacement et sa trace dans la même transaction.
L’image du doigt n’est jamais transmise ni stockée.

## La passerelle `biometrie/`

```bash
cd biometrie
bun install --frozen-lockfile
PORT=5045 bun run start                                        # poste sans appareil enrôlé
BIOMETRIE_CONFIG=~/.config/university/biometrie.json bun run start   # poste enrôlé
```

> **Conflit de port sur ce serveur.** Le port par défaut **5044** est déjà
> occupé ici par un autre service (`decision-gateway`, géré par PM2). Lancer la
> passerelle sans `PORT` échoue. Choisir un port libre et l’indiquer dans
> l’application : l’URL de la passerelle se règle côté navigateur (clé
> `unipresence_biometrie_url` du stockage local, défaut `http://127.0.0.1:5044`
> dans `frontend/src/shared/utils/biometrie.ts`).

| Route | Rôle |
| --- | --- |
| `GET /etat` | le lecteur est-il prêt ? (l’écran de pointage l’interroge) |
| `POST /enroler` `{enseignantId}` | capture le doigt de référence → gabarit signé |
| `POST /verifier` `{enseignantId, gabarit}` | compare le doigt posé au gabarit → score signé |

### Signature : le chemin « appareil »

La passerelle signe désormais comme l’application Android : **une clé par
poste**, obtenue à l’enrôlement (`POST /attestation/appareils`), révocable
individuellement (`DELETE /attestation/appareils/:id`) et traçable. La charge
nomme l’appareil, si bien qu’un résultat produit par un autre poste ne peut
pas être présenté comme le sien.

```
enrôlement   = HMAC_SHA256(clé appareil, "enrolement|<appareilId>|<enseignantId>|<gabarit>|<horodatage>")
vérification = HMAC_SHA256(clé appareil, "verification|<appareilId>|<enseignantId>|<empreinte>|<score>|<horodatage>")
```

L’empreinte est le SHA-256 du gabarit comparé : elle entre dans la signature
pour que l’API vérifie que la comparaison a porté sur le gabarit qu’elle a
enrôlé.

**Sans appareil configuré**, la passerelle garde l’ancien chemin : elle signe
avec le secret partagé `BIOMETRIE_SECRET`, sans `appareilId` dans la charge,
et prévient au démarrage. Ce chemin est refusé par l’API en production tant
que le secret vaut la valeur d’exemple.

L’enrôlement du poste se fait avec la session du contrôleur :

```bash
cd biometrie
BIOMETRIE_JETON=<jeton de session> bun run scripts/enroler-appareil.ts "Poste A -/U1"
```

Le script écrit `~/.config/university/biometrie.json` — **hors du dépôt**, en
permissions `600`. La passerelle refuse de démarrer si le fichier est lisible
par un autre compte de la machine, ou s’il se trouve dans le dépôt.

### Anti-rejeu côté API

La signature d’une lecture est un **authentificateur** : rejouée telle quelle,
elle ferait passer un pointage sans nouvelle lecture du doigt. L’API tient
donc un registre des preuves déjà consommées (`PreuveConsommee`), et chaque
preuve acceptée y est inscrite.

| Élément | Rôle |
| --- | --- |
| `cle` (unique) | ce qui identifie la preuve : `nonce:<tentativeId>` quand la charge signée porte le nonce de la tentative, sinon `signature:<empreinte SHA-256>` |
| `enseignantId`, `appareilId`, `score` | qui a produit la preuve, sur quel poste — jamais de biométrie |
| `expireLe` | fin de la fenêtre pendant laquelle la preuve aurait pu être rejouée |

- **Rejeu refusé** : la présentation d’une preuve déjà consommée répond **409**
  (« Preuve déjà utilisée »). Deux lectures distinctes restent acceptées :
  leur signature diffère, donc leur empreinte diffère.
- **Purge** : une tâche planifiée (toutes les 10 minutes) efface les entrées
  dont la fenêtre est passée. Le registre ne garde que ce qui peut encore être
  rejoué.
- **Écriture** : l’inscription de la consommation part dans la transaction du
  pointage (`verifierPreuves(…, tx)`), pour que la preuve consommée et le
  contrôle écrit forment un seul fait.
- **Compatibilité** : une passerelle ancienne, qui ne signe pas de nonce,
  continue de fonctionner — l’empreinte de la signature identifie alors la
  preuve.

**Nonce de tentative.** La passerelle reçoit déjà un `tentativeId` (elle
refuse 409 une tentative déjà traitée). Pour que ce nonce serve aussi côté
API, il doit être **signé** : la charge de vérification porte alors le nonce
en fin de charge, ou juste avant l’horodatage — l’API accepte les deux formes,
et ne retient le nonce que si la signature le couvre.

```
vérification avec nonce = HMAC_SHA256(clé appareil, "verification|<appareilId>|<enseignantId>|<empreinte>|<score>|<horodatage>|<tentativeId>")
vérification sans nonce  = HMAC_SHA256(clé appareil, "verification|<appareilId>|<enseignantId>|<empreinte>|<score>|<horodatage>")
```

> Le nonce reste lui aussi une preuve à usage unique : changer le
> `tentativeId` sans la clé ne produit plus une signature valide, et l’API
> refuse (400) une preuve dont la charge ne correspond pas.

### Sécurité de la passerelle

| Garde-fou | Mise en œuvre |
| --- | --- |
| Écoute locale | `127.0.0.1` seulement |
| Origine restreinte | origine déclarée dans `origines` ; une origine inconnue reçoit `403` |
| Secret d’appareil | fichier hors dépôt, permissions `600` vérifiées |
| Anti-rejeu | une charge déjà signée n’est plus signée ; une tentative déjà traitée reçoit `409` |
| Pas de cache | `Cache-Control: no-store` |

> L’anti-rejeu de la passerelle empêche qu’une *même* lecture produise
> plusieurs preuves. Il ne vaut pas nonce côté API : **une preuve interceptée
> reste rejouable pendant sa fenêtre d’acceptation de cinq minutes.** Voir
> « Reste à faire » ci-dessous.

### Variables

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | 5044 (ou celui du fichier) | port d’écoute local (**à changer sur ce serveur**) |
| `BIOMETRIE_CONFIG` | `~/.config/university/biometrie.json` | configuration de l’appareil (hors dépôt, 600) |
| `BIOMETRIE_SECRET` | — | secret partagé de l’ancien chemin ; ignoré si un appareil est configuré |
| `ORIGINES` | `https://university.naimba.com` | origines autorisées |
| `SCORE_MIN` | 60 | seuil affiché par la passerelle |
| `BIOMETRIE_PILOTE` | `simulateur` | pilote de lecture |
| `DOIGT_SIMULE` | — | `inconnu` pour simuler un doigt non reconnu |

Pour brancher un vrai lecteur : implémenter `initialiser`, `capturer`,
`comparer` dans `biometrie/src/pilotes/<constructeur>.ts` (contrat dans
`src/pilote.ts`, exemple complet dans `src/pilotes/simulateur.ts`), l’enregistrer
dans `src/pilotes/index.ts`, puis lancer avec `BIOMETRIE_PILOTE=<nom>`.
Constructeurs envisagés : SecuGen, ZKTeco, DigitalPersona, Mantra, Futronic.
Détails dans [biometrie/README.md](../biometrie/README.md).

## Reste à faire

Voir [suivi.md](suivi.md) : qualification sur lecteur réel (Mantra MFS100 ou
autre), durée de conservation à valider par les RH, protocole anti-rejeu hors
ligne pour une empreinte seule (aujourd’hui refusée après 5 minutes de coupure),
écran d’administration des appareils enrôlés.

Deux points sideurs, signalés à l'API :

1. **Nonce signé par la passerelle.** L’API tient désormais le registre des
   preuves consommées (voir « Anti-rejeu côté API »), et refuse 409 une preuve
   déjà consommée. Reste à faire côté passerelle : signer le `tentativeId`
   dans la charge de vérification, pour que le nonce — et non l’empreinte de la
   signature — identifie la preuve. Tant que la passerelle ne le signe pas,
   l’API s’appuie sur l’empreinte de la signature, ce qui convient déjà.
2. **Horloge.** La tolérance de 60 secondes est le filet de sécurité d’un
   poste désynchronisé. Un poste de contrôle hors ligne accumule une dérive
   que rien ne rattrape aujourd’hui.
