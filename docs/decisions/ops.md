# Décision d'exploitation — hygiène du dépôt, CI et sauvegardes

- **Statut** : appliquée sur la branche `mc7/ops` ; aucun déploiement ni
  changement de production dans ce lot.
- **Date** : 2026-10-23
- **Périmètre** : `.gitignore`, `.github/workflows/`, `scripts/`, `docs/`,
  `biometrie/`, `audit/` (déplacement), `backend/scripts/` (chemins de preuve).
- **Branche** : `mc7/ops` (worktree dédié).

---

## 1. Contexte

Le dépôt portait encore le nom de l'ancienne application dans plusieurs
endroits, et son organisation ne correspondait plus à son usage :

- les preuves de recette vivaient dans `audit/` à la racine (168 fichiers
  suivis), dont beaucoup n'étaient cités par aucun document ; le dossier
  contenait en plus des captures PNG de 34,8 Mo retirées de l'index le
  23 octobre ;
- les variables de sauvegarde s'appelaient `UNIPRESENCE_BACKUP_*`, et
  `scripts/restore-db.sh` parlait d'écraser la base `unipresence` ;
- la CI rejouait les tests, mais le lint ne pouvait pas faire échouer une
  régression, et aucune compilation n'était vérifiée ;
- la documentation de la passerelle biométrique décrivait une charge signée
  qui ne correspondait plus au code (`verification|id|score|horodatage`), et
  ne disait pas que la passerelle n'envoie pas d'`appareilId` ;
- `scripts/apk.sh` publikait l'APK sans jamais faire varier le `versionCode` :
  une mise à jour par-dessus l'application installée aurait été refusée.

## 2. Décisions

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Emplacement des preuves | Les preuves sont rangées par date dans `docs/audits/preuves/<date>/`. **Seules celles citées par un document de `docs/` restent versionnées** ; les autres sont retirées (l'archive complète reste sur le serveur : `/var/backups/university/audit-archive-20261023.tar.gz`) | Un dépôt n'a pas à porter des fichiers que personne ne cite ; l'archive hors dépôt conserve tout, et le superviseur l'a déjà produite |
| Dossier `audit/` | Supprimé de la racine ; les scripts de recette écrivent désormais dans `docs/audits/preuves/2026-10-06/` | Un seul endroit pour les preuves, cohérent avec le reste de la documentation |
| Documentation | Index de la documentation dans `docs/README.md` ; à la racine, seuls `README.md`, `PRODUCT.md` et `DESIGN.md` restent | La racine doit se lire en dix secondes |
| Variables de sauvegarde | `UNIVERSITY_BACKUP_DIR`, `UNIVERSITY_BACKUP_KEEP`, `UNIVERSITY_BACKUP_REMOTE`. **L'ancien nom est lu en repli, avec un avertissement dans le journal** | Renommer brutalement casserait une installation existante ; le repli permet de migrer sans interruption |
| Copie hors serveur | Nouveau script `scripts/sauvegarde-hors-serveur.sh` : dernier dump **et** `android-cle/` vers `UNIVERSITY_BACKUP_REMOTE`, chiffrement gpg optionnel du keystore, **échec explicite (64) si la destination manque** | La clé de signature est irremplaçable ; une tâche qui « réussit » sans destination serait pire qu'une tâche en erreur |
| Rotation | La rétention ne supprime que `university-*.dump` ; les `unipresence-*.dump` éventuels ne sont ni supprimés ni réutilisés | Ils appartiennent à l'autre application : les effacer serait une décision d'exploitation, pas du script |
| Lint en CI | **Bloquant** | Vérifié : 0 erreur des deux côtés (1 645 et 199 avertissements). Un lint qui n'arrête rien n'arrête rien |
| Format en CI | **Non bloquant** | Le backend passe, le frontend signale encore `src/shared/utils/statuts.ts` (fichier en cours de modification) ; à bloquer quand le frontend sera vert |
| Compilations en CI | `nest build` et compilation frontend vers un dossier temporaire (`QA_BUILD_DIR=/tmp/…`) | Une CI ne touche jamais au dossier servi par nginx |
| Passerelle biométrique | `biometrie/` gagne son `bun.lock` (verrouillé en `--frozen-lockfile`), un `tsconfig.json` et un job de CI dédié ; le README et `docs/biometrie.md` sont corrigés (empreinte du gabarit dans la charge signée, pas d'`appareilId`, simulateur seulement) | La documentation doit décrire le code ; le code de la passerelle était vérifié par personne |
| `versionCode` de l'APK | Calculé à chaque publication : `max(dépôt + 1, date du jour, dernier publié + 1)`, compteur hors dépôt (`android-cle/version-code.txt`), fichier gradle restauré après le build | Android refuse une mise à jour dont le `versionCode` n'a pas augmenté ; l'oubli se paie chez les contrôurs. La signature n'en dépend pas |

## 3. Conséquences

- La CI comporte quatre jobs (vérifications, compilations, scripts
  d'exploitation, passerelle) et peut désormais faire échouer un push.
- `scripts/backup-db.spec.mjs` et `scripts/sauvegarde-hors-serveur.spec.mjs`
  tournent sans PostgreSQL ni SSH : `pg_dump`, `pg_restore` et `rsync` sont
  simulés par des doublures.
- Deux suites de tests sont ajoutées au dépôt de `scripts/` ; elles sont
  rejouées par la CI.

## 4. Reste à faire (hors de ce lot)

- `frontend/tests/*.mjs` (13 fichiers) pointent encore vers
  `../audit/recommandations-2026-10-06/` : à remplacer par
  `../docs/audits/preuves/2026-10-06/`, sinon ces recettes échoueront en
  écrivant leur preuve.
- `backend/package.json` (`audit:routes:suivi`) pointe encore vers
  `../audit/recommandations/inventaire-routes.json`.
- `frontend/src/navigation/manifeste.ts` cite encore
  `SIMPLIFICATION_2026_10_13.md`, désormais `docs/audits/2026-10-13-bilan-simplification.md`.
- `docs/decisions/statuts.md` mentionne l'ancien dossier `audit/`.
- DestINATION hors serveur à configurer : `UNIVERSITY_BACKUP_REMOTE` (et, si
  possible, `UNIVERSITY_BACKUP_GPG_PASSFILE` pour chiffrer la clé).
