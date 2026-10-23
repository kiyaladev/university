# Application Android

University s'installe aussi comme application Android, pour le contrôleur qui
fait sa tournée avec un lecteur d'empreintes au bout du câble.

**Téléchargement prévu : https://university.naimba.com/telechargement/university.apk**

> **Lien inactif au 23 octobre 2026.** La `location /telechargement/` est
> écrite dans [`infra/nginx/university.naimba.com`](../infra/nginx/university.naimba.com)
> mais pas encore déployée dans `/etc/nginx` : l'adresse renvoie encore
> l'application web. Il faut reconstruire et publier l'APK (`scripts/apk.sh`),
> qui pose `university.apk` dans `/opt/apps/university/telechargement/` et retire
> l'ancien `unipresence.apk`.

Android affichera un avertissement à l'installation (application hors Play
Store) : autoriser l'installation depuis cette source. L'APK est signé avec la
clé de l'établissement, pas avec une clé de débogage : les mises à jour
s'installeront par-dessus sans désinstaller.

---

## Identifiant de l'application

L'application porte l'identifiant **`gn.university.controle`**, décidé le
23 octobre 2026.

Il ne peut en porter aucun autre : Android identifie une application par son
`applicationId`, et deux applications ne peuvent pas avoir le même. UniPrésence
(`/opt/apps/unipresence`) utilise `gn.unipresence.controle`. Avec le même
identifiant, l'installation de University sur un téléphone **remplacerait**
UniPrésence — les deux applications ne coexistent pas côte à côte, même si
leurs noms sont différents.

Ce qui a changé dans le dépôt :

| Fichier | Ce qui a changé |
| --- | --- |
| `frontend/src-capacitor/capacitor.config.json` | `appId` : `gn.university.controle`, `appName` : `University` |
| `frontend/src-capacitor/android/app/build.gradle` | `namespace` et `applicationId` |
| `frontend/src-capacitor/android/app/src/main/res/values/strings.xml` | `package_name`, `custom_url_scheme`, nom affiché |
| `frontend/src-capacitor/android/app/src/main/java/gn/university/controle/` | paquet Java renommé (déclarations `package` incluses) |

Le nom affiché sur le téléphone est « University » : deux icônes « UniPrésence »
sur le même écran seraient indiscernables, l'identifiant seul ne suffit pas à
les distinguer.

La **clé de signature, elle, reste la même** : une même clé signe des
applications d'identifiants différents. Ce qui compte pour Android, c'est
l'identifiant ; la clé ne sert qu'à prouver que la mise à jour vient de nous.

> Aucun APK University n'ayant jamais été distribué, aucun téléphone n'est
> concerné par ce changement : il n'y a rien à réinstaller. Le jour où une
> version antérieure de University aurait été installée, le changement
> d'identifiant imposerait de désinstaller avant réinstaller.

---

## Ce que le téléphone peut et ne peut pas faire

C'est le point qui décide de tout le reste, et il vaut mieux le savoir avant
d'acheter du matériel.

**Le capteur d'empreintes intégré à un téléphone ne sait reconnaître que le
propriétaire du téléphone.** Android ne donne jamais accès au gabarit et ne
sait pas comparer l'empreinte d'un tiers : c'est une garantie du système, pas
une limite qu'on contourne. Il est donc **impossible** de faire poser le doigt
à un enseignant sur le capteur du téléphone du contrôleur pour l'identifier.

Deux usages distincts, à ne jamais confondre :

| Capteur | Sert à | Ne sert pas à |
|---|---|---|
| Capteur du téléphone | Déverrouiller la tournée du contrôleur | Attester la présence d'un enseignant |
| Lecteur externe USB-OTG | Attester la présence d'un enseignant | — |

## Le lecteur externe

Le lecteur retenu est le **Mantra MFS100**, branché en USB-OTG sur le téléphone
du contrôleur. Brancher le lecteur ouvre l'application (le manifeste déclare
l'identifiant du constructeur, `0x1fba`).

Le SDK MFS100 est distribué par Mantra sous licence et ne peut pas vivre dans
ce dépôt. Le pont est donc fait par réflexion, dans `LecteurMantra.java`, avec
deux conséquences voulues :

- l'application compile et s'installe **sans** le SDK, et se rabat sur un
  lecteur simulé qui permet d'essayer toute la chaîne ;
- le jour où l'on dépose `mfs100.aar` dans
  `frontend/src-capacitor/android/app/libs/`, le vrai lecteur devient actif tout
  seul, sans rien changer d'autre.

Le lecteur simulé ne prouve rien et le dit : l'écran d'attestation affiche un
bandeau « Lecteur simulé — cette lecture n'atteste la présence de personne ».

Pour brancher un autre modèle, écrire une classe qui implémente
`LecteurEmpreinte` (quatre méthodes) et la retourner dans `EmpreintePlugin.lecteur()`.
Rien d'autre ne bouge : ni le protocole, ni l'interface web.

## Comment une lecture devient une preuve

Une application installée sur des dizaines de téléphones ne peut pas partager
un secret unique avec le serveur : il serait extractible de l'APK, et
n'importe qui pourrait alors forger « empreinte reconnue, score 98 ».

Chaque appareil reçoit donc **sa propre clé** :

