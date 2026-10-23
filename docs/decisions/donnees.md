# Intégrité du modèle de données — index, suppressions, horodatages

> **Statut : prêt à être appliqué.** Les trois migrations ajoutées ici n'ont
> été exécutées sur aucune base. L'opérateur les joue sur une base jetable
> puis en production, après les requêtes de contrôle du §5.

Ce document décrit les corrections apportées au schéma Prisma, aux
migrations et au jeu de données de démonstration (`backend/prisma/seed.ts`).
Il fait suite à `docs/decisions/montants.md` (types de montants) et
`docs/decisions/statuts.md` (harmonisation des statuts).

---

## 1. Décisions

### 1.1 Les index de recherche de la bibliothèque sont recréés et déclarés

**Constat.** La migration `20260815220000_bibliotheque_recherche` avait créé
cinq index GIN sur `DocumentDepot` : `recherche` (tsvector), `motsClefs`,
`contenuTexte`, `titre` et `resume` (trigrammes). La migration
`20260815230000_modules_universite_avancee` les a supprimés (lignes 56-68) et
ne les a jamais recréés. Or `backend/src/modules/campus/bibliotheque/recherche.service.ts`
fait `recherche @@ to_tsquery` : la recherche plein texte s'appuyait donc sur
un balayage séquentiel de la table, et les similarités par trigrammes n'étaient
plus indexées du tout.

**Décision.** Les cinq index sont recréés par la migration
`20261024020000_index_recherche` **et déclarés dans `backend/prisma/schema/recherche.prisma`**, avec
`map:` pour figer leurs noms d'origine. Prisma sait exprimer ces index :

```prisma
@@index([recherche], type: Gin)
@@index([motsClefs], type: Gin)
@@index([contenuTexte(ops: raw("gin_trgm_ops"))], type: Gin, map: "DocumentDepot_contenuTexte_trgm")
@@index([titre(ops: raw("gin_trgm_ops"))], type: Gin, map: "DocumentDepot_titre_trgm")
@@index([resume(ops: raw("gin_trgm_ops"))], type: Gin, map: "DocumentDepot_resume_trgm")
```

`ops: raw("gin_trgm_ops")` est accepté par `prisma validate` et se traduit en
`CREATE INDEX ... USING GIN ("colonne" gin_trgm_ops)`. Le `map:` est
indispensable : sans lui, Prisma renommerait l'index en
`DocumentDepot_contenuTexte_idx` et le diff verrait un index à supprimer et un
autre à créer.

**Pourquoi ne pas se contenter de recréer les index.** C'est exactement le
mécanisme qui a perdu ces index : un index présent en base mais absent du
schéma est vu par `migrate diff` comme un objet à supprimer. La migration
`20260815230000` a donc supprimé ce que `20260815220000` avait créé. Déclarer
les index dans le schéma est la seule façon d'empêcher le cycle de se
reproduire.

### 1.2 Les clés étrangères réellement filtrées sont indexées

Cinq clés étrangères servaient dans un `where` sans être indexées. Aucun de
ces index ne double un `@@unique` ou un `@@index` déjà déclaré commençant par
le même champ.

| Clé étrangère | Filtrée par | Index ajouté |
| --- | --- | --- |
| `VerificationAttestation.attestationId` | journal des vérifications QR d'une attestation (`modules/attestations/attestations.service.ts`) | `VerificationAttestation_attestationId_idx` |
| `Creneau.affectationId` | créneaux d'une affectation, supprimés avec elle (`modules/referentiel/affectations.ts`) | `Creneau_affectationId_idx` |
| `Seance.anneeId` | planning et contrôle des années ouvertes (`modules/planification/seances.service.ts`) | `Seance_anneeId_idx` |
| `Promotion.filiereId` | structure LMD, promotions d'une filière (`modules/referentiel/structure.ts`) | `Promotion_filiereId_idx` |
| `Deliberation.promotionId` | jury d'une promotion (`modules/scolarite/scolarite.service.ts`) | `Deliberation_promotionId_idx` |

