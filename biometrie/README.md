# Passerelle biométrique University

Service local qui fait le pont entre un **lecteur d'empreintes** et
l'application. Il tourne sur l'appareil du contrôleur, jamais sur le serveur :
le doigt est lu là où se trouve l'enseignant.

> **État : simulateur seulement.** Le seul pilote livré est un simulateur ;
> aucun lecteur réel n'a encore été branché ni qualifié. La passerelle ne
> prouve donc rien en l'état : elle sert à dérouler la chaîne complète
> (enrôlement, vérification, refus d'un doigt inconnu) et à préparer le
> branchement d'un constructeur. Le mode de fonctionnement retenu sur le
> terrain est l'application Android avec lecteur USB-OTG
> ([docs/android.md](../docs/android.md)).
>
> Vue d'ensemble et statut : [docs/biometrie.md](../docs/biometrie.md).

## Installation sur un poste

```bash
cd biometrie
bun install --frozen-lockfile
```

Le service se lance avec :

```bash
bun run start                                   # port 5044
PORT=5045 bun run start                         # port libre
BIOMETRIE_CONFIG=~/.config/university/biometrie.json bun run start
```

> **Le port 5044 est déjà pris sur le serveur de production** (autre service
> géré par PM2) : sur cette machine, lancer avec `PORT=5045` (ou toute autre
> valeur libre) et régler la même valeur dans l'application
> (clé `unipresence_biometrie_url` du stockage local du navigateur).

## Deux modes de signature

La passerelle signe ses résultats : sans signature, n'importe qui pourrait
appeler l'API en prétendant « empreinte reconnue, score 99 ». L'API choisit la
clé de vérification selon l'`appareilId` que la passerelle renvoie.

### Mode appareil — une clé par poste (recommandé)

Chaque poste de contrôle a sa propre clé, révocable individuellement
(`DELETE /attestation/appareils/:id`) et traçable. C'est le chemin que
l'application Android utilise déjà ; la passerelle s'y aligne.

**Enrôler le poste** (une session de contrôleur suffit, c'est elle qui
autorise l'appareil) :

```bash
cd biometrie
BIOMETRIE_JETON=<jeton de session> bun run scripts/enroler-appareil.ts "Poste A -/U1"
```

Le script écrit `~/.config/university/biometrie.json` — **hors du dépôt**, en
permissions `600` :

```json
{
  "appareilId": "3f2b6c1a-9d4e-4a71-8c2f-0b5a7e9d1c33",
  "secret": "…64 caractères hexadécimaux…",
  "port": 5045,
  "origines": ["https://university.naimba.com"],
  "scoreMin": 60
}
```

La clé n'est jamais affichée ni journalisée : elle est écrite directement
dans le fichier. Le fichier ne doit jamais être versionné — la passerelle
refuse de démarrer s'il se trouve dans le dépôt, ou s'il est lisible par un
autre compte de la machine (`chmod 600`).

### Mode secret partagé — l'ancien chemin

Sans fichier d'appareil, la passerelle signe avec le secret partagé
`BIOMETRIE_SECRET` : c'est l'ancien chemin, conservé pour les postes non
enrôlés. Elle le signale au démarrage :

```
[biometrie] Aucun appareil configuré : la passerelle signe avec le secret
partagé BIOMETRIE_SECRET, commun à tous les postes. Ce chemin ne permet ni
révocation individuelle ni traçabilité du poste ; préférez un appareil enrôlé.
```

Et si `BIOMETRIE_SECRET` est absent, elle utilise la valeur d'exemple, que
l'API **refuse en production** — elle le dit aussi.

## Ce que signe la passerelle

Le format des charges signées est imposé par l'API : elle les reconstruit
caractère par caractère. La passerelle suit exactement le même format.

```
enrôlement   = HMAC_SHA256(clé, "enrolement|<appareilId>|<enseignantId>|<gabarit>|<horodatage>")
vérification = HMAC_SHA256(clé, "verification|<appareilId>|<enseignantId>|<empreinte>|<score>|<horodatage>")
```

Sans appareil, l'`appareilId` est omis de la charge :

```
enrôlement   = HMAC_SHA256(secret, "enrolement|<enseignantId>|<gabarit>|<horodatage>")
vérification = HMAC_SHA256(secret, "verification|<enseignantId>|<empreinte>|<score>|<horodatage>")
```

L'**empreinte** est le SHA-256 du gabarit comparé. Elle entre dans la
signature pour que l'API vérifie que la comparaison a bien porté sur le
gabarit qu'elle a enrôlé, et non sur un gabarit fourni par le client : sans
elle, un client pourrait faire comparer un doigt à un gabarit de son choix.

L'API rejette tout résultat mal signé, périmé de plus de 5 minutes (tolérance
de 60 secondes sur l'horloge), ou dont le score est inférieur au paramètre
`EMPREINTE_SCORE_MIN`.

**Ce qui circule** : un gabarit (minuties encodées) et un score. **Jamais**
l'image du doigt — elle n'est ni transmise ni stockée.

## Routes

| Route | Rôle |
|---|---|
| `GET /etat` | le lecteur est-il prêt ? (l'écran de pointage l'interroge) |
| `POST /enroler` `{enseignantId}` | capture le doigt de référence → gabarit signé |
| `POST /verifier` `{enseignantId, gabarit}` | compare le doigt posé au gabarit → score signé |

`/verifier` accepte aussi `template` comme nom du gabarit, et un
`tentativeId` facultatif : un identifiant de tentative permet à l'application
de rejouer sa propre requête sans que la passerelle lui délivre une seconde
preuve.

Les réponses portent `appareilId` : l'application doit le renvoyer à l'API,
qui s'en sert pour choisir la clé qu'elle vérifie.

## Sécurité

| Garde-fou | Mise en œuvre |
|---|---|
| Écoute locale uniquement | `hostname: 127.0.0.1` — le réseau de l'établissement n'atteint pas le lecteur |
| Origine restreinte | seule l'origine déclarée dans `origines` est servie ; une origine inconnue reçoit `403` (le CORS seul ne suffirait pas : la lecture se déclencherait quand même) |
| Secret d'appareil protégé | fichier hors dépôt, permissions `600` vérifiées au démarrage |
| Anti-rejeu | une charge déjà signée n'est plus signée ; une tentative déjà traitée reçoit `409` |
| Pas de cache | `Cache-Control: no-store` sur toutes les réponses |

> L'anti-rejeu de la passerelle empêche qu'une *même* lecture produise
> plusieurs preuves. Il ne remplace pas un nonce côté API : une preuve
> interceptée reste rejouable pendant sa fenêtre d'acceptation de cinq
> minutes. Voir « Reste à faire » dans [docs/biometrie.md](../docs/biometrie.md).

## Brancher un vrai lecteur

Le fichier `src/pilote.ts` définit le contrat à remplir ; `src/pilotes/simulateur.ts`
en donne une implémentation complète qui sert aux démonstrations et aux tests.
Un pilote réel n'implémente que `initialiser`, `capturer` et `comparer` : il
doit rendre un gabarit stable, un score comparable à `EMPREINTE_SCORE_MIN`,
et ne jamais sortir de ce contrat — le SDK du constructeur reste confiné à ce
fichier.

Pour brancher le matériel :

1. créer `src/pilotes/<constructeur>.ts` qui implémente `PiloteLecteur` ;
2. l'enregistrer dans `src/pilotes/index.ts` ;
3. lancer avec `BIOMETRIE_PILOTE=<nom> bun run start`.

Pilotes envisageables, documentés dans `src/pilote.ts` : **SecuGen** Hamster
Pro (SDK C/C++ et FDapplet), **ZKTeco** SLK20R / Live20R (SDK Windows, Linux et
Android), **DigitalPersona** (SDK multi-plateforme Windows, Linux, macOS,
Android, iOS), **Mantra** MFS100 et **Futronic** FS80H (SDK Linux). Tous
fournissent un SDK Windows/Linux ; ZKTeco comme DigitalPersona proposent aussi
un SDK Android, ce qui permet de faire tourner la passerelle **sur le téléphone
du contrôleur via Termux**, avec le lecteur branché en OTG.

## Mode simulateur

Par défaut la passerelle reproduit le gabarit attendu : la vérification
réussit, ce qui permet de dérouler la démonstration complète. Pour montrer le
refus d'un doigt qui n'est pas celui de l'enseignant :

```bash
DOIGT_SIMULE=inconnu bun run start
```

Tant que le pilote est le simulateur, un résultat signé ne prouve **aucune**
présence : le simulateur rejoue le gabarit qu'on lui demande de comparer. Le
fournisseur `/etat` l'indique (`simule: true`) et l'interface doit le dire.

## Vérification

```bash
cd biometrie
bun install --frozen-lockfile
bun test          # 57 tests
bun run typecheck
```

Les tests reproduisent l'algorithme de l'API (`backend/src/modules/presence/
presence-preuves/presence-preuves.service.ts`) et comparent les signatures sur
des vecteurs figés : si la passerelle s'écarte d'un champ, l'API refusera la
preuve et le test le verra avant.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 5044 (fichier : sinon) | port d'écoute local — **5044 est pris sur le serveur de production** |
| `BIOMETRIE_CONFIG` | `~/.config/university/biometrie.json` | fichier de configuration de l'appareil (hors dépôt, 600) |
| `BIOMETRIE_SECRET` | — | secret partagé de l'ancien chemin ; ignoré si un appareil est configuré |
| `ORIGINES` | `https://university.naimba.com` | origines autorisées à appeler la passerelle |
| `SCORE_MIN` | 60 | seuil de correspondance affiché par la passerelle |
| `BIOMETRIE_PILOTE` | `simulateur` | pilote de lecture à utiliser |
| `BIOMETRIE_LANGUE` | `fr` | langue des messages (`fr` ou `en`) |
| `DOIGT_SIMULE` | — | `inconnu` pour simuler un doigt non reconnu |
