# Montants — du `Float` au type exact

> **Statut : préparé, non appliqué en production.** La branche `mc/decimal`
> porte le schéma, la migration et le code. Elle **n’est pas fusionnée** dans
> `development` : la migration n’a été exécutée sur aucune base, ni de
> production, ni de QA. La procédure de déploiement ci-dessous reste à
> exécuter par un opérateur.

Les montants de l’université étaient stockés en `Float` (PostgreSQL
`double precision`). Un montant d’argent en flottant binaire n’est pas exact :
`0.1 + 0.2` vaut `0.30000000000000004`, et une somme de milliers de lignes
 accumule l’écart. Ce document fixe le type de stockage retenu, l’inventaire
complet des champs concernés, les pièges rencontrés dans le code, et la
procédure de mise en production.

---

## 1. Décision

**Les 16 champs monétaires passent de `Float` à `Decimal(14,2)`**, soit
`numeric(14,2)` en PostgreSQL : 12 chiffres entiers, 2 décimales, plage
± 999 999 999 999,99 GNF.

### Les options pesées

| Option | Exactitude | Plafond | Impact TypeScript | Impact JSON (frontend) | Verdict |
| --- | --- | --- | --- | --- | --- |
| `Float` (aujourd’hui) | ✗ flottant binaire | — | aucun | nombre | **écarté** — la source du problème |
| `Int` / `int4` | ✓ (entiers) | 2 147 483 647 (10 chiffres) | aucun (reste `number`) | nombre | **écarté** — plafond trop bas pour des totaux cumulés, et conversion destructive des valeurs décimales existantes |
| `BigInt` / `int8` | ✓ | 2⁶³ | ✗ `bigint` n’est pas sérialisable en JSON : `JSON.stringify` lève une exception | ✗ casserait toute la chaîne | **écarté** — trop coûteux en réécriture pour un besoin que `numeric` couvre |
| **`Decimal(14,2)`** | **✓ décimal exact** | **10¹² (12 chiffres)** | **moyen** : `Prisma.Decimal` est un objet decimal.js | **gérable** : sérialisé en chaîne, converti à la sortie | **retenu** |

### Pourquoi `Decimal(14,2)` et pas `Int`

1. **Le plafond d’`Int32` est réel.** `Int` plafonne à 2 147 483 647, soit
   environ 240 000 euros. Un montant unitaire (frais d’inscription, loyer,
   prix de formation) tient sans problème, mais `FeuillePaie.montantTotal`
   cumule le net de **tous** les vacataires d’un mois, et `Paiement` sert à
   cinq portefeuilles : un total annuel de recettes dépasse le plafond dès
   que l’université grandit. `numeric(14,2)` donne douze chiffres entiers,
   soit **cent fois plus** que `Int32`, sans coût notable (le stockage d’un
   `numeric` est comparable à celui d’un `bigint`).

2. **La conversion conserve les données.** `Float` → `Int` impose
   d’arrondir : une valeur existante de `1 500,50` GNF deviendrait `1 500`
   ou `1 501`, ce qui est une **altération silencieuse d’un montant
   d’argent** au moment de la migration. `Float` → `numeric(14,2)` arrondit
   au centième, et seulement au centième ; la requête de contrôle du §5
   vérifie au préalable qu’aucune valeur ne porte plus de deux décimales.

3. **Les agrégats deviennent exacts.** C’est le bénéfice le plus concret et
   le moins visible : `SUM()` sur une colonne `double precision` cumule les
   approximations en virgule flottante ; `SUM()` sur `numeric` est exact.
   Les trois tableaux de bord qui somment des paiements (recettes, documents,
   patrimoine) et le cumul de scolarité qui bascule un dossier en `PAYEE`
   changent de nature.

4. **La marge pour l’avenir.** Le franc guinéen n’a pas de centimes, mais
   `numeric(14,2)` les supporte : le jour où une devise à centimes entre
   dans le registre, aucun schéma n’aurait à être repris.