Cette migration complète `20261022120000_index_cles_etrangeres`, qui avait
indexé les clés les plus sollicitées.

### 1.3 Quatre suppressions en cascade deviennent des refus

**Décision.** `ON DELETE CASCADE` devient `ON DELETE RESTRICT` sur :

| Relation | Avant | Après | Motif |
| --- | --- | --- | --- |
| `Evaluation.matiereId` | CASCADE | RESTRICT | `Note.evaluationId` est déjà en RESTRICT : en CASCADE, supprimer une matière effaçait ses évaluations puis échouait **à mi-chemin** sur les notes. |
| `Chambre.residenceId` | CASCADE | RESTRICT | supprimer une résidence effaçait les chambres, et par cascade l'historique d'attribution. |
| `AttributionLogement.chambreId` | CASCADE | RESTRICT | une attribution est l'historique de l'occupation d'une chambre (critères sociaux, dates, retrait) : elle ne disparaît pas avec la chambre. |
| `AttributionLogement.etudiantId` | CASCADE | RESTRICT | cohérent avec les autres relations vers `Etudiant` (inscription, paiement, demande de document), toutes en RESTRICT. |

**Effet applicatif — pas de 500.** Le refus de la base arrive bien avant :

- `modules/referentiel/matieres.ts` encadre la suppression par
  `supprimerOuConflit()` (`backend/src/common/crud.service.ts`), qui traduit
  `P2003` en **409** avec un message i18n. Le service est donc déjà correct :
  aucun changement de service n'est nécessaire.
- `modules/cites/cites.service.ts` vérifie l'absence de chambres (résidence)
  puis d'attributions (chambre) avant de supprimer et renvoie un **400**
  explicite. Le `RESTRICT` ne change donc pas le comportement observable de
  l'interface : il garantit qu'aucune suppression ne contourne ce contrôle.
- `Etudiant` n'est jamais supprimé en dur par l'application (les étudiants
  sont désactivés) : passer l'attribution de logement en RESTRICT ne peut pas
  faire échouer une suppression existante.

**Hors périmètre — à surveiller.** `modules/cites/` est modifié par un autre
agent : le service y gagnerait à encadrier également ses suppressions par
`supprimerOuConflit()` (409) plutôt que par un `BadRequestException` (400),
pour être homogène avec le référentiel. Ce n'est pas nécessaire à la
correction, mais c'est le seul point où la règle « refus de la base = 409 »
n'est pas appliquée.

### 1.4 Horodatages : `creeLe` devient `createdAt`, sans toucher aux colonnes

**Décision.** Cinq modèles qui portaient `creeLe` adoptent le champ Prisma
`createdAt`, avec `@map("creeLe")` : **la colonne en base ne change pas**, donc
aucune migration n'est nécessaire.

| Modèle | Champ Prisma | Colonne |
| --- | --- | --- |
| `ReservationSalle` | `createdAt` | `creeLe` |
| `Soutenance` | `createdAt` | `creeLe` |
| `Reclamation` | `createdAt` | `creeLe` |
| `MessageReclamation` | `createdAt` | `creeLe` |
| `DemandeDocument` | `createdAt` | `creeLe` |

`@map` change seulement le nom de la colonne vue par le moteur de migration :
le schéma reste aligné sur la base, `migrate diff` ne propose aucun
`ALTER TABLE ... RENAME COLUMN`, et le nom de l'index
`MessageReclamation_reclamationId_creeLe_idx` est figé par
`map:` pour ne pas être recréé.

**Conséquence sur l'API.** Le JSON renvoyé par le backend expose désormais
`createdAt` là où il exposait `creeLe`. Les usages backend (`orderBy`,
`select`, projections, journal d'audit) et frontend (types, pages, colonnes de
tableau) ont été adaptés.

