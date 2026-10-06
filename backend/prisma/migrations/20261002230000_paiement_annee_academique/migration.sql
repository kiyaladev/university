ALTER TABLE "Paiement"
ADD COLUMN "anneeId" TEXT;

UPDATE "Paiement" AS paiement
SET "anneeId" = inscription."anneeId"
FROM "Inscription" AS inscription
WHERE paiement."inscriptionId" = inscription."id"
  AND paiement."anneeId" IS NULL;

CREATE INDEX "Paiement_anneeId_idx" ON "Paiement"("anneeId");

ALTER TABLE "Paiement"
ADD CONSTRAINT "Paiement_anneeId_fkey"
FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
