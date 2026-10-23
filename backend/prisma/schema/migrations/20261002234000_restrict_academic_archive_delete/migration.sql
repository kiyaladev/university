ALTER TABLE "Filiere" DROP CONSTRAINT "Filiere_departementId_fkey";
ALTER TABLE "Filiere"
ADD CONSTRAINT "Filiere_departementId_fkey"
FOREIGN KEY ("departementId") REFERENCES "Departement"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Promotion" DROP CONSTRAINT "Promotion_filiereId_fkey";
ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_filiereId_fkey"
FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Affectation" DROP CONSTRAINT "Affectation_promotionId_fkey";
ALTER TABLE "Affectation"
ADD CONSTRAINT "Affectation_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inscription" DROP CONSTRAINT "Inscription_promotionId_fkey";
ALTER TABLE "Inscription"
ADD CONSTRAINT "Inscription_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Frais" DROP CONSTRAINT "Frais_promotionId_fkey";
ALTER TABLE "Frais"
ADD CONSTRAINT "Frais_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_promotionId_fkey";
ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Deliberation" DROP CONSTRAINT "Deliberation_promotionId_fkey";
ALTER TABLE "Deliberation"
ADD CONSTRAINT "Deliberation_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Examen" DROP CONSTRAINT "Examen_promotionId_fkey";
ALTER TABLE "Examen"
ADD CONSTRAINT "Examen_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