**Deux exceptions assumées.** `Deliberation` et `FeuillePaie` portent **les
deux** champs : `creeLe` y est une date métier (création du jury, établissement
de la feuille de paie) distincte de `createdAt`, date technique d'écriture de
la ligne. Les supprimer broke l'historique métier ; les harmoniser ferait
perdre la distinction. **Rien n'est modifié** pour ces deux modèles : un
commentaire le signale dans `backend/prisma/schema/scolarite.prisma` et `backend/prisma/schema/finances.prisma`.

### 1.5 Le seed vide les tables dans l'ordre des règles `onDelete`

**Décision.** L'ordre de suppression du seed suit les règles `onDelete` du
schéma : une table référencée en RESTRICT est vidée avant celle qui la
référence. Deux corrections :

- `prisma.frais.deleteMany()` est ajouté **avant** `prisma.promotion.deleteMany()`.
  `Frais.promotionId` est en RESTRICT et la table `Frais` n'était jamais
  vidée : la suppression des promotions aurait été refusée (P2003).
- `prisma.note.deleteMany()` et `prisma.evaluation.deleteMany()` sont remontés
  **avant** `prisma.matiere.deleteMany()`. Depuis le passage de
  `Evaluation.matiereId` en RESTRICT (§1.3), la suppression d'une matière
  évaluée est refusée ; les évaluations doivent donc partir avant.

Les deux commandes de seed sont désormais identiques et chargent toutes deux
les alias de `tsconfig` :

```json
"seed": "ts-node -r tsconfig-paths/register prisma/seed.ts"
```

```json
"prisma": { "seed": "ts-node -r tsconfig-paths/register prisma/seed.ts" }
```

Avant, `prisma migrate reset` (qui appelle `prisma db seed`) exécutait le
seed sans le registre d'alias, alors que `bun run seed` l'exécutait avec.

---

## 2. Migrations ajoutées

| Migration | Objet | Réversible par |
| --- | --- | --- |
| `20261024020000_index_recherche` | recrée les 5 index GIN de `DocumentDepot` (plein texte + trigrammes) et rejoue `CREATE EXTENSION IF NOT EXISTS pg_trgm` | `DROP INDEX` des 5 index (voir §6) |
| `20261024030000_index_cles` | ajoute les 5 index de clés étrangères filtrées | `DROP INDEX` des 5 index |
| `20261024040000_suppressions_restrict` | `ON DELETE CASCADE` → `RESTRICT` sur 4 clés étrangères | rejouer les 4 `ADD CONSTRAINT` avec `ON DELETE CASCADE` |

Ces trois migrations sont écrites à la main et sont **idempotentes**
(`CREATE INDEX IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS`) : elles
peuvent être rejouées sans risque sur une base où l'objet existe déjà.

Les migrations déjà présentes (`20261022120000_index_cles_etrangeres`,
`20261023100000_suppression_restrict_attestation_demande`,
`20261023110000_controles_seances_restrict`) ne sont pas modifiées.

---

## 3. Objets SQL hors schéma Prisma

Prisma ne sait pas représenter certains objets PostgreSQL. Ils sont posés à la
main par une migration, **n'apparaissent pas dans `backend/prisma/schema/`**, et
`migrate diff` ne les voit pas. La liste complète, avec la migration
d'origine :

