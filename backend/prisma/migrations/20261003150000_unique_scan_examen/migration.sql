DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ScanExamen"
    WHERE "inscriptionId" IS NOT NULL
    GROUP BY "examenId", "inscriptionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate examination scans exist; reconcile them before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "ScanExamen_examenId_inscriptionId_key"
ON "ScanExamen" ("examenId", "inscriptionId");