### Ce qui n’est **pas** un montant

Les `Float` restants du schéma sont des mesures, pas des sommes : ils ne
sont pas convertis, et ne doivent pas l’être.

| Champ | Nature |
| --- | --- |
| `Enseignant.latitude`, `Enseignant.longitude`, `Salle.latitude`, `Salle.longitude` | coordonnées géographiques |
| `UeNote.coefficient`, `UeNote.note`, `UeNote.tauxReussite`, `Deliberation.moyenne`, `NoteExam.note`, `SuspicionPlagiat.score` | notes sur 20, pondérations, pourcentages |

Un **taux** ou un **pourcentage** n’est pas un montant : il se calcule, se
compare à 100, et n’a pas de devise. Le traiter en `numeric` n’aurait aucun
sens. Seule exception retenue : `Enseignant.tauxHoraire` et
`LignePaie.tauxHoraire` **sont** des taux, mais **monétaires** — un taux
horaire s’évalue en francs par heure — et sont donc convertis en
`numeric(14,2)`.

---

## 2. Inventaire des champs monétaires

Seize champs, sur treize modèles.

| Modèle | Champ | Avant | Après | Usage |
| --- | --- | --- | --- | --- |
| `Enseignant` | `tauxHoraire` | `Float` | `Decimal(14,2)` | rémunération horaire des vacataires |
| `Inscription` | `montantFrais` | `Float` | `Decimal(14,2)` | instantané des frais à payer |
| `Frais` | `montant` | `Float` | `Decimal(14,2)` | tarif d’inscription (promotion × année) |
| `Paiement` | `montant` | `Float` | `Decimal(14,2)` | paiement, partagé par 5 portefeuilles |
| `FeuillePaie` | `montantTotal` | `Float` | `Decimal(14,2)` | somme des nets de la feuille |
| `LignePaie` | `tauxHoraire` | `Float` | `Decimal(14,2)` | instantané du taux au calcul |
| `LignePaie` | `montantBrut` | `Float` | `Decimal(14,2)` | heures × taux |
| `LignePaie` | `retenue` | `Float` | `Decimal(14,2)` | retenue sur brut |
| `LignePaie` | `montantNet` | `Float` | `Decimal(14,2)` | brut − retenue |
| `Chambre` | `loyer` | `Float` | `Decimal(14,2)` | loyer de la chambre |
| `Formation` | `prix` | `Float` | `Decimal(14,2)` | prix du parcours |
| `EquipementPatrimoine` | `valeurAcquisition` | `Float?` | `Decimal(14,2)?` | valeur d’acquisition (nulle si inconnue) |
| `ReparationMateriel` | `cout` | `Float` | `Decimal(14,2)` | coût de la réparation |
| `RecetteExterne` | `montant` | `Float` | `Decimal(14,2)` | recette encaissée hors scolarité |
| `DemandeDocument` | `frais` | `Float` | `Decimal(14,2)` | frais de la demande de document |
| `TarifDemande` | `montant` | `Float` | `Decimal(14,2)` | grille tarifaire des documents |

### Champs monétaires déjà exacts (hors périmètre, inchangés)

| Modèle | Champ | Type | Pourquoi inchangé |
| --- | --- | --- | --- |
| `PortefeuilleResto` | `solde` | `Int` | compteur de solde, manipulé en `increment`/`decrement` atomiques |
| `Recharge` | `montant` | `Int` | rechargement de portefeuille, en francs entiers |
| `ConsommationResto` | `montant` | `Int` | coût d’un repas, en francs entiers |

Ces trois champs sont **déjà exacts** : un `Int` ne perd rien. Le
portefeuille resto est par ailleurs borné par nature (un solde d’étudiant),
très loin du plafond d’`Int32`. Les aligner sur `numeric` n apporterait
aucune exactitude supplémentaire et élargirait la migration ; c’est un
écart assumé, à reconsidérer si un jour le portefeuille accepte des
centimes.

