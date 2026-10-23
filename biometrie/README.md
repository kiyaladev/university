# Passerelle biométrique University (prototype)

Petit service local qui fait le pont entre un **lecteur d'empreintes** et
l'application. Il tourne sur l'appareil du contrôleur, jamais sur le serveur :
le doigt est lu là où se trouve l'enseignant.

```bash
cd biometrie
BIOMETRIE_SECRET="le-meme-que-l-api" bun run start     # http://127.0.0.1:5044
```

> **État : simulateur seulement.** Le seul pilote livré est un simulateur ;
> aucun lecteur réel n'a encore été branché ni qualifié. La passerelle ne
> prouve donc rien en l'état : elle sert à dérouler la chaîne complète
> (enrôlement, vérification, refus d'un doigt inconnu) et à préparer le
> branchement d'un constructeur. Le mode de fonctionnement retenu sur le
> terrain est l'application Android avec lecteur USB-OTG
> ([docs/android.md](../docs/android.md)).
>
> Sur le serveur de production, le port 5044 est déjà pris par un autre
> service : lancer avec `PORT=<libre>`.
> Vue d'ensemble et statut : [docs/biometrie.md](../docs/biometrie.md).

## Pourquoi une passerelle plutôt que le navigateur

Aucun navigateur ne sait piloter un lecteur d'empreintes ni comparer deux
gabarits : cela demande le SDK du constructeur. La passerelle isole ce SDK et
n'expose que trois routes.

| Route | Rôle |
|---|---|
| `GET /etat` | le lecteur est-il prêt ? (l'écran de pointage l'interroge) |
| `POST /enroler` `{enseignantId}` | capture le doigt de référence → gabarit signé |
| `POST /verifier` `{enseignantId, template}` | compare le doigt posé au gabarit → score signé |

## Le point important : la signature HMAC

Sans elle, n'importe qui pourrait appeler l'API en prétendant « empreinte
reconnue, score 99 ». La passerelle signe donc chaque résultat avec un secret
partagé avec l'API (`BIOMETRIE_SECRET`, identique des deux côtés) :

```
enrôlement   = HMAC_SHA256(secret, "enrolement|<enseignantId>|<gabarit>|<horodatage>")
vérification = HMAC_SHA256(secret, "verification|<enseignantId>|<empreinte du gabarit>|<score>|<horodatage>")
```

L'**empreinte du gabarit** est le SHA-256 du gabarit comparé. Elle entre dans
la signature pour que l'API vérifie que la comparaison a bien porté sur le
gabarit qu'elle a enrôlé, et non sur un gabarit fourni par le client : sans
elle, un client pourrait faire comparer un doigt à un gabarit de son choix.

L'API rejette tout résultat mal signé, périmé de plus de 5 minutes, ou dont le
score est inférieur au paramètre `EMPREINTE_SCORE_MIN`.

**Ce qui circule** : un gabarit (minuties encodées) et un score. **Jamais**
l'image du doigt — elle n'est ni transmise ni stockée.

## Pas d'appareil : le chemin du secret partagé

La passerelle **n'envoie pas d'`appareilId`** : elle n'a pas de clé propre à
une machine, seulement le secret partagé `BIOMETRIE_SECRET`. Côté API, une
preuve biométrique sans `appareilId` est donc vérifiée avec ce secret
partagé — c'est le chemin prévu pour un poste fixe.

Le chemin **par appareil** (une clé distincte par téléphone, révocable
individuellement, `POST /attestation/appareils`) est réservé à l'application
Android : c'est le greffon natif qui connaît l'identifiant d'appareil et
signe avec la clé conservée dans le coffre chiffré d'Android. Voir
[docs/android.md](../docs/android.md).

Conséquence pratique : le secret partagé vit dans `backend/.env` sur le
serveur. Il protège les preuves biométriques du chemin passerelle ; il doit
donc être traité comme un secret, et l'API refuse en production une valeur
absente ou égale à la valeur d'exemple.


## Brancher un vrai lecteur

Le fichier `src/pilote.ts` définit le contrat à remplir ; `src/pilotes/simulateur.ts`
en donne une implémentation complète qui sert aux démonstrations et aux tests.
Pour passer au matériel réel, écrivez `src/pilotes/<constructeur>.ts` avec les
trois méthodes `initialiser`, `capturer`, `comparer`, puis changez la ligne
`const pilote = new PiloteSimulateur()` dans `src/index.ts`.

Lecteurs courants et abordables en Afrique de l'Ouest : ZKTeco SLK20R / Live20R,
SecuGen Hamster Pro, Futronic FS80H, Mantra MFS100 (60–150 $ pièce). Tous
fournissent un SDK Windows/Linux, et ZKTeco comme Mantra proposent aussi un SDK
Android — ce qui permet de faire tourner la passerelle **sur le téléphone du
contrôleur via Termux**, avec le lecteur branché en OTG.

## Mode simulateur

Par défaut la passerelle reproduit le gabarit attendu : la vérification réussit,
ce qui permet de dérouler la démonstration complète. Pour montrer le refus d'un
doigt qui n'est pas celui de l'enseignant :

```bash
DOIGT_SIMULE=inconnu bun run start
```

Tant que le pilote est le simulateur, un résultat signé ne prouve **aucune**
présence : le simulateur rejoue le gabarit qu'on lui demande de comparer.

## Vérification

```bash
cd biometrie && bun install --frozen-lockfile && bun run typecheck
```

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 5044 | port d'écoute local |
| `BIOMETRIE_SECRET` | — | **doit être identique** à celui de l'API |
| `ORIGINES` | `*` | origines autorisées à appeler la passerelle |
| `SCORE_MIN` | 60 | seuil de correspondance affiché par la passerelle |
| `DOIGT_SIMULE` | — | `inconnu` pour simuler un doigt non reconnu |
