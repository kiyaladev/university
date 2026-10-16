# Corrections de l'audit du 2026-10-14 (codex/university.md)

Branche `fix/audit-2026-10-14`. Rien n'est commité. Les 13 constats ont tous été vérifiés dans le code avant d'être corrigés.

Bilan : 12 corrigés, 1 corrigé partiellement (le protocole hors ligne n'est pas refait), 0 faux positif.

## Constats P1

| # | Constat | État | Fichiers modifiés | Vérification |
|---|---|---|---|---|
| 1 | Les frais documentaires étaient additionnés aux frais de scolarité | **Corrigé**. Le cumul de `simulerPaiement` exclut désormais les paiements liés à une `DemandeDocument` (`PAIEMENT_SCOLARITE = { demandeDocument: { is: null } }`). Le même filtre s'applique au solde affiché sur le portail et au certificat d'inscription. | `backend/src/modules/inscription/inscription.service.ts`, `backend/src/modules/portail/portail.service.ts` | `inscription.reglement.spec.ts` : forme du filtre d'agrégat ; un cumul retenu de 90 pour des frais de 100 ne passe pas le dossier en PAYEE |
| 2 | La devise n'était pas vérifiée avant de solder une inscription | **Corrigé**. La devise du dossier est celle de son tarif (`Frais.devise`, GNF par défaut, via `deviseDossier()`). `creerPaiement` refuse un paiement de scolarité dans une autre devise et prend par défaut celle du dossier. Le cumul, le portail et le certificat ne comptent que cette devise ; le certificat n'affiche plus « GNF » en dur. | `inscription.service.ts`, `portail.service.ts`, `i18n/{fr,en}/inscription.json` | `inscription.reglement.spec.ts` : un paiement en GNF sur un tarif en USD est refusé ; le cumul est filtré sur `devise: 'USD'` |
| 3 | Un CONTROLEUR pouvait pointer une séance hors de son périmètre | **Corrigé**. `construireDonnees` applique au contrôleur la règle déjà utilisée en lecture (`gabarit`, `moyens`, `parQrSalle`) : la séance doit lui être attribuée, ou déjà pointée par lui, ou relever de son département. | `backend/src/modules/controle/controle.service.ts` | `controle.service.spec.ts` : séance étrangère refusée (avec et sans département), séance du département acceptée |
| 4 | La préinscription publique rattachait un dossier à une fiche sur la seule base de l'e-mail | **Corrigé**. Si l'e-mail correspond déjà à une fiche, la route publique répond 409 et invite à passer par le portail authentifié ou le guichet ; aucune fiche existante n'est rattachée. Effet sur l'usage : un ancien étudiant ne peut plus se réinscrire par le formulaire public, il doit passer par le guichet (`creerInscription`), car le portail n'a pas encore de parcours de réinscription authentifié. | `inscription.service.ts`, `i18n/{fr,en}/inscription.json` | `inscription.reglement.spec.ts` : aucune création d'inscription ni de fiche quand l'e-mail existe |
| 5 | Le secret JWT d'exemple était accepté en production | **Corrigé**. `optionsJwt` refuse en production un secret absent **et** la valeur `change-me-in-production` (constante `JWT_SECRET_EXEMPLE`). Le repli resté dans `jwt.strategy.ts` ne sert qu'en dev, puisque le démarrage échoue avant en production. | `backend/src/common/jwt-config.module.ts`, `jwt-config.module.spec.ts` | 3 nouveaux tests en `NODE_ENV=production` : secret absent refusé, valeur d'exemple refusée, vrai secret accepté |
| 6 | Le secret biométrique avait un repli public en production | **Corrigé**. En production, si `BIOMETRIE_SECRET` est absent ou vaut `change-me-biometrie`, le chemin passerelle (preuve sans `appareilId`) est désactivé avec une erreur 400 explicite. Les appareils enrôlés gardent leur clé propre. | `backend/src/modules/attestation/attestation.service.ts`, `i18n/{fr,en}/attestation.json` | `attestation.service.spec.ts` : une preuve forgée avec la clé d'exemple et un score de 100 est refusée en production (secret absent, puis valeur d'exemple) |
| 7 | Les transitions de statut des inscriptions n'étaient pas atomiques | **Corrigé**. Validation et annulation passent par `updateMany` conditionné au statut attendu (`PAYEE` pour valider, statut lu pour annuler). Si aucune ligne n'est touchée → 409 `statut_modifie_entre_temps`, sans journal d'audit. | `inscription.service.ts`, `inscription.audit-lifecycle.spec.ts` (mocks adaptés), `i18n/{fr,en}/inscription.json` | `inscription.reglement.spec.ts` : la transition concurrente est simulée par `count: 0`, validation et annulation sont refusées. Aucun test concurrent sur une vraie base, faute de base disponible ici. |
| 8 | La première attribution d'un contrôle n'était pas sérialisée | **Corrigé**. L'`upsert` est remplacé par `create` quand `existant === null` et par `update` sinon. Lors de deux premières saisies concurrentes, l'unicité de `seanceId` fait échouer le second INSERT (P2002) ; il est converti en 403 « déjà contrôlée par un autre agent » au lieu d'écraser le propriétaire. | `controle.service.ts`, `controle.service.spec.ts` | `controle.service.spec.ts` : un P2002 sur `create` donne un 403, sans `update` ni audit |

## Constats P2