---

## 3. Les usages sensibles dans le code

Inventaire des endroits où un montant est lu, sommé, comparé, agrégé ou
formaté — et donc des endroits où la conversion change le comportement.

### Lectures et arithmétique

| Fichier | Nature de l’usage |
| --- | --- |
| `modules/paie/paie.service.ts` | calcul du brut (`heures × taux`), somme des nets, instantané d’audit, impression A4 |
| `modules/inscription/inscription.service.ts` | cumul des règlements, solde, comparaison « frais soldés », certificat A4 |
| `modules/portail/portail.service.ts` | taux de règlement et solde du dossier de l’étudiant |
| `modules/inscription/paiements.service.ts` | cumul des paiements par dossier → bascule en `PAYEE` |
| `modules/inscription/frais.service.ts` | propagation d’un tarif aux dossiers en attente, instantané d’audit |
| `modules/recettes/recettes.service.ts` | comparaison du montant avant/après encaissement, ventilation mensuelle |
| `modules/formations/formations.service.ts` | recette par formation, attestation de règlement |
| `modules/rapports/rapports.service.ts` | état de paiement des vacataires (montant par enseignant) |

### Agrégats (`aggregate._sum`, `groupBy._sum`)

| Fichier | Agrégat |
| --- | --- |
| `modules/inscription/paiements.service.ts:325` | `paiement.aggregate(_sum: montant)` — cumul de scolarité |
| `modules/documents-demande/documents-demande.service.ts:236` | `demandeDocument.aggregate(_sum: frais)` — recettes documentaires |
| `modules/recettes/recettes.service.ts:311` et `:321` | `recetteExterne.groupBy(_sum: montant)` — par type et top 3 |
| `modules/patrimoine/patrimoine.service.ts:550`, `:556`, `:562` | `equipementPatrimoine.aggregate/groupBy(_sum: valeurAcquisition)` — total, par catégorie, par département |
| `modules/rectorat/rectorat.service.ts:202` | `feuillePaie.aggregate(_sum: montantTotal)` — masse salariale du mois |
| `modules/rectorat/rectorat.service.ts:330`, `:360` | `equipementPatrimoine.groupBy(_sum: valeurAcquisition)` |

**Point d’attention :** la conversion de sortie (§4) ne s’applique pas aux
résultats d’un `groupBy`/`aggregate` — `_sum` renvoie un `Prisma.Decimal`,
qui n’est pas un objet de modèle. Ces dix sites sont donc convertis
**explicitement** par `toMontant()`.

### SQL brut

Un seul site manipule un montant en SQL brut :
`modules/formations/formations.service.ts:295`.

```sql
COALESCE(SUM(paiement."montant"), 0)::numeric AS "recette"
```

La version d’origine forçait `::double precision` — ce qui **détruisait
l’exactitude** que la migration vient de gagner. Le transtypage a été retiré :
`SUM()` sur `numeric` est exact, et le résultat est converti par
`toMontant()`.

### Formatage

Les montants sont affichés avec `toLocaleString('fr-FR')` (séparateur de
milliers, virgule décimale) dans les impressions A4 : feuille de paie,
certificat d’inscription, attestation de formation, étiquette
d’inventaire, état de paiement des vacataires, export CSV.

> `Prisma.Decimal` **n’accepte pas** l’argument de `toLocaleString()` et
> renvoie une chaîne brute (`"1234.5"`) sans séparateur de milliers ni
> virgule décimale. Tous ces appels passent désormais par `toMontant(...)`
> avant le formatage.

---

## 4. La règle de conversion dans le code

Deux règles, explicites et documentées.

### `toMontant()` — à l’entrée du domaine

`backend/src/common/finances/montant.ts` expose :

