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
| 13 oct. 2026 | [2026-10-13-analyse-simplification.md](2026-10-13-analyse-simplification.md) | Analyse avant simplification ; le bilan reste à la racine : [SIMPLIFICATION_2026_10_13.md](../../SIMPLIFICATION_2026_10_13.md) |
| 14 oct. 2026 | [2026-10-14-corrections-audit.md](2026-10-14-corrections-audit.md) | Corrections des 13 constats de l’audit du 14 octobre (ancien `AUDIT_FIXES.md`) |

## Preuves : dossier `audit/`

Les preuves brutes (JSON, captures) restent dans [`audit/`](../../audit/) à la
racine : `2026-10-02/`, `2026-10-06/`, `recommandations/`,
`recommandations-2026-10-06/`, `simplification-2026-10-13/`.

Depuis le 23 octobre 2026, les **captures PNG et journaux `.log`** d’`audit/` ne
sont plus versionnés (`.gitignore`), sauf dans `audit/simplification-2026-10-13/`.
Les 244 PNG retirés pesaient 34,8 Mo (le dossier `audit/` passait de 38 Mo à
environ 3,5 Mo de fichiers suivis). Aucun `.log` n’était versionné : les liens
vers des `.log` dans les documents figés pointent vers des fichiers jamais
publiés.

**Archive complète** du dossier `audit/` tel qu’il était avant ce retrait
(414 fichiers, PNG compris) :

```
/var/backups/university/audit-archive-20261023.tar.gz   (32 Mo, sur le serveur de production)
tar tzf /var/backups/university/audit-archive-20261023.tar.gz | grep -vc '/$'   # 414
```

Cette archive n’existe que sur ce serveur : la copier hors serveur avec les
sauvegardes de la base. Les captures restent aussi dans l’historique git
(commits antérieurs à `chore(audit): retire de l'index les 244 captures PNG`).