| # | Constat | État | Fichiers modifiés | Vérification |
|---|---|---|---|---|
| 9 | Un dossier ANNULEE bloquait la réinscription (unicité étudiant/année) | **Corrigé (réouverture explicite)**. `creerInscription` rouvre le dossier annulé : `updateMany` conditionné à `ANNULEE`, qui remet promotion, montant, statut EN_ATTENTE_PAIEMENT et efface la validation. L'audit est tracé sous `INSCRIPTION_REOUVERTE` (avant/après). Le numéro de dossier est conservé. Les paiements réussis de l'ancien dossier restent rattachés et comptent dans le cumul. | `inscription.service.ts` | `inscription.reglement.spec.ts` : pas de `create`, réouverture conditionnelle, action d'audit |
| 10 | Le portail affichait comme « finale » la dernière ligne de la liste triée | **Corrigé**. La finale est choisie par année la plus récente (`annee.dateDebut`), puis par session (le RATTRAPAGE l'emporte sur la NORMALE), puis par `valideeLe`. L'ordre de la liste `deliberations` ne change pas. | `portail.service.ts`, `portail.service.spec.ts` | Nouveau test : deux années en NORMALE, puis un rattrapage de l'année récente |
| 11 | Les filtres de dates du restaurant perdaient la borne `gte` | **Corrigé**. Un seul objet `{ gte, lte }` par champ (`rechargeLe`, `consommeLe`). | `backend/src/modules/resto/resto.service.ts`, `resto.read.spec.ts` | 2 nouveaux tests : les deux bornes sont conservées |
| 12 | Des horaires incohérents créditaient toute la durée planifiée | **Corrigé**. Quand l'arrivée et la fin réelle sont toutes deux valides et que la fin est antérieure ou égale à l'arrivée → 400 `heure_fin_reelle_avant_arrivee`. Le repli sur la durée planifiée ne s'applique plus que si une heure manque. | `controle.service.ts`, `i18n/{fr,en}/controle.json` | `controle.service.spec.ts` : 08:00→07:00 et 08:00→08:00 refusés ; le test existant « durée planifiée quand les heures manquent » passe toujours |
| 13 | Les preuves biométriques mises en file hors ligne devenaient périmées | **Partiellement corrigé**. Côté frontend : quand une empreinte accompagne une signature, seule la signature est mise en file, puisque l'empreinte est vérifiée en premier et serait refusée après 5 min. Une empreinte seule part en file avec un avertissement (« faites aussi signer »). **Non corrigé** : il n'existe toujours pas de protocole anti-rejeu hors ligne pour une empreinte seule, qui reste refusée après 5 min de coupure. Cela demande une conception (horodatage signé par l'appareil, nonce, fenêtre de rejeu) et ne relève pas d'un correctif minimal. | `frontend/src/stores/pointages.ts`, `frontend/src/i18n/{fr-FR,en-US}/filePointages.ts` | `vue-tsc` passe ; parité des catalogues OK (`tests/catalogues.cjs`). Pas de test automatique : les tests frontend du dépôt sont des scénarios navigateur (`tests/*.mjs`) qui demandent une application lancée. |

Faux positifs : aucun.

## Commandes de vérification (résultats réels)

Dépendances installées dans le worktree avec `bun install --frozen-lockfile` (backend et frontend), puis `bunx prisma generate` côté backend.

| Commande | Résultat |
|---|---|
| `backend: bunx tsc --noEmit -p tsconfig.json` | OK (exit 0) |
| `backend: bun run build` (`nest build && cp -r src/i18n dist/i18n`) | OK (exit 0) |
| `backend: bunx jest --runInBand` | OK : **110 suites, 951 tests passent**, 0 échec (l'audit en comptait 107 suites et 904 tests avant corrections, plus 2 suites bloquées par les sockets ; elles passent ici). Avertissement préexistant : « A worker process has failed to exit gracefully » (fuite de minuteurs dans certains tests). |
| `frontend: bun install --frozen-lockfile` | Les paquets sont installés, mais le `postinstall` (`quasar prepare`) **échoue (préexistant, lié à l'environnement)** : `quasar.config.ts` exige `API_URL` en mode prod. Sans `.quasar/`, un premier `vue-tsc` remontait de fausses erreurs (`#q-app/wrappers`, `pages/*.vue`). |
| `frontend: QA_BUILD_DIR=dist/qa-audit API_URL=http://127.0.0.1:9 bunx quasar prepare` | OK |
| `frontend: bunx vue-tsc --noEmit -p tsconfig.json` (après prepare) | OK (exit 0) |
| `frontend: QA_BUILD_DIR=dist/qa-audit API_URL=http://127.0.0.1:9 bun run build` | OK (exit 0). Build de recette dans `frontend/dist/qa-audit` (ignoré par git), sans aucun appel réseau. |
| `frontend: node tests/catalogues.cjs` | OK : 5536 clés FR = 5536 clés EN, aucune clé manquante |
| Lint | Aucun script ni configuration lint dans `backend/package.json` ou `frontend/package.json` : non exécuté. |
| Tests e2e frontend (`tests/*.mjs`) | Non exécutés : il faut un backend et un frontend lancés (interdit ici : pas de services). |

Nouveau fichier de tests : `backend/src/modules/inscription/inscription.reglement.spec.ts`. Clés i18n ajoutées en FR et EN : `inscription.devise_incompatible`, `inscription.statut_modifie_entre_temps`, `inscription.fiche_existante_connexion_requise`, `controle.heure_fin_reelle_avant_arrivee`, `attestation.passerelle_biometrique_non_configuree`, `filePointages.fingerprintOnly`, `filePointages.fingerprintHelp`.

Aucun fichier `.env` ni secret n'a été modifié, rien n'a été touché hors du worktree, aucun service n'a été redémarré.