| Fonction | Rôle |
| --- | --- |
| `toMontant(v)` | `Prisma.Decimal \| number \| string \| null` → `number` |
| `toDecimal(v)` | `number \| Prisma.Decimal \| null` → `Prisma.Decimal` (écriture) |
| `estDecimal(v)` | distingue un `Decimal` d’un nombre |
| `montantsEnNombres(v)` | conversion récursive d’une charge utile |

Dans le domaine applicatif, **un montant est un `number`**. `toMontant()`
n’arrondit pas : la colonne `numeric(14,2)` a déjà arrondi à
l’enregistrement, et un second arrondi en JavaScript pourrait déplacer un
montant d’un centime sur les valeurs hautes.

### La sortie HTTP reste en nombres

Le frontend attend des nombres (`types/registre.ts`, `types/campus.ts`,
`types/rectorat.ts`… : tous les montants y sont typés `number`). Or
`JSON.stringify` sérialise un `Prisma.Decimal` **en chaîne** (`"1234.5"`),
ce qui casserait les comparaisons, les `toLocaleString` et les calculs
d’affichage du frontend.

Deux filets, volontairement redondants :

1. **`MontantInterceptor`** (`common/finances/montant.interceptor.ts`),
   intercepteur global : il remplace tout `Decimal` rencontré dans la
   réponse HTTP par son nombre. Une seule règle, valable pour les treize
   modèles porteurs de montants, plutôt qu’une conversion répétée sur
   chaque route — et il rattrape le service qui aurait oublié.
2. **`sansSecrets()`** (`common/sensitive-data.interceptor.ts`) traite
   lui aussi le cas `Decimal`, pour que l’ordre des intercepteurs ne
   change rien au résultat.

L’écriture, elle, n’a pas besoin de conversion : Prisma accepte un nombre
pour une colonne `numeric` et l’enregistre exactement.

> **Pourquoi pas une extension de client Prisma ?** Elle aurait donné le
> même résultat en un point, mais elle est *implicite* : un lecteur du code
> ne voit pas qu’un montant est converti, et l’extension ne s’applique ni
> aux agrégats (`_sum`), ni au SQL brut, ni aux écritures d’audit — il
> aurait fallu un mécanisme de plus pour ces cas. La règle retenue est
> visible : `toMontant()` au point d’usage, l’intercepteur en filet.

---

## 5. Requêtes de contrôle

### Avant la migration

Une seule requête, à passer sur la base de production avant de déployer.
Elle doit renvoyer **0 partout** :

