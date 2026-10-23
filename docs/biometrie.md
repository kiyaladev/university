# Biométrie

> **Statut : prototype.** La passerelle de `biometrie/` fonctionne avec un
> **simulateur** de lecteur ; aucun lecteur réel n’a encore été branché ni
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
| Passerelle locale `biometrie/` | service Bun sur le poste du contrôleur | HMAC-SHA256 avec le secret partagé `BIOMETRIE_SECRET`, identique côté API | prototype, simulateur uniquement |

L’API rejette tout résultat mal signé, périmé de plus de 5 minutes, comparé à un
autre gabarit que celui enrôlé, ou dont le score est sous `EMPREINTE_SCORE_MIN`
(60 par défaut). En production, si `BIOMETRIE_SECRET` est absent ou vaut la
valeur d’exemple, le chemin passerelle est désactivé (erreur 400) ; les
appareils enrôlés gardent leur clé propre.

Les gabarits sont chiffrés au repos (`BIOMETRIE_CHIFFREMENT_CLE`) et purgés
après `BIOMETRIE_CONSERVATION_JOURS` (90) jours de fiche désactivée, par une
tâche planifiée qui écrit l’effacement et sa trace dans la même transaction.
L’image du doigt n’est jamais transmise ni stockée.

## La passerelle `biometrie/`

```bash
cd biometrie
PORT=5045 BIOMETRIE_SECRET="le-meme-que-l-api" bun run start
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
| `POST /verifier` `{enseignantId, template}` | compare le doigt posé au gabarit → score signé |

Charge signée : `verification|<enseignantId>|<score>|<horodatage>`.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | 5044 | port d’écoute local (**à changer sur ce serveur**) |
| `BIOMETRIE_SECRET` | — | identique à celui de l’API |
| `ORIGINES` | `*` | origines autorisées |
| `SCORE_MIN` | 60 | seuil affiché par la passerelle |
| `DOIGT_SIMULE` | — | `inconnu` pour simuler un doigt non reconnu |

Pour brancher un vrai lecteur : implémenter `initialiser`, `capturer`,
`comparer` dans `biometrie/src/pilotes/<constructeur>.ts` (contrat dans
`src/pilote.ts`, exemple complet dans `src/pilotes/simulateur.ts`), puis
remplacer `new PiloteSimulateur()` dans `src/index.ts`. Détails dans
[biometrie/README.md](../biometrie/README.md).

## Reste à faire

Voir [suivi.md](suivi.md) : qualification sur lecteur réel (Mantra MFS100 ou
autre), durée de conservation à valider par les RH, protocole anti-rejeu hors
ligne pour une empreinte seule (aujourd’hui refusée après 5 minutes de coupure),
écran d’administration des appareils enrôlés.
