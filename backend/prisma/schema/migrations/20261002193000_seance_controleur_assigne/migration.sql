ALTER TABLE "Seance" ADD COLUMN "controleurAssigneId" TEXT;

CREATE INDEX "Seance_controleurAssigneId_date_idx"
  ON "Seance"("controleurAssigneId", "date");

ALTER TABLE "Seance"
  ADD CONSTRAINT "Seance_controleurAssigneId_fkey"
  FOREIGN KEY ("controleurAssigneId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
