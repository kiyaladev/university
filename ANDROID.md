# Application Android

UniPrésence s'installe aussi comme application Android, pour le contrôleur qui
fait sa tournée avec un lecteur d'empreintes au bout du câble.

**Téléchargement : https://presence.naimba.com/telechargement/unipresence.apk**

Android affichera un avertissement à l'installation (application hors Play
Store) : autoriser l'installation depuis cette source. L'APK est signé avec la
clé de l'établissement, pas avec une clé de débogage : les mises à jour
s'installeront par-dessus sans désinstaller.

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
désinstaller puis réinstaller l'application. Elle vit dans
`/opt/apps/unipresence/android-cle/`, hors du dépôt, en `chmod 600`, et doit
être sauvegardée ailleurs que sur ce serveur.

## Ce qui reste à faire

- Déposer `mfs100.aar` et vérifier la capture sur un vrai lecteur : les noms de
  méthodes du SDK (`Init`, `AutoCapture`, `ExtractISOTemplate`, `MatchISO`,
  `Uninit`) sont ceux de la documentation Mantra et n'ont pas encore été
  confrontés au matériel.
- Écran d'administration des appareils enrôlés (la liste et la révocation
  existent côté API, pas encore côté écran).
