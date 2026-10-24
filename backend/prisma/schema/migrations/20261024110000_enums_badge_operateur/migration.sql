-- Chaînes libres → énumérations : `BadgeAcces.type` et `Paiement.operateur`.
--
-- Décision et analyse complète : docs/decisions/donnees.md (§ « Chaînes
-- libres → énumérations »).
--
-- Ces deux colonnes portaient une chaîne libre saisie à la main :
--   * `BadgeAcces.type` : « VISITEUR », « INTERVENANT », « TECHNICIEN », « VIP »
--     — la liste était dupliquée dans le DTO backend, dans le type TypeBadge
--     du frontend et dans le seed, sans garantie qu'ils concordent ;
--   * `Paiement.operateur` : « ORANGE_MONEY », « MTN_MOMO », « TELECEL »…
--     — la liste `OPERATEURS_MOBILE_MONEY` du backend n'était validée que sur
--     deux des cinq portefeuilles (inscriptions et restaurant) : une demande
--     de document ou une recette pouvait écrire un opérateur inconnu en base.
--
-- Les valeurs retenues sont celles du code et du jeu de démonstration
-- (backend/src/common/finances/paiement.ts, backend/prisma/seed.ts,
-- backend/src/modules/documents/badges/badges.dto.ts).
--
-- Déroulement, dans l'ordre :
--   1. création du type énumération ;
--   2. normalisation des valeurs existantes (casse, espaces, libellés
--      usuels) — les lignes déjà écrites restent attachées à leur document ;
--   3. contrôle : toute valeur qui ne se ramène pas à une valeur de
--      l'énumération fait échouer la migration, en nommant les valeurs
--      fautives. La migration est atomique : elle ne laisse pas la colonne
--      à moitié convertie ;
--   4. conversion de la colonne.
--
-- Contrôle à jouer AVANT cette migration (voir docs/decisions/donnees.md) :
--
--   SELECT "type", count(*) FROM "BadgeAcces" GROUP BY 1 ORDER BY 2 DESC;
--   SELECT "operateur", count(*) FROM "Paiement"
--    WHERE "operateur" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
--
-- Si une valeur inattendue apparaît, elle est corrigée dans la base (ou
-- ramenée à « AUTRE » pour `Paiement.operateur`) avant de rejouer la
-- migration : celle-ci doit échouer plutôt que d'inventer une valeur.

-- ---------------------------------------------------------------------------
-- 1. Types énumération
-- ---------------------------------------------------------------------------

CREATE TYPE "TypeBadge" AS ENUM ('VISITEUR', 'INTERVENANT', 'TECHNICIEN', 'VIP');

CREATE TYPE "OperateurPaiement" AS ENUM ('ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE');

-- ---------------------------------------------------------------------------
-- 2. Normalisation des valeurs déjà enregistrées
-- ---------------------------------------------------------------------------

-- Badge : la casse et les espaces parasites sont ramenés à la valeur
-- canonique. Les libellés usuels (« Visiteur », « VIP ») sont acceptés.
UPDATE "BadgeAcces" AS b
   SET "type" = CASE upper(btrim(b."type"))
     WHEN 'VISITEUR' THEN 'VISITEUR'
     WHEN 'INTERVENANT' THEN 'INTERVENANT'
     WHEN 'TECHNICIEN' THEN 'TECHNICIEN'
     WHEN 'VIP' THEN 'VIP'
     ELSE b."type"
   END
 WHERE upper(btrim(b."type")) IN ('VISITEUR', 'INTERVENANT', 'TECHNICIEN', 'VIP')
   AND b."type" <> upper(btrim(b."type"));

-- Opérateur : « Orange Money », « orange_money », « ORANGE », « MTN MoMo »…
-- sont ramenés à la valeur de l'énumération.
UPDATE "Paiement" AS p
   SET "operateur" = CASE
     WHEN upper(btrim(p."operateur")) IN ('ORANGE', 'ORANGE MONEY', 'ORANGE_MONEY', 'ORANGEMONEY')
       THEN 'ORANGE_MONEY'
     WHEN upper(btrim(p."operateur")) IN ('MTN', 'MTN MOMO', 'MTN_MOMO', 'MTNMOMO', 'MOMO')
       THEN 'MTN_MOMO'
     WHEN upper(btrim(p."operateur")) IN ('TELECEL', 'TELECEL MONEY', 'TELECEL_MONEY')
       THEN 'TELECEL'
     WHEN upper(btrim(p."operateur")) IN ('AUTRE', 'AUTRES', 'OTHER')
       THEN 'AUTRE'
     ELSE p."operateur"
   END
 WHERE p."operateur" IS NOT NULL
   AND p."operateur" NOT IN ('ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE')
   AND upper(btrim(p."operateur")) IN (
     'ORANGE', 'ORANGE MONEY', 'ORANGE_MONEY', 'ORANGEMONEY',
     'MTN', 'MTN MOMO', 'MTN_MOMO', 'MTNMOMO', 'MOMO',
     'TELECEL', 'TELECEL MONEY', 'TELECEL_MONEY',
     'AUTRE', 'AUTRES', 'OTHER'
   );

-- ---------------------------------------------------------------------------
-- 3. Contrôle : aucune valeur inconnue ne doit subsister
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  valeurs_inconnues text;
BEGIN
  SELECT string_agg(valeur, ', ') INTO valeurs_inconnues
    FROM (
      SELECT DISTINCT b."type" AS valeur
        FROM "BadgeAcces" b
       WHERE b."type" NOT IN ('VISITEUR', 'INTERVENANT', 'TECHNICIEN', 'VIP')
      UNION
      SELECT DISTINCT p."operateur"
        FROM "Paiement" p
       WHERE p."operateur" IS NOT NULL
         AND p."operateur" NOT IN ('ORANGE_MONEY', 'MTN_MOMO', 'TELECEL', 'AUTRE')
    ) AS inconnues;
  IF valeurs_inconnues IS NOT NULL THEN
    RAISE EXCEPTION
      'Valeurs hors enum non converties : %. Corriger ces lignes puis rejouer la migration.',
      valeurs_inconnues;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Conversion des colonnes
-- ---------------------------------------------------------------------------

ALTER TABLE "BadgeAcces"
  ALTER COLUMN "type" TYPE "TypeBadge" USING ("type"::"TypeBadge");

ALTER TABLE "Paiement"
  ALTER COLUMN "operateur" TYPE "OperateurPaiement" USING ("operateur"::"OperateurPaiement");

-- ---------------------------------------------------------------------------
-- Retour arrière
-- ---------------------------------------------------------------------------
-- Les colonnes redeviennent des chaînes ; les valeurs de l'énumération sont
-- alors rendues telles quelles (les lignes normalisées gardent donc la
-- forme canonique, pas la forme d'origine).
--
--   ALTER TABLE "BadgeAcces" ALTER COLUMN "type" TYPE TEXT USING ("type"::TEXT);
--   ALTER TABLE "Paiement" ALTER COLUMN "operateur" TYPE TEXT USING ("operateur"::TEXT);
--   DROP TYPE "TypeBadge";
--   DROP TYPE "OperateurPaiement";
--
-- Le code applicatif doit être redéployé dans le même temps que ce retour
-- arrière : il écrit désormais les valeurs de l'énumération.
