-- Une suppression d'année ne doit jamais cascader dans les archives métier.
-- Même les relations facultatives restent rattachées à l'année historique.
ALTER TABLE "Promotion" DROP CONSTRAINT "Promotion_anneeId_fkey";
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Affectation" DROP CONSTRAINT "Affectation_anneeId_fkey";
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Seance" DROP CONSTRAINT "Seance_anneeId_fkey";
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inscription" DROP CONSTRAINT "Inscription_anneeId_fkey";
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Frais" DROP CONSTRAINT "Frais_anneeId_fkey";
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_anneeId_fkey";
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Deliberation" DROP CONSTRAINT "Deliberation_anneeId_fkey";
ALTER TABLE "Deliberation" ADD CONSTRAINT "Deliberation_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attestation" DROP CONSTRAINT "Attestation_anneeId_fkey";
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeuillePaie" DROP CONSTRAINT "FeuillePaie_anneeAcademiqueId_fkey";
ALTER TABLE "FeuillePaie" ADD CONSTRAINT "FeuillePaie_anneeAcademiqueId_fkey"
  FOREIGN KEY ("anneeAcademiqueId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttributionLogement" DROP CONSTRAINT "AttributionLogement_anneeId_fkey";
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatistiqueMesrs" DROP CONSTRAINT "StatistiqueMesrs_anneeId_fkey";
ALTER TABLE "StatistiqueMesrs" ADD CONSTRAINT "StatistiqueMesrs_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Examen" DROP CONSTRAINT "Examen_anneeId_fkey";
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_anneeId_fkey"
  FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
