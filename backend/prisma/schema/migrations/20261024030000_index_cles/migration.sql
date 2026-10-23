-- Index sur les clés étrangères réellement filtrées.
--
-- Complète la migration 20261022120000_index_cles_etrangeres, qui avait
-- indexé les clés étrangères les plus sollicitées. Cinq clés restaient sans
-- index alors qu'elles servent réellement dans un `where` :
--
--  - VerificationAttestation.attestationId : journal des vérifications QR
--    d'une attestation (modules/attestations/attestations.service.ts) ;
--  - Creneau.affectationId : créneaux d'une affectation, supprimés avec
--    elle (modules/referentiel/affectations.ts) ;
--  - Seance.anneeId : planning et contrôle des années ouvertes
--    (modules/planification/seances.service.ts) ;
--  - Promotion.filiereId : structure LMD, promotions d'une filière
--    (modules/referentiel/structure.ts) ;
--  - Deliberation.promotionId : jury d'une promotion
--    (modules/scolarite/scolarite.service.ts).
--
-- Aucun de ces index ne double un @@unique ou un @@index déjà déclaré
-- commençant par le même champ. `IF NOT EXISTS` rend le script rejouable.
--
-- Contrôle avant déploiement (base de production) :
--
--   SELECT tablename, indexname FROM pg_indexes
--    WHERE indexname IN ('VerificationAttestation_attestationId_idx',
--                         'Creneau_affectationId_idx',
--                         'Seance_anneeId_idx',
--                         'Promotion_filiereId_idx',
--                         'Deliberation_promotionId_idx');

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationAttestation_attestationId_idx" ON "VerificationAttestation"("attestationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Creneau_affectationId_idx" ON "Creneau"("affectationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Seance_anneeId_idx" ON "Seance"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Promotion_filiereId_idx" ON "Promotion"("filiereId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deliberation_promotionId_idx" ON "Deliberation"("promotionId");