```sql
SELECT 'Paiement' AS table, count(*) FILTER (WHERE montant >= 1000000000000) AS hors_echelle,
       count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) AS non_arrondi
  FROM "Paiement"
UNION ALL SELECT 'Frais',       count(*) FILTER (WHERE montant >= 1000000000000), count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) FROM "Frais"
UNION ALL SELECT 'Inscription', count(*) FILTER (WHERE "montantFrais" >= 1000000000000), count(*) FILTER (WHERE "montantFrais" <> round("montantFrais"::numeric, 2)) FROM "Inscription"
UNION ALL SELECT 'Enseignant',  count(*) FILTER (WHERE "tauxHoraire" >= 1000000000000), count(*) FILTER (WHERE "tauxHoraire" <> round("tauxHoraire"::numeric, 2)) FROM "Enseignant"
UNION ALL SELECT 'FeuillePaie', count(*) FILTER (WHERE "montantTotal" >= 1000000000000), count(*) FILTER (WHERE "montantTotal" <> round("montantTotal"::numeric, 2)) FROM "FeuillePaie"
UNION ALL SELECT 'LignePaie',   count(*) FILTER (WHERE "montantBrut" >= 1000000000000 OR "montantNet" >= 1000000000000 OR "retenue" >= 1000000000000 OR "tauxHoraire" >= 1000000000000),
                               count(*) FILTER (WHERE "montantBrut" <> round("montantBrut"::numeric, 2) OR "montantNet" <> round("montantNet"::numeric, 2) OR "retenue" <> round("retenue"::numeric, 2) OR "tauxHoraire" <> round("tauxHoraire"::numeric, 2)) FROM "LignePaie"
UNION ALL SELECT 'Chambre',     count(*) FILTER (WHERE loyer >= 1000000000000), count(*) FILTER (WHERE loyer <> round(loyer::numeric, 2)) FROM "Chambre"
UNION ALL SELECT 'Formation',   count(*) FILTER (WHERE prix >= 1000000000000), count(*) FILTER (WHERE prix <> round(prix::numeric, 2)) FROM "Formation"
UNION ALL SELECT 'EquipementPatrimoine', count(*) FILTER (WHERE "valeurAcquisition" >= 1000000000000), count(*) FILTER (WHERE "valeurAcquisition" <> round("valeurAcquisition"::numeric, 2)) FROM "EquipementPatrimoine"
UNION ALL SELECT 'ReparationMateriel',   count(*) FILTER (WHERE cout >= 1000000000000), count(*) FILTER (WHERE cout <> round(cout::numeric, 2)) FROM "ReparationMateriel"
UNION ALL SELECT 'RecetteExterne', count(*) FILTER (WHERE montant >= 1000000000000), count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) FROM "RecetteExterne"
UNION ALL SELECT 'DemandeDocument', count(*) FILTER (WHERE frais >= 1000000000000), count(*) FILTER (WHERE frais <> round(frais::numeric, 2)) FROM "DemandeDocument"
UNION ALL SELECT 'TarifDemande',  count(*) FILTER (WHERE montant >= 1000000000000), count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) FROM "TarifDemande";
```

- `hors_echelle` : un montant ≥ 10¹² ferait échouer l’`ALTER`
  (`numeric field overflow`). La migration étant transactionnelle, la table
  resterait intacte — mais il faut le savoir **avant**, pas au moment de
  déployer.
- `non_arrondi` : un montant portant plus de deux décimales serait arrondi
  par la conversion. Ce n’est pas un blocage, mais cela doit être connu et
  tracé.

### Après la migration

```sql
-- 1. Le type des colonnes est bien numeric(14,2)
SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND column_name IN ('montant','montantFrais','montantTotal','montantBrut','montantNet',
                       'retenue','tauxHoraire','loyer','prix','cout','frais','valeurAcquisition')
   AND table_name IN ('Paiement','Frais','Inscription','Enseignant','FeuillePaie','LignePaie',
                       'Chambre','Formation','EquipementPatrimoine','ReparationMateriel',
                       'RecetteExterne','DemandeDocument','TarifDemande')
 ORDER BY table_name, column_name;

-- 2. Aucune valeur perdue : la somme et le maximum sont inchangés
SELECT sum(montant) AS total, max(montant) AS max, count(*) AS n FROM "Paiement";

-- 3. Plus aucune décimale au-delà du centième
SELECT count(*) FILTER (WHERE montant <> round(montant, 2)) AS non_arrondi FROM "Paiement";

-- 4. Les soldes de scolarité restent cohérents : dossier soldé = frais = somme des paiements
SELECT count(*) AS dossiers_incoherents
  FROM "Inscription" i
  JOIN "Frais" f ON f."anneeId" = i."anneeId" AND f."promotionId" = i."promotionId"
 WHERE i."montantFrais" <> f.montant;
```

Le point 4 n’est pas un contrôle de migration mais un contrôle de
**cohérence métier** : il reveals les dossiers dont le montant instantané
ne suit plus le tarif. À traiter comme une anomalie métier, pas comme un
effet de la conversion.

---

## 6. Procédure de déploiement

> Aucune étape de cette procédure n’a été exécutée. Elle est écrite pour
> l’opérateur quiBranche la conversion.

### 6.1 Préparation

