-- Unicité du bulletin pour TOUS les électeurs, pas seulement les étudiants.
--
-- `VoteElection.etudiantId` était nul pour un enseignant, un contrôleur ou un
-- administrateur. PostgreSQL considérant deux NULL comme distincts, la
-- contrainte @@unique([electionId, candidatId, etudiantId]) ne jouait pas pour
-- eux : ces électeurs pouvaient déposer autant de bulletins qu'ils voulaient,
-- et « ai-je déjà voté ? » leur répondait toujours non.
--
-- La colonne `electeurId` porte désormais l'électeur quel que soit son rôle.
-- L'ancienne contrainte est conservée : elle protège l'historique déjà en base.

ALTER TABLE "VoteElection" ADD COLUMN "electeurId" TEXT;

CREATE INDEX "VoteElection_electionId_electeurId_idx" ON "VoteElection"("electionId", "electeurId");

CREATE UNIQUE INDEX "VoteElection_electionId_candidatId_electeurId_key" ON "VoteElection"("electionId", "candidatId", "electeurId");

ALTER TABLE "VoteElection" ADD CONSTRAINT "VoteElection_electeurId_fkey" FOREIGN KEY ("electeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
