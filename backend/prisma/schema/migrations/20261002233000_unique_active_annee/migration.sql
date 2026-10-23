DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "AnneeAcademique" WHERE "active" = true) > 1 THEN
    RAISE EXCEPTION 'Several academic years are active; resolve the active year before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "AnneeAcademique_active_key"
ON "AnneeAcademique" ("active")
WHERE "active" = true;