1. **Sauvegarde** de la base, vérifiée :

   ```bash
   pg_dump --format=custom --file=/sauvegardes/university-avant-decimal.dump "$DATABASE_URL"
   pg_restore --list /sauvegardes/university-avant-decimal.dump | head
   ```

   Le fichier doit être lisible et sa taille cohérente avec la base. Une
   sauvegarde non vérifiée n’est pas une sauvegarde.

2. **Requête de contrôle du §5** : `hors_echelle = 0` et `non_arrondi = 0`
   sur les treize tables.

3. **Maintenance** : la conversion réécrit les tables (un `ALTER COLUMN …
   TYPE` prend un verrou `ACCESS EXCLUSIVE` sur chaque table modifiée).
   Prévoir une fenêtre sans écriture pendant la migration.

### 6.2 Déploiement du code et de la migration

**Il ne faut pas laisser l’ancien code tourner contre la base convertie.**
Le type Prisma attendu par le client et le type réel de la colonne doivent
correspondre : l’ancien client attend un `double precision`, la colonne
devient un `numeric`. Tant que les deux divergent, la désérialisation des
montants par le moteur de requêtes n’est plus garantie — c’est le point
le plus fragile de l’opération, et il n’apparaît dans aucune erreur de
compilation.

La séquence retenue est donc celle d’une **fenêtre de maintenance** : on
arrête l’API, on convertit, on redémarre avec le nouveau code. L’API est
de toute façon indisponible pendant l’`ALTER` (verrou `ACCESS EXCLUSIVE`
sur chaque table modifiée).

```bash
# 1. Arrêt de l'API (fenêtre de maintenance)
pm2 stop university-api

# 2. Migration de la base (transactionnelle, hors ligne)
cd backend && npx prisma migrate deploy     # applique 20261024000000_montants_exacts

# 3. Nouveau client Prisma + build, sur la branche mc/decimal
npx prisma generate
npm run build

# 4. Redémarrage
pm2 start university-api
```

> `prisma migrate deploy` n’applique **que** les migrations non appliquées,
> dans l’ordre. La migration est un fichier SQL unique, transactionnel, sans
> donnée — elle ne peut rien détruire. Si elle échoue (montant hors
> échelle), elle est **annulée** et la base est inchangée : le retour arrière
> consiste alors à ne rien faire.

**Pourquoi pas « migration d’abord, code ensuite » ?** L’ancien code écrit
des `Float` : une insertion dans une colonne `numeric` est acceptée par
Postgres (qui convertit), mais la lecture, elle, dépend du type attendu par
le client. Un déploiement sans arrêt de l’API laisserait donc une fenêtre
où la conversion du type de colonne et celle du type attendu par le client
sont désynchronisées. L’arrêt de l’API supprime cette fenêtre.

Si l’on ne dispose pas d’une fenêtre de maintenance, l’ordre
« code d’abord, migration ensuite » est également possible : le nouveau
client (qui attend un `numeric`) lit alors des `double precision`. C’est
moins sûr que l’arrêt de l’API, car les deux écarts sont alors possibles en
sens inverse. Dans les deux cas, **le redéploiement du client Prisma
(`prisma generate`) est obligatoire** : sans lui, le client conserve les
types de l’ancien schéma.

### 6.3 Vérification

1. Requête de contrôle « après » du §5 : les colonnes sont en
   `numeric(14,2)`, les sommes sont inchangées, `non_arrondi = 0`.
2. **Contrôle fonctionnel** : un paiement d’essai et un recalcul de feuille
   de paie sur une feuille de brouillon.