| Objet | Type | Migration d'origine | Expression SQL de restauration |
| --- | --- | --- | --- |
| `AnneeAcademique_active_key` | index UNIQUE **partiel** (`WHERE "active" = true`) | `20261002233000_unique_active_annee` | `CREATE UNIQUE INDEX IF NOT EXISTS "AnneeAcademique_active_key" ON "AnneeAcademique" ("active") WHERE "active" = true;` |
| `TicketSupport_un_seul_inventaire` | contrainte **CHECK** | `20261023100000_suppression_restrict_attestation_demande` | `ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_un_seul_inventaire" CHECK ("equipementId" IS NULL OR "equipementPatrimoineId" IS NULL);` |
| `DocumentDepot_recherche_trigger()` + trigger `DocumentDepot_recherche_update` | **fonction** PL/pgSQL + **trigger** | `20260815220000_bibliotheque_recherche` | fonction + `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER` (texte dans la migration) |
| extensions `pg_trgm`, `btree_gin` | **extensions** | `20260815220000_bibliotheque_recherche` | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` |

**L'index partiel est le point sensible.** À la différence des CHECK, des
triggers et des extensions — que le moteur de migration ignore — Prisma
**gère** les index : un index présent en base mais absent du schéma est
proposé à la suppression par `migrate diff`. `AnneeAcademique_active_key` est
donc susceptible de disparaître lors d'un prochain `migrate dev`. Il est
signalé par un commentaire dans `backend/prisma/schema/recherche.prisma` (modèle `AnneeAcademique` et
en-tête du fichier) ; après un `migrate dev`, vérifier sa présence et le
recréer avec l'expression ci-dessus.

Prisma ne sait pas exprimer un index partiel : la contrainte « une seule année
académique active » ne peut donc pas être déclarée dans le schéma. C'est un
choix assumé, pas un oubli.

**Réserve sur l'index `recherche`.** Cet index porte sur une colonne
`Unsupported("tsvector")`. Prisma sait le décrire dans le schéma
(`@@index([recherche], type: Gin)`) et le moteur de migration le génère
correctement, mais l'introspection d'une base existante sur une colonne
`Unsupported` reste le point le moins bien couvert par Prisma. Après un
`migrate dev`, vérifier que les cinq index de `DocumentDepot` sont toujours
présents (§5.1) et, au besoin, les recréer avec le SQL du §6.1.

---

## 4. Ce qui n'a pas changé

- Aucune **colonne** n'est ajoutée, supprimée ou renommée : la migration
  `20261024020000` et les deux suivantes ne portent que sur des index et des
  règles de suppression.
- `Deliberation` et `FeuillePaie` conservent leurs deux champs d'horodatage.
- Les index partiels, CHECK, triggers et extensions déjà en base sont
  laissés en place.
- `backend/src/common/numero.ts` et `modules/presence/presence-preuves` ne sont
  pas touchés.

---

## 5. Requêtes de contrôle avant déploiement

À exécuter sur la base **avant** de jouer les migrations, puis à rejouer
après pour confirmer.

### 5.1 Index de recherche

```sql
-- Avant : les index doivent être absents (ils ont été supprimés).
SELECT indexname FROM pg_indexes
 WHERE tablename = 'DocumentDepot'
   AND indexname IN ('DocumentDepot_recherche_idx', 'DocumentDepot_motsClefs_idx',
                     'DocumentDepot_contenuTexte_trgm', 'DocumentDepot_titre_trgm',
                     'DocumentDepot_resume_trgm');
-- attendu : 0 ligne

-- Après : les cinq index doivent exister.
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'DocumentDepot' AND indexname LIKE '%trgm%'
    OR indexname IN ('DocumentDepot_recherche_idx', 'DocumentDepot_motsClefs_idx');
-- attendu : 5 lignes
```

### 5.2 Extension trigrammes

```sql
SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'btree_gin');
-- attendu : pg_trgm présent (btree_gin déjà posé par 20260815220000)
```

### 5.3 Index de clés étrangères

```sql
SELECT tablename, indexname FROM pg_indexes
 WHERE indexname IN ('VerificationAttestation_attestationId_idx',
                     'Creneau_affectationId_idx', 'Seance_anneeId_idx',
                     'Promotion_filiereId_idx', 'Deliberation_promotionId_idx');
-- attendu après migration : 5 lignes
```

### 5.4 Règles de suppression

```sql
-- Les quatre contraintes doivent être en RESTRICT après migration.
SELECT conname, confdeltype FROM pg_constraint
 WHERE conname IN ('Evaluation_matiereId_fkey', 'Chambre_residenceId_fkey',
                   'AttributionLogement_chambreId_fkey',
                   'AttributionLogement_etudiantId_fkey');
