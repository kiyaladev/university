# Audits datés

Documents **figés** : ils conservent les constats et preuves à leur date. Ne pas
les mettre à jour ; le travail restant se suit dans [docs/suivi.md](../suivi.md).

| Date | Document | Objet |
| --- | --- | --- |
| 2 oct. 2026 | [2026-10-02-audit-application.md](2026-10-02-audit-application.md) | Audit initial (ancien `AUDIT_APPLICATION.md`) |
| 3 oct. 2026 | [2026-10-03-recommandations.md](2026-10-03-recommandations.md) | Recommandations d’origine et état au 3 octobre |
| 3 oct. 2026 | [2026-10-03-suivi-recommandations.md](2026-10-03-suivi-recommandations.md) | Mise en œuvre au 3 octobre |
| 6 oct. 2026 | [2026-10-06-analyse.md](2026-10-06-analyse.md) | Analyse et vérifications (ancien `AUDIT_2026_10_06.md`) |
| 6 oct. 2026 | [2026-10-06-journal-recettes.md](2026-10-06-journal-recettes.md) | Journal détaillé des recettes QA (ancien `SUIVI_RECOMMANDATIONS.md`) |
| 13 oct. 2026 | [2026-10-13-analyse-simplification.md](2026-10-13-analyse-simplification.md) | Analyse avant simplification |
| 13 oct. 2026 | [2026-10-13-bilan-simplification.md](2026-10-13-bilan-simplification.md) | Bilan de la simplification des parcours (ancien `SIMPLIFICATION_2026_10_13.md`, à la racine) |
| 14 oct. 2026 | [2026-10-14-corrections-audit.md](2026-10-14-corrections-audit.md) | Corrections des 13 constats de l’audit du 14 octobre (ancien `AUDIT_FIXES.md`) |

## Preuves : dossier `preuves/`

Les preuves brutes des recettes (JSON, texte) sont versionnées dans
[`preuves/`](preuves/), rangées par date :

| Dossier | Provenance | Fichiers |
| --- | --- | --- |
| `preuves/2026-10-02/` | ancien `audit/2026-10-02/` | 4 |
| `preuves/2026-10-03/` | ancien `audit/recommandations/` | 63 |
| `preuves/2026-10-06/` | ancien `audit/recommandations-2026-10-06/` | 73 |
| `preuves/2026-10-13/` | ancien `audit/simplification-2026-10-13/` | 2 |

**Seules les preuves citées par un document de `docs/` sont versionnées.** Les
autres ont été retirées du dépôt : elles sont dans l’archive ci-dessous.

Depuis le 23 octobre 2026, les **captures PNG et journaux `.log`** ne sont
plus versionnés (`.gitignore` : `*.png` et `*.log` sont ignorés partout).
Les 244 PNG retirés pesaient 34,8 Mo : les fichiers suivis du dossier
d’audit passent de 414 fichiers et 38 Mo à 142 fichiers et 2,1 Mo (JSON,
Markdown, texte). Aucun `.log` n’était versionné : les liens vers des `.log`
dans les documents figés pointent vers des fichiers jamais publiés.

**Archive complète** du dossier `audit/` tel qu’il était avant ce retrait
(414 fichiers, PNG compris) :

```
/var/backups/university/audit-archive-20261023.tar.gz   (32 Mo, sur le serveur de production)
tar tzf /var/backups/university/audit-archive-20261023.tar.gz | grep -vc '/$'   # 414
```

Cette archive n’existe que sur ce serveur : la copier hors serveur avec les
sauvegardes de la base (voir [exploitation.md](../exploitation.md#sauvegarde-et-restauration)).
Les captures restent aussi dans l’historique git
(commits antérieurs à `chore(audit): retire de l'index les 244 captures PNG`).

### Écrire une nouvelle preuve

Les scripts de recette écrivent leur preuve dans le dossier de la date
concernée, par exemple `docs/audits/preuves/2026-10-06/`. Ajouter un fichier
nouveau est permis ; en revanche **ne pas réécrire une preuve déjà
versionnée** : les documents figés y renvoient, et leur contenu fait foi à
leur date.