1. à la première connexion, l'application demande son enrôlement au serveur
   (`POST /attestation/appareils`), authentifiée par la session du contrôleur ;
2. le serveur crée un `Appareil`, tire une clé de 32 octets et la renvoie **une
   seule fois** ;
3. l'application la range dans le coffre chiffré d'Android
   (`EncryptedSharedPreferences`, clé matérielle) — jamais dans le stockage du
   navigateur, où elle serait lisible ;
4. chaque lecture est signée en HMAC-SHA256 sur une charge qui nomme
   l'appareil, l'enseignant, le gabarit comparé, le score et l'horodatage :

   ```
   verification|<appareilId>|<enseignantId>|<sha256 du gabarit>|<score>|<horodatage>
   ```

   Rien de tout cela ne peut être changé en route sans invalider la preuve, et
   un résultat volé sur un téléphone ne peut pas être rejoué au nom d'un autre.

Un téléphone perdu se révoque seul : `DELETE /attestation/appareils/:id`. Ses
lectures cessent d'être recevables immédiatement, les autres appareils
continuent.

## Fabriquer l'APK

```bash
scripts/apk.sh          # APK signé, publié au téléchargement
scripts/apk.sh debug    # APK de débogage, non publié
```

Prérequis : Android SDK (`/opt/android-sdk`), Java 21, et la clé de signature
dans `android-cle/`.

**La clé de signature est irremplaçable.** Android refuse une mise à jour
signée par une autre clé : la perdre obligerait chaque contrôleur à
désinstaller puis réinstaller l'application. Elle doit vivre dans
`/opt/apps/university/android-cle/`, hors du dépôt, en `chmod 600`, et doit
être sauvegardée ailleurs que sur ce serveur. La copie y est déjà ; c'est le
fichier de propriétés qui pointe encore vers l'autre projet (ci-dessous).

### La clé de signature : la copie et le `storeFile`

La clé est aujourd'hui la même que celle d'UniPrésence : elle est lue depuis
`/opt/apps/unipresence/android-cle/`. C'est l'identifiant de l'application qui
doit être propre, pas la clé — mais la clé doit vivre **dans ce projet**, pour
que la disparition d'UniPrésence n'emporte pas la signature d'University.

Le fichier `android-cle/cle.properties` (hors du dépôt, `chmod 600`) indique
le chemin du keystore par sa ligne `storeFile`. Elle pointe encore vers le
projet UniPrésence. Pour l'amener ici :

```bash
# 1. Copier le keystore dans ce projet (le fichier existe déjà ici ;
#    la commande est sans risque si on la rejoue)
install -m 600 /opt/apps/unipresence/android-cle/unipresence.keystore \
        /opt/apps/university/android-cle/unipresence.keystore

# 2. Faire pointer storeFile sur la copie locale (le fichier de propriétés
#    n'est pas modifié par le dépôt ; c'est une opération d'exploitation)
sed -i 's#^storeFile=.*#storeFile=/opt/apps/university/android-cle/unipresence.keystore#' \
        /opt/apps/university/android-cle/cle.properties
```

Le nom du fichier (`unipresence.keystore`) est sans importance : c'est le
contenu qui compte, pas le nom. `scripts/apk.sh` signale le cas où `storeFile`
pointe encore hors de ce projet.

> Ne jamais commiter `android-cle/` : il contient les mots de passe de la clé.

### Publication

`scripts/apk.sh` fait trois choses, dans l'ordre :

1. il **vérifie l'identifiant** de l'APK produit (`aapt2 dump packagename`) et
   refuse de publier si ce n'est pas `gn.university.controle` ;
2. il copie l'APK dans `/opt/apps/university/telechargement/university.apk` ;
3. il **retire l'ancien `unipresence.apk`**, qui porte l'identifiant
   d'UniPrésence : le laisser downloadable, ce serait proposer d'installer
   UniPrésence sous le nom d'University.

Reste à faire côté nginx : la `location /telechargement/` doit être déployée
dans `/etc/nginx/sites-available/` (voir
[`infra/nginx/README.md`](../infra/nginx/README.md)), puis `nginx -t` et un
rechargement.

## Ce qui reste à faire

Suivi centralisé dans [suivi.md](suivi.md) ; vue d'ensemble de la biométrie
dans [biometrie.md](biometrie.md).

- Déposer `mfs100.aar` et vérifier la capture sur un vrai lecteur : les noms de
  méthodes du SDK (`Init`, `AutoCapture`, `ExtractISOTemplate`, `MatchISO`,
  `Uninit`) sont ceux de la documentation Mantra et n'ont pas encore été
  confrontés au matériel.
- Écran d'administration des appareils enrôlés (la liste et la révocation
  existent côté API, pas encore côté écran).
- Publication : déployer la `location /telechargement/` dans `/etc/nginx`,
  reconstruire l'APK (`scripts/apk.sh`), puis vérifier sur un téléphone que
  l'installation **ajoute** University à côté de UniPrésence au lieu de la
  remplacer.
- Corriger le `storeFile` de `android-cle/cle.properties` pour qu'il pointe sur
  la copie locale du keystore (voir [la clé de signature](#la-clé-de-signature--la-copie-et-le-storefile)).
