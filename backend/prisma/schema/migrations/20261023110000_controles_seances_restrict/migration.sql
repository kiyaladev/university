-- Les contrôles (pointages) et les justificatifs sont la preuve opposable de
-- l'application et la base de la paie des vacataires : ils ne doivent plus
-- disparaître en cascade.
--
--  - Controle.seanceId, Justificatif.seanceId : CASCADE -> RESTRICT ;
--  - Justificatif.enseignantId : CASCADE -> RESTRICT ;
--  - Seance.affectationId : CASCADE -> RESTRICT. Le service supprime d'abord
--    explicitement les séances sans contrôle ni justificatif et refuse (409)
--    s'il en reste une pointée. Supprimer un enseignant ou une matière (qui
--    efface ses affectations en cascade) échoue donc tant que des séances y
--    sont rattachées : 409 traduit par supprimerOuConflit.
--
-- Creneau.affectationId reste en CASCADE : un créneau n'est qu'un gabarit,
-- et Seance.creneauId est en SET NULL.

-- DropForeignKey
ALTER TABLE "Seance" DROP CONSTRAINT "Seance_affectationId_fkey";

-- DropForeignKey
ALTER TABLE "Controle" DROP CONSTRAINT "Controle_seanceId_fkey";

-- DropForeignKey
ALTER TABLE "Justificatif" DROP CONSTRAINT "Justificatif_seanceId_fkey";

-- DropForeignKey
ALTER TABLE "Justificatif" DROP CONSTRAINT "Justificatif_enseignantId_fkey";

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "Affectation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controle" ADD CONSTRAINT "Controle_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "Seance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificatif" ADD CONSTRAINT "Justificatif_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "Seance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificatif" ADD CONSTRAINT "Justificatif_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
