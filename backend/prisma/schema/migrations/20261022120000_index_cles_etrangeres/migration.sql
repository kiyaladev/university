-- Index sur les clés étrangères réellement utilisées en filtre.
--
-- Un audit a relevé 114 clés étrangères sans index en tête. Seules celles qui
-- servent dans un `where`, un `orderBy`, un `_count` ou un `include` de
-- relation (listes, tableaux de bord, portail, rapports) sont indexées ici ;
-- les colonnes d'audit (creeParId, traiteParId…) jamais filtrées ne le sont
-- pas. Aucun index ne double un @@unique ou un @@index commençant déjà par le
-- même champ.
--
-- "Paiement_anneeId_idx" existe déjà en base (migration
-- 20261002230000_paiement_annee_academique) sans être déclaré dans
-- schema.prisma : il est désormais déclaré, l'instruction ci-dessous est un
-- no-op en base mais supprime la dérive schéma/base.
--
-- `IF NOT EXISTS` rend le script rejouable si un index a été posé à la main.
-- Aucune règle onDelete ni aucun type de colonne n'est modifié.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Promotion_anneeId_idx" ON "Promotion"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Enseignant_departementId_idx" ON "Enseignant"("departementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Affectation_anneeId_promotionId_idx" ON "Affectation"("anneeId", "promotionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Affectation_promotionId_idx" ON "Affectation"("promotionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Seance_salleId_date_idx" ON "Seance"("salleId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Controle_controleurId_idx" ON "Controle"("controleurId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Justificatif_enseignantId_idx" ON "Justificatif"("enseignantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Inscription_anneeId_promotionId_idx" ON "Inscription"("anneeId", "promotionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Inscription_promotionId_idx" ON "Inscription"("promotionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Paiement_etudiantId_idx" ON "Paiement"("etudiantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Paiement_anneeId_idx" ON "Paiement"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Evaluation_anneeId_idx" ON "Evaluation"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attestation_etudiantId_idx" ON "Attestation"("etudiantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attestation_anneeId_idx" ON "Attestation"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attestation_promotionId_idx" ON "Attestation"("promotionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Chambre_residenceId_idx" ON "Chambre"("residenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttributionLogement_chambreId_idx" ON "AttributionLogement"("chambreId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttributionLogement_etudiantId_idx" ON "AttributionLogement"("etudiantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttributionLogement_anneeId_idx" ON "AttributionLogement"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentDepot_departementId_idx" ON "DocumentDepot"("departementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SuspicionPlagiat_documentAId_documentBId_idx" ON "SuspicionPlagiat"("documentAId", "documentBId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Recharge_portefeuilleId_rechargeLe_idx" ON "Recharge"("portefeuilleId", "rechargeLe");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsommationResto_portefeuilleId_consommeLe_idx" ON "ConsommationResto"("portefeuilleId", "consommeLe");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TravailEncadre_etudiantId_idx" ON "TravailEncadre"("etudiantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TravailEncadre_encadrantId_idx" ON "TravailEncadre"("encadrantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketSupport_utilisateurId_idx" ON "TicketSupport"("utilisateurId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketSupport_equipementId_idx" ON "TicketSupport"("equipementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketSupport_equipementPatrimoineId_idx" ON "TicketSupport"("equipementPatrimoineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipementPatrimoine_departementId_idx" ON "EquipementPatrimoine"("departementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReparationMateriel_equipementId_idx" ON "ReparationMateriel"("equipementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Courrier_enregistreParId_idx" ON "Courrier"("enregistreParId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Examen_anneeId_idx" ON "Examen"("anneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Examen_matiereId_idx" ON "Examen"("matiereId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Examen_salleId_idx" ON "Examen"("salleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tirage_imprimeurId_idx" ON "Tirage"("imprimeurId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reclamation_departementId_idx" ON "Reclamation"("departementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reclamation_assigneAId_idx" ON "Reclamation"("assigneAId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VoteElection_candidatId_idx" ON "VoteElection"("candidatId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoursVOD_enseignantId_idx" ON "CoursVOD"("enseignantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoursVOD_inscriptionId_idx" ON "CoursVOD"("inscriptionId");
