-- Cohérence des règles de suppression : ON DELETE CASCADE -> RESTRICT.
--
-- Quatre relations encore en CASCADE effaçaient silencieusement des
-- données qui doivent être conservées, ou faisaient échouer la suppression
-- à mi-chemin :
--
--  1. Evaluation.matiereId : les notes (Note.evaluationId) sont déjà en
--     RESTRICT. En CASCADE, supprimer une matière effaçait ses évaluations
--     puis échouait sur les notes : la suppression était refusée au milieu
--     du chemin. Le service du référentiel matières traduit l'échec en 409
--     (supprimerOuConflit), mais mieux vaut que la base refuse d'emblée,
--     et atomiquement, de supprimer une matière évaluée.
--
--  2. Residence.chambreId -> Chambre.residenceId : supprimer une résidence
--     effaçait les chambres, et par cascade l'historique d'attribution.
--
--  3. AttributionLogement.chambreId : une attribution est l'historique de
--     l'occupation d'une chambre (critères sociaux, dates, retrait).
--     Elle ne disparaît plus avec la chambre.
--
--  4. AttributionLogement.etudiantId : cohérent avec les autres relations
--     vers Etudiant (inscription, paiement, demande de document), toutes en
--     RESTRICT.
--
-- Effet applicatif : les suppressions sont refusées plus tôt, jamais en
-- 500. Le service des cités vérifie déjà l'absence de chambres (résidence)
-- et d'attributions (chambre) avant de supprimer, et renvoie un 400
-- explicite ; le référentiel matières traduit le refus de la base en 409.
--
-- Aucune donnée n'est supprimée par cette migration : elle ne change que
-- la règle de suppression des clés étrangères.
--
-- Contrôle avant déploiement (base de production) : aucune ligne orpheline
-- n'est nécessaire (RESTRICT ne supprime rien), mais on peut vérifier
-- qu'aucune matière évaluée, chambre attribuée ou attribution en cours
-- n'est en attente d'une suppression en cascade :
--
--   SELECT m."id" FROM "Matiere" m
--     JOIN "Evaluation" e ON e."matiereId" = m."id" LIMIT 10;
--   SELECT c."id" FROM "Chambre" c
--     JOIN "AttributionLogement" a ON a."chambreId" = c."id" LIMIT 10;

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_matiereId_fkey";

-- DropForeignKey
ALTER TABLE "Chambre" DROP CONSTRAINT "Chambre_residenceId_fkey";

-- DropForeignKey
ALTER TABLE "AttributionLogement" DROP CONSTRAINT "AttributionLogement_chambreId_fkey";

-- DropForeignKey
ALTER TABLE "AttributionLogement" DROP CONSTRAINT "AttributionLogement_etudiantId_fkey";

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chambre" ADD CONSTRAINT "Chambre_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
