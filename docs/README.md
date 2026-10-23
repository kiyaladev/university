# Documentation

Index de la documentation d’University. À la racine du dépôt, il ne reste que
trois fichiers : [README.md](../README.md) (présentation et démarrage),
[PRODUCT.md](../PRODUCT.md) (contexte produit) et [DESIGN.md](../DESIGN.md)
(système de design). Tout le reste est ici.

## Où chercher quoi

| Je veux… | Document |
| --- | --- |
| Comprendre le produit et le référentiel | [architecture.md](architecture.md) |
| Exploiter le serveur (ports, PM2, nginx, déploiement, sauvegardes) | [exploitation.md](exploitation.md) |
| Savoir ce qui reste à faire | [suivi.md](suivi.md) |
| Installer l’application Android, comprendre la signature | [android.md](android.md) |
| Comprendre l’attestation par empreinte | [biometrie.md](biometrie.md) |
| Relire un audit passé | [audits/README.md](audits/README.md) |
| Comprendre une décision d’architecture | [decisions/](decisions/) |

## Les documents

### Vivants — à mettre à jour avec le code

| Document | Objet | Mise à jour |
| --- | --- | --- |
| [architecture.md](architecture.md) | Modules, rôles, flux principaux, briques communes | à chaque module ou flux nouveau |
| [exploitation.md](exploitation.md) | Ports, processus, nginx, déploiement, sauvegardes, variables, outillage | à chaque changement d’exploitation |
| [suivi.md](suivi.md) | **Backlog unique** : état par module, priorités, décisions en attente | en continu |
| [android.md](android.md) | Application Android, lecteur USB-OTG, chaîne de signature, `scripts/apk.sh` | à chaque publication d’APK |
| [biometrie.md](biometrie.md) | Les trois moyens d’attestation, la passerelle `biometrie/`, les appareils enrôlés | à chaque évolution du lecteur |
| [decisions/](decisions/) | Décisions d’architecture (montants exacts, statuts, …) : contexte, périmètre, état d’application | une note par décision |

### Figés — ne plus les modifier

| Document | Objet |
| --- | --- |
| [audits/](audits/README.md) | Audits datés et bilans ; ils conservent les constats et preuves à leur date |
| [audits/preuves/](audits/preuves/) | Preuves brutes des recettes (JSON, texte), rangées par date |

Une preuve qui n’est plus citée par aucun document de `docs/` n’est pas
versionnée : elle est archivée hors dépôt (voir
[audits/README.md](audits/README.md#preuves-dossier-preuves)).

## Règles de rédaction

- **Français**, phrases courtes, un fait par phrase, pas de texte promotionnel.
- Un document vivant ne répète pas un chiffre daté sans sa date.
- Toute affirmation vérifiable renvoie vers sa preuve
  (`docs/audits/preuves/<date>/…`) ou vers le test qui la rejoue.
- Les documents d’audit ne sont jamais réécrits : un correctif se date et
  s’ajoute (voir [2026-10-14-corrections-audit.md](audits/2026-10-14-corrections-audit.md)).
- Les liens vers un fichier de preuve sont **relatifs** : les documents
  restent lisibles hors dépôt.

## Où sont les preuves

| Contenu | Emplacement |
| --- | --- |
| Preuves de recette versionnées | [audits/preuves/](audits/preuves/) |
| Archive complète des preuves retirées (414 fichiers, PNG compris) | `/var/backups/university/audit-archive-20261023.tar.gz` (serveur de production) |
| Captures d’écran, journaux `.log` | jamais versionnés (`.gitignore`) |
| Captures d’écran de recette en cours | `/tmp/university-qa/` et les dossiers QA des recettes |

## Conventions de liens

Les documents de `docs/` sont à deux niveaux de profondeur (`docs/` et
`docs/audits/`) : un lien vers une preuve s’écrit `preuves/<date>/fichier.json`
depuis `docs/audits/`, et `audits/preuves/<date>/fichier.json` depuis `docs/`.
