# Passerelle biométrique UniPrésence

Petit service local qui fait le pont entre un **lecteur d'empreintes** et
l'application. Il tourne sur l'appareil du contrôleur, jamais sur le serveur :
le doigt est lu là où se trouve l'enseignant.

```bash
cd biometrie
BIOMETRIE_SECRET="le-meme-que-l-api" bun run start     # http://127.0.0.1:5044
```

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
signature = HMAC_SHA256(secret, "verification|<enseignantId>|<score>|<horodatage>")
```

L'API rejette tout résultat mal signé, périmé de plus de 5 minutes, ou dont le
score est inférieur au paramètre `EMPREINTE_SCORE_MIN`.

**Ce qui circule** : un gabarit (minuties encodées) et un score. **Jamais**
l'image du doigt — elle n'est ni transmise ni stockée.

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

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 5044 | port d'écoute local |
| `BIOMETRIE_SECRET` | — | **doit être identique** à celui de l'API |
| `ORIGINES` | `*` | origines autorisées à appeler la passerelle |
| `SCORE_MIN` | 60 | seuil de correspondance affiché par la passerelle |
| `DOIGT_SIMULE` | — | `inconnu` pour simuler un doigt non reconnu |
