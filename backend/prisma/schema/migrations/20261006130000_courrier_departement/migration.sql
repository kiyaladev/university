ALTER TABLE "Courrier" ADD COLUMN "departementId" TEXT;
CREATE INDEX "Courrier_departementId_idx" ON "Courrier"("departementId");
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_departementId_fkey"
  FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
