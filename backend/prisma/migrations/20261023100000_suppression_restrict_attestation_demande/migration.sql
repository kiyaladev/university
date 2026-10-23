-- Règles de suppression des données financières et académiques, lien
-- demande de document -> attestation, et exclusivité des deux inventaires
-- sur TicketSupport.
--
-- 1. ON DELETE CASCADE -> RESTRICT : supprimer un étudiant, une inscription,
--    une évaluation, un enseignant, un portefeuille resto ou une formation
--    n'efface plus silencieusement paiements, notes, lignes de délibération,
--    lignes de paie, recharges, consommations, travaux encadrés ou demandes
--    de documents. L'application désactive les étudiants (jamais de DELETE) ;
--    les autres suppressions applicatives vérifient déjà l'absence d'enfants
--    ou traduisent le refus de la base en 409.
--    Controle.controleur et EquipementPatrimoine.categorie sont rendus
--    explicites dans schema.prisma (Restrict = valeur par défaut d'une
--    relation obligatoire) : aucun SQL n'en découle.
--
-- 2. DemandeDocument.attestationId (unique, ON DELETE RESTRICT).
--
-- 3. CHECK "TicketSupport_un_seul_inventaire" (en fin de fichier).

-- DropForeignKey
ALTER TABLE "Inscription" DROP CONSTRAINT "Inscription_etudiantId_fkey";

-- DropForeignKey
ALTER TABLE "Paiement" DROP CONSTRAINT "Paiement_inscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Paiement" DROP CONSTRAINT "Paiement_etudiantId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_evaluationId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_inscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "DeliberationLigne" DROP CONSTRAINT "DeliberationLigne_inscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "LignePaie" DROP CONSTRAINT "LignePaie_enseignantId_fkey";

-- DropForeignKey
ALTER TABLE "PortefeuilleResto" DROP CONSTRAINT "PortefeuilleResto_etudiantId_fkey";

-- DropForeignKey
ALTER TABLE "Recharge" DROP CONSTRAINT "Recharge_portefeuilleId_fkey";

-- DropForeignKey
ALTER TABLE "Recharge" DROP CONSTRAINT "Recharge_etudiantId_fkey";

-- DropForeignKey
ALTER TABLE "ConsommationResto" DROP CONSTRAINT "ConsommationResto_portefeuilleId_fkey";

-- DropForeignKey
ALTER TABLE "TravailEncadre" DROP CONSTRAINT "TravailEncadre_etudiantId_fkey";

-- DropForeignKey
ALTER TABLE "InscriptionFormation" DROP CONSTRAINT "InscriptionFormation_formationId_fkey";

-- DropForeignKey
ALTER TABLE "DemandeDocument" DROP CONSTRAINT "DemandeDocument_etudiantId_fkey";

-- AlterTable
ALTER TABLE "DemandeDocument" ADD COLUMN     "attestationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DemandeDocument_attestationId_key" ON "DemandeDocument"("attestationId");

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliberationLigne" ADD CONSTRAINT "DeliberationLigne_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LignePaie" ADD CONSTRAINT "LignePaie_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortefeuilleResto" ADD CONSTRAINT "PortefeuilleResto_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recharge" ADD CONSTRAINT "Recharge_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleResto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recharge" ADD CONSTRAINT "Recharge_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsommationResto" ADD CONSTRAINT "ConsommationResto_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleResto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailEncadre" ADD CONSTRAINT "TravailEncadre_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionFormation" ADD CONSTRAINT "InscriptionFormation_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeDocument" ADD CONSTRAINT "DemandeDocument_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeDocument" ADD CONSTRAINT "DemandeDocument_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "Attestation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK écrit à la main : Prisma ne représente pas les contraintes CHECK
-- (elle n'apparaît pas dans schema.prisma et `migrate diff` ne la voit pas).
-- Un ticket vise au plus un équipement : celui de l'inventaire Helpdesk
-- (EquipementCampus) OU celui du patrimoine (EquipementPatrimoine).
-- Échoue si une ligne existante renseigne les deux colonnes (voir la requête
-- de contrôle à lancer avant `migrate deploy`).
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_un_seul_inventaire"
  CHECK ("equipementId" IS NULL OR "equipementPatrimoineId" IS NULL);