-- attendu : confdeltype = 'r' (r = RESTRICT, c = CASCADE)

-- Aucune ligne orpheline : RESTRICT ne supprime rien, mais un contrôle de
-- cohérence évite de découvrir un blocage plus tard.
SELECT m."id" FROM "Matiere" m
  JOIN "Evaluation" e ON e."matiereId" = m."id" LIMIT 10;
SELECT c."id" FROM "Chambre" c
  JOIN "AttributionLogement" a ON a."chambreId" = c."id" LIMIT 10;
SELECT a."id" FROM "AttributionLogement" a
  JOIN "Etudiant" e ON e."id" = a."etudiantId" LIMIT 10;
-- attendu : 0 ligne (une jointure INNER ne remonte que les lignes liées)
```

### 5.5 Index partiel hors schéma

```sql
-- L'index partiel doit survivre au déploiement.
SELECT indexname FROM pg_indexes WHERE indexname = 'AnneeAcademique_active_key';
-- attendu : 1 ligne ; sinon recréer avec l'expression du §3.

-- Une seule année active doit être active.
SELECT count(*) FROM "AnneeAcademique" WHERE "active" = true;
-- attendu : 1
```

### 5.6 Contraintes hors schéma

```sql
SELECT conname FROM pg_constraint WHERE conname = 'TicketSupport_un_seul_inventaire';
-- attendu : 1 ligne

SELECT tgname FROM pg_trigger WHERE tgname = 'DocumentDepot_recherche_update';
-- attendu : 1 ligne
```

---

## 6. Retour arrière

### 6.1 Les index de recherche

```sql
DROP INDEX IF EXISTS "DocumentDepot_recherche_idx";
DROP INDEX IF EXISTS "DocumentDepot_motsClefs_idx";
DROP INDEX IF EXISTS "DocumentDepot_contenuTexte_trgm";
DROP INDEX IF EXISTS "DocumentDepot_titre_trgm";
DROP INDEX IF EXISTS "DocumentDepot_resume_trgm";
```

La recherche plein texte redevient un balayage séquentiel : la fonctionnalité
reste correcte, seule la performance se dégrade. Il faut **aussivement**
revenir sur `backend/prisma/schema/recherche.prisma` (retirer les cinq `@@index`), sinon le prochain
`migrate dev` les recréera.

### 6.2 Les index de clés étrangères

```sql
DROP INDEX IF EXISTS "VerificationAttestation_attestationId_idx";
DROP INDEX IF EXISTS "Creneau_affectationId_idx";
DROP INDEX IF EXISTS "Seance_anneeId_idx";
DROP INDEX IF EXISTS "Promotion_filiereId_idx";
DROP INDEX IF EXISTS "Deliberation_promotionId_idx";
```

Aucune donnée n'est touchée : seule la performance se dégrade. Même
règle : retirer les cinq `@@index` correspondants du schéma.

### 6.3 Les règles de suppression

```sql
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_matiereId_fkey";
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chambre" DROP CONSTRAINT "Chambre_residenceId_fkey";
ALTER TABLE "Chambre" ADD CONSTRAINT "Chambre_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionLogement" DROP CONSTRAINT "AttributionLogement_chambreId_fkey";
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionLogement" DROP CONSTRAINT "AttributionLogement_etudiantId_fkey";
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Attention.** Ce retour arrière réintroduit l'effacement silencieux de
l'historique d'attribution et l'échec à mi-chemin sur les notes : c'est le
comportement que §1.3 supprime. Il ne faut pas y recourir pour « faire passer »
une suppression : le message 409 du référentiel matières ou le 400 des cités
est le comportement attendu.

### 6.4 L'horodatage `createdAt`

Aucune migration à Annuler : la colonne s'appelle toujours `creeLe`. Le
retour arrière consiste à revenir sur le code (schéma, services, pages) et à
redéployer. Une migration `prisma migrate deploy` postérieure n'est pas
nécessaire.

