ALTER TABLE "Election" DROP CONSTRAINT "Election_promotionId_fkey";
ALTER TABLE "Election"
ADD CONSTRAINT "Election_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Election" DROP CONSTRAINT "Election_departementId_fkey";
ALTER TABLE "Election"
ADD CONSTRAINT "Election_departementId_fkey"
FOREIGN KEY ("departementId") REFERENCES "Departement"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