3. Contrôle de la sortie JSON : les montants doivent être des **nombres**,
   pas des chaînes.

   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" "$API/api/paiements" | head -c 400
   # attendu : "montant":1500   —  PAS  "montant":"1500"
   ```

4. Contrôle du formatage : les impressions A4 (feuille de paie, certificat
   d’inscription) affichent bien `1 500,00` et non `1500`.

### 6.4 Retour arrière

Le retour arrière est **le même script que l’aller**, dans l’autre sens :
les valeurs sont converties à l’identique (au centième), la conversion est
réversible.

```sql
ALTER TABLE "Paiement" ALTER COLUMN "montant" SET DATA TYPE DOUBLE PRECISION USING "montant"::double precision;
-- … et les douze autres tables (même liste que la migration)
```

En pratique, on préfère **restaurer la sauvegarde** : elle garantit un
retour à l’état exact d’avant, là où la conversion inverse réintroduit
l’imprécision du flottant. La restauration suppose que les écritures
réalisées entre la sauvegarde et le retour arrière soient perdues — d’où la
fenêtre de maintenance du §6.1.

Si la migration a été appliquée mais que le code n’a pas été redémarré,
l’ancien code fonctionne toujours (PostgreSQL convertit à l’insertion) :
c’est l’état le moins risqué, et il ne faut surtout **pas** redémarrer
l’API avec le nouveau code avant d’avoir vérifié la sauvegarde.

---

## 7. Risques

| Risque | Gravité | Traitement |
| --- | --- | --- |
| Perte de centimes à la conversion | moyenne | contrôlé par la requête `non_arrondi` avant migration ; `numeric(14,2)` conserve le centième |
| Montant hors échelle (≥ 10¹²) | faible | l’`ALTER` échoue en transaction ; contrôlé par `hors_echelle` avant migration |
| Verrou long pendant la réécriture | moyenne | fenêtre de maintenance ; la table la plus grosse est `Paiement` |
| Un `Decimal` fuit en chaîne dans le JSON | **élevée** | `MontantInterceptor` + `sansSecrets()` ; test de non-régression dans `montant.spec.ts` |
| `Decimal(0)` traité comme « vrai » | **élevée** | converti explicitement partout où un test de vérité s’applique ; test dédié dans `montant.spec.ts` |
| `toLocaleString()` sans argument sur un `Decimal` | **élevée** | formatage audio ; corrigé sur les six impressions concernées |
| Somme SQL re-castée en `double precision` | **élevée** | transtypage retiré dans `formations.service.ts` |
| Code non recompilé après la migration | moyenne | `prisma generate` puis `npm run build` sont dans la procédure |
| Type de colonne et type attendu par le client désynchronisés | **élevée** | arrêt de l’API pendant la migration (§6.2) : pas d’état mixte |
| `Decimal` désérialisé par un client qui attend un `Float` | **élevée** | même parade : l’API est arrêtée pendant la conversion, puis redémarrée avec le nouveau client |

### Hors périmètre

- Le **portefeuille resto** reste en `Int` (§2) : déjà exact, hors du
  périmètre « Float → exact ».
- Les **taux et pourcentages** restent en `Float` : ce ne sont pas des
  montants (§1).
- La **conversion vers `Decimal` côté requêtes** n’est pas retroactive : les
  enregistrements antérieurs à la migration ne sont pas re-calculés.

---

## 8. Vérifications effectuées

Sur la branche `mc/decimal`, sans aucune base touchée :

| Contrôle | Résultat |
| --- | --- |
| `tsc --noEmit` (backend) | 0 erreur |
| `jest --runInBand` (backend) | 130 suites, 1169 tests réussis (dont 16 nouveaux) |
| `vue-tsc --noEmit` (frontend) | 0 erreur |
| `vitest run` (frontend) | 151 tests réussis |
| `eslint` (backend et frontend) | 0 erreur |
| `prisma migrate diff` (hors ligne) | 16 `ALTER COLUMN … TYPE` — conforme à la migration écrite |

Le SQL de la migration a été produit **hors ligne** par :

```bash
prisma migrate diff \
  --from-schema-datamodel <ancien schéma> \
  --to-schema-datamodel <nouveau schéma> \
  --script
```

Aucune connexion à une base n’a été établie, ni en production, ni en QA.