### 6.5 Le seed

Le seed est idempotent : on peut le rejouer tel quel après un retour arrière.
Si l'ordre de suppression doit être revu, se rappeler que `Evaluation.matiereId`
en RESTRICT impose de vider `Note` puis `Evaluation` **avant** `Matiere`, et que
`Frais` doit être vidée **avant** `Promotion`.

---

## 7. Découpage du schéma en fichiers par domaine

**Constat.** `backend/prisma/schema.prisma` faisait 2 264 lignes : 65 modèles
et 55 énumérations sans aucune séparation entre le socle technique, la
présence, la scolarité, le campus et les finances. Deux développeurs ne
pouvaient pas travailler sur deux domaines sans se marcher dessus, et le fichier
ne donnait aucune indication de la frontière entre les domaines métier.

**Décision.** Le schéma est découpé en un fichier par domaine, dans
`backend/prisma/schema/` :

| Fichier | Contenu |
| --- | --- |
| `base.prisma` | générateur, source de données, note sur les objets SQL hors Prisma |
| `identite.prisma` | `User`, `AuditLog`, `Parametre`, `Role` |
| `referentiel.prisma` | `AnneeAcademique`, `Departement`, `Filiere`, `Promotion`, `Salle`, `Enseignant`, `Matiere`, `Affectation` |
| `presence.prisma` | `Creneau`, `Seance`, `Controle`, `Justificatif`, `Appareil`, `Tirage` |
| `scolarite.prisma` | `Etudiant`, `Inscription`, `Frais`, `Evaluation`, `Note`, `Deliberation`, `Examen`, `Formation`, `TravailEncadre`, `Soutenance` |
| `documents.prisma` | `Attestation`, `VerificationAttestation`, `DemandeDocument`, `CarteEtudiante`, `BadgeAcces` |
| `finances.prisma` | `Paiement`, `FeuillePaie`, `LignePaie`, `RecetteExterne` |
| `campus.prisma` | `Residence`, `Chambre`, `ReservationSalle`, `TicketSupport`, `EquipementPatrimoine`, `Election`, `Reclamation` |
| `recherche.prisma` | `DocumentDepot`, `SuspicionPlagiat`, `CoursVOD`, `VueVOD` |
| `vie-etudiante.prisma` | `Notification`, `PortefeuilleResto`, `Recharge`, `ConsommationResto` |
| `courrier.prisma` | `Courrier`, `CircuitCourrier` |
| `pilotage.prisma` | `StatistiqueMesrs` |

Chaque énumération suit le modèle qui l’utilise. Les commentaires `///` sont
conservés, ainsi que les séparateurs de section d'origine lorsque la section
entière reste dans le même fichier.

**Contraintes de Prisma 6.19.** Le chemin du dossier de schéma est déclaré
dans `backend/package.json` (`"prisma": { "schema": "prisma/schema" }`), et le
dossier des migrations doit se trouver **à côté du fichier qui porte la
source de données** : les migrations sont donc passées de
`backend/prisma/migrations/` à `backend/prisma/schema/migrations/`, sans
renommer aucune migration. `prisma migrate deploy` et `prisma generate`
continuent de fonctionner depuis `backend/` sans argument.

**Preuve d'équivalence.** Le découpage est purement textuel : aucun modèle,
aucune énumération, aucune relation n'a été modifié.

```bash
prisma migrate diff \
  --from-schema-datamodel <ancien schema.prisma> \
  --to-schema-datamodel prisma/schema --script
# → "-- This is an empty migration."
```

**Ce qui n'a pas changé.** Aucune migration n'a été ajoutée, aucune donnée
n'est touchée, `backend/prisma/seed.ts` reste à sa place et la commande
`bunx prisma migrate deploy` reste identique pour l'exploitation. Le seul
fichier généré impacté est `frontend/src/types/generated/enums.ts`, dont
l'ordre des énumérations suit désormais les fichiers de domaine ; le contenu
des énumérations est identique.
