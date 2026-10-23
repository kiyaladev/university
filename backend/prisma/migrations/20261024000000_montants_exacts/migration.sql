-- Conversion des montants de `double precision` (Float) vers `numeric(14,2)`.
--
-- Décision : docs/decisions/montants.md
--
-- Principes :
--   * la conversion est EXACTE : `double precision` → `numeric(14,2)` arrondit
--     au centième, sans perte de centime (PostgreSQL >= 12 sérialise un
--     `float8` par sa représentation la plus courte qui fait le tour, donc
--     0.1_float8 devient 0.1_numeric, pas 0.1000000000000000055) ;
--   * le `USING` est explicite : il dit exactement quelle conversion est
--     appliquée, et rend la migration lisible si Postgres exige un casting
--     dans une version ultérieure ;
--   * l'opération est atomique : Prisma exécute ce fichier dans une
--     transaction. Un montant hors échelle (>= 1 000 000 000 000) fait
--     échouer le `ALTER` (`numeric field overflow`) et laisse la table
--     intacte — c'est le comportement voulu, pas un silence.
--
-- Contrôle avant déploiement (à passer sur la base de production) :
--
--   SELECT 'Paiement' AS table, count(*) FILTER (WHERE montant >= 1000000000000) AS hors_echelle,
--          count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) AS non_arrondi
--     FROM "Paiement"
--   UNION ALL SELECT 'Frais',          count(*) FILTER (WHERE montant >= 1000000000000), count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) FROM "Frais"
--   UNION ALL SELECT 'Inscription',    count(*) FILTER (WHERE "montantFrais" >= 1000000000000), count(*) FILTER (WHERE "montantFrais" <> round("montantFrais"::numeric, 2)) FROM "Inscription"
--   UNION ALL SELECT 'Enseignant',     count(*) FILTER (WHERE "tauxHoraire" >= 1000000000000), count(*) FILTER (WHERE "tauxHoraire" <> round("tauxHoraire"::numeric, 2)) FROM "Enseignant"
--   UNION ALL SELECT 'FeuillePaie',    count(*) FILTER (WHERE "montantTotal" >= 1000000000000), count(*) FILTER (WHERE "montantTotal" <> round("montantTotal"::numeric, 2)) FROM "FeuillePaie"
--   UNION ALL SELECT 'LignePaie',      count(*) FILTER (WHERE "montantBrut" >= 1000000000000 OR "montantNet" >= 1000000000000 OR "retenue" >= 1000000000000 OR "tauxHoraire" >= 1000000000000),
--                                    count(*) FILTER (WHERE "montantBrut" <> round("montantBrut"::numeric, 2) OR "montantNet" <> round("montantNet"::numeric, 2) OR "retenue" <> round("retenue"::numeric, 2) OR "tauxHoraire" <> round("tauxHoraire"::numeric, 2)) FROM "LignePaie"
--   UNION ALL SELECT 'Chambre',        count(*) FILTER (WHERE loyer >= 1000000000000), count(*) FILTER (WHERE loyer <> round(loyer::numeric, 2)) FROM "Chambre"
--   UNION ALL SELECT 'Formation',      count(*) FILTER (WHERE prix >= 1000000000000), count(*) FILTER (WHERE prix <> round(prix::numeric, 2)) FROM "Formation"
--   UNION ALL SELECT 'EquipementPatrimoine', count(*) FILTER (WHERE "valeurAcquisition" >= 1000000000000), count(*) FILTER (WHERE "valeurAcquisition" <> round("valeurAcquisition"::numeric, 2)) FROM "EquipementPatrimoine"
--   UNION ALL SELECT 'ReparationMateriel',   count(*) FILTER (WHERE cout >= 1000000000000), count(*) FILTER (WHERE cout <> round(cout::numeric, 2)) FROM "ReparationMateriel"
--   UNION ALL SELECT 'RecetteExterne', count(*) FILTER (WHERE montant >= 1000000000000), count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) FROM "RecetteExterne"
--   UNION ALL SELECT 'DemandeDocument', count(*) FILTER (WHERE frais >= 1000000000000), count(*) FILTER (WHERE frais <> round(frais::numeric, 2)) FROM "DemandeDocument"
--   UNION ALL SELECT 'TarifDemande',   count(*) FILTER (WHERE montant >= 1000000000000), count(*) FILTER (WHERE montant <> round(montant::numeric, 2)) FROM "TarifDemande";
--
--   * `hors_echelle` doit être 0 partout (sinon l'ALTER échoue) ;
--   * `non_arrondi` doit être 0 partout (sinon des centimes sont arrondis) :
--     c'est le tableau de bord avant/après de la procédure de déploiement.

-- AlterTable
ALTER TABLE "Enseignant" ALTER COLUMN "tauxHoraire" SET DATA TYPE DECIMAL(14,2) USING "tauxHoraire"::numeric(14,2);

-- AlterTable
ALTER TABLE "Inscription" ALTER COLUMN "montantFrais" SET DATA TYPE DECIMAL(14,2) USING "montantFrais"::numeric(14,2);

-- AlterTable
ALTER TABLE "Frais" ALTER COLUMN "montant" SET DATA TYPE DECIMAL(14,2) USING "montant"::numeric(14,2);

-- AlterTable
ALTER TABLE "Paiement" ALTER COLUMN "montant" SET DATA TYPE DECIMAL(14,2) USING "montant"::numeric(14,2);

-- AlterTable
ALTER TABLE "FeuillePaie" ALTER COLUMN "montantTotal" SET DATA TYPE DECIMAL(14,2) USING "montantTotal"::numeric(14,2);

-- AlterTable
ALTER TABLE "LignePaie" ALTER COLUMN "tauxHoraire" SET DATA TYPE DECIMAL(14,2) USING "tauxHoraire"::numeric(14,2),
ALTER COLUMN "montantBrut" SET DATA TYPE DECIMAL(14,2) USING "montantBrut"::numeric(14,2),
ALTER COLUMN "retenue" SET DATA TYPE DECIMAL(14,2) USING "retenue"::numeric(14,2),
ALTER COLUMN "montantNet" SET DATA TYPE DECIMAL(14,2) USING "montantNet"::numeric(14,2);

-- AlterTable
ALTER TABLE "Chambre" ALTER COLUMN "loyer" SET DATA TYPE DECIMAL(14,2) USING "loyer"::numeric(14,2);

-- AlterTable
ALTER TABLE "Formation" ALTER COLUMN "prix" SET DATA TYPE DECIMAL(14,2) USING "prix"::numeric(14,2);

-- AlterTable
ALTER TABLE "EquipementPatrimoine" ALTER COLUMN "valeurAcquisition" SET DATA TYPE DECIMAL(14,2) USING "valeurAcquisition"::numeric(14,2);

-- AlterTable
ALTER TABLE "ReparationMateriel" ALTER COLUMN "cout" SET DATA TYPE DECIMAL(14,2) USING "cout"::numeric(14,2);

-- AlterTable
ALTER TABLE "RecetteExterne" ALTER COLUMN "montant" SET DATA TYPE DECIMAL(14,2) USING "montant"::numeric(14,2);

-- AlterTable
ALTER TABLE "DemandeDocument" ALTER COLUMN "frais" SET DATA TYPE DECIMAL(14,2) USING "frais"::numeric(14,2);

-- AlterTable
ALTER TABLE "TarifDemande" ALTER COLUMN "montant" SET DATA TYPE DECIMAL(14,2) USING "montant"::numeric(14,2);
