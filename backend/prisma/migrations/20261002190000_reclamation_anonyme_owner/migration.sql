-- Keep anonymous reports addressable by their author without exposing identity.
ALTER TABLE "Reclamation" ADD COLUMN "createurId" TEXT;

CREATE INDEX "Reclamation_createurId_idx" ON "Reclamation"("createurId");

ALTER TABLE "Reclamation"
  ADD CONSTRAINT "Reclamation_createurId_fkey"
  FOREIGN KEY ("createurId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
