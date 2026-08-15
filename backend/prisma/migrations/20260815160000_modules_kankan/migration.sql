-- CreateEnum
CREATE TYPE "CategorieChambre" AS ENUM ('CHAMBRE_SIMPLE', 'CHAMBRE_PARTAGEE', 'STUDIO', 'APPARTEMENT');

-- CreateEnum
CREATE TYPE "StatutChambre" AS ENUM ('LIBRE', 'RESERVEE', 'OCCUPEE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "StatutAttributionLogement" AS ENUM ('EN_ATTENTE', 'ACCORDEE', 'REFUSEE', 'RETIREE');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('MEMOIRE', 'THESE', 'ARTICLE', 'RAPPORT', 'SUPPORT_COURS', 'ARCHIVE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeRepas" AS ENUM ('PETIT_DEJEUNER', 'DEJEUNER', 'COLLATION', 'DINER', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutConsommation" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutReservationSalle" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'REFUSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeEncadrement" AS ENUM ('STAGE', 'MEMOIRE', 'RAPPORT');

-- CreateEnum
CREATE TYPE "StatutEncadrement" AS ENUM ('PROPOSE', 'VALIDE', 'EN_COURS', 'SOUTENU', 'ABANDONNE');

-- CreateEnum
CREATE TYPE "CategorieIncident" AS ENUM ('VIDEO', 'SON', 'RESEAU', 'ELECTRICITE', 'MOBILIER', 'INFORMATIQUE', 'CLIMATISATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "PrioriteTicket" AS ENUM ('BASSE', 'NORMALE', 'HAUTE');

-- CreateEnum
CREATE TYPE "StatutTicket" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutFormation" AS ENUM ('BROUILLON', 'PUBLIEE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "StatutInscriptionFormation" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'ANNULEE');

-- AlterTable
ALTER TABLE "Etudiant" ADD COLUMN     "qrRestoToken" TEXT;

-- CreateTable
CREATE TABLE "Residence" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT,
    "adresse" TEXT,
    "capacite" INTEGER NOT NULL DEFAULT 0,
    "responsable" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Residence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chambre" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "categorie" "CategorieChambre" NOT NULL DEFAULT 'CHAMBRE_PARTAGEE',
    "lits" INTEGER NOT NULL DEFAULT 2,
    "loyer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "statut" "StatutChambre" NOT NULL DEFAULT 'LIBRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionLogement" (
    "id" TEXT NOT NULL,
    "chambreId" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "anneeId" TEXT,
    "statut" "StatutAttributionLogement" NOT NULL DEFAULT 'EN_ATTENTE',
    "critereScore" INTEGER,
    "justificatif" TEXT,
    "accorderParId" TEXT,
    "accordeeLe" DATE,
    "retireeLe" TIMESTAMP(3),
    "retireeMotif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributionLogement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentDepot" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeDocument" NOT NULL DEFAULT 'AUTRE',
    "auteurs" TEXT,
    "anneeEdition" INTEGER,
    "resume" TEXT,
    "fichier" TEXT,
    "typeMime" TEXT,
    "tailleKo" INTEGER,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "departementId" TEXT,
    "enseignantId" TEXT,
    "etudiantId" TEXT,
    "deposeParId" TEXT,
    "telechargements" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentDepot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortefeuilleResto" (
    "id" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "solde" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortefeuilleResto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recharge" (
    "id" TEXT NOT NULL,
    "portefeuilleId" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "paiementId" TEXT,
    "rechargeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsommationResto" (
    "id" TEXT NOT NULL,
    "portefeuilleId" TEXT NOT NULL,
    "etudiant" TEXT NOT NULL,
    "repas" "TypeRepas" NOT NULL,
    "montant" INTEGER NOT NULL,
    "cantine" TEXT,
    "statut" "StatutConsommation" NOT NULL DEFAULT 'EN_ATTENTE',
    "valideurId" TEXT,
    "valideLe" TIMESTAMP(3),
    "consommeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsommationResto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationSalle" (
    "id" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "organisme" TEXT,
    "dateJour" DATE NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "responsable" TEXT,
    "statut" "StatutReservationSalle" NOT NULL DEFAULT 'EN_ATTENTE',
    "demandeurId" TEXT,
    "refuseParId" TEXT,
    "refuseMotif" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationSalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravailEncadre" (
    "id" TEXT NOT NULL,
    "type" "TypeEncadrement" NOT NULL DEFAULT 'MEMOIRE',
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "etudiantId" TEXT NOT NULL,
    "encadrantId" TEXT,
    "entreprise" TEXT,
    "tuteurEntreprise" TEXT,
    "lieu" TEXT,
    "dateDebut" DATE,
    "dateFin" DATE,
    "statut" "StatutEncadrement" NOT NULL DEFAULT 'PROPOSE',
    "rapportRendu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravailEncadre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Soutenance" (
    "id" TEXT NOT NULL,
    "travailEncadreId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "salleId" TEXT,
    "presidentId" TEXT,
    "assesseurs" TEXT,
    "note" DOUBLE PRECISION,
    "mention" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Soutenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipementCampus" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "emplacement" TEXT,
    "codeQr" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipementCampus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSupport" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "equipementId" TEXT,
    "categorie" "CategorieIncident" NOT NULL DEFAULT 'AUTRE',
    "description" TEXT NOT NULL,
    "priorite" "PrioriteTicket" NOT NULL DEFAULT 'NORMALE',
    "statut" "StatutTicket" NOT NULL DEFAULT 'OUVERT',
    "declarantNom" TEXT,
    "declarantEmail" TEXT,
    "declarantTelephone" TEXT,
    "utilisateurId" TEXT,
    "traiteParId" TEXT,
    "traiteLe" TIMESTAMP(3),
    "clicheLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "prix" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "dureeHeures" INTEGER,
    "dateDebut" DATE,
    "dateFin" DATE,
    "lieu" TEXT,
    "capacite" INTEGER,
    "statut" "StatutFormation" NOT NULL DEFAULT 'BROUILLON',
    "creeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscriptionFormation" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "etudiantId" TEXT,
    "nomComplet" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "statut" "StatutInscriptionFormation" NOT NULL DEFAULT 'EN_ATTENTE',
    "paiementId" TEXT,
    "inscriteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscriptionFormation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Residence_code_key" ON "Residence"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Chambre_code_key" ON "Chambre"("code");

-- CreateIndex
CREATE INDEX "Chambre_statut_idx" ON "Chambre"("statut");

-- CreateIndex
CREATE INDEX "AttributionLogement_statut_idx" ON "AttributionLogement"("statut");

-- CreateIndex
CREATE INDEX "DocumentDepot_type_idx" ON "DocumentDepot"("type");

-- CreateIndex
CREATE INDEX "DocumentDepot_public_idx" ON "DocumentDepot"("public");

-- CreateIndex
CREATE UNIQUE INDEX "PortefeuilleResto_etudiantId_key" ON "PortefeuilleResto"("etudiantId");

-- CreateIndex
CREATE INDEX "ConsommationResto_statut_idx" ON "ConsommationResto"("statut");

-- CreateIndex
CREATE INDEX "ReservationSalle_salleId_dateJour_idx" ON "ReservationSalle"("salleId", "dateJour");

-- CreateIndex
CREATE INDEX "TravailEncadre_statut_idx" ON "TravailEncadre"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Soutenance_travailEncadreId_key" ON "Soutenance"("travailEncadreId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipementCampus_codeQr_key" ON "EquipementCampus"("codeQr");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSupport_numero_key" ON "TicketSupport"("numero");

-- CreateIndex
CREATE INDEX "TicketSupport_statut_idx" ON "TicketSupport"("statut");

-- CreateIndex
CREATE INDEX "Formation_statut_idx" ON "Formation"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionFormation_numero_key" ON "InscriptionFormation"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionFormation_paiementId_key" ON "InscriptionFormation"("paiementId");

-- CreateIndex
CREATE INDEX "InscriptionFormation_formationId_idx" ON "InscriptionFormation"("formationId");

-- CreateIndex
CREATE UNIQUE INDEX "Etudiant_qrRestoToken_key" ON "Etudiant"("qrRestoToken");

-- AddForeignKey
ALTER TABLE "Chambre" ADD CONSTRAINT "Chambre_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionLogement" ADD CONSTRAINT "AttributionLogement_accorderParId_fkey" FOREIGN KEY ("accorderParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDepot" ADD CONSTRAINT "DocumentDepot_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDepot" ADD CONSTRAINT "DocumentDepot_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDepot" ADD CONSTRAINT "DocumentDepot_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDepot" ADD CONSTRAINT "DocumentDepot_deposeParId_fkey" FOREIGN KEY ("deposeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortefeuilleResto" ADD CONSTRAINT "PortefeuilleResto_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recharge" ADD CONSTRAINT "Recharge_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleResto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recharge" ADD CONSTRAINT "Recharge_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recharge" ADD CONSTRAINT "Recharge_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsommationResto" ADD CONSTRAINT "ConsommationResto_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleResto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsommationResto" ADD CONSTRAINT "ConsommationResto_valideurId_fkey" FOREIGN KEY ("valideurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSalle" ADD CONSTRAINT "ReservationSalle_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSalle" ADD CONSTRAINT "ReservationSalle_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSalle" ADD CONSTRAINT "ReservationSalle_refuseParId_fkey" FOREIGN KEY ("refuseParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailEncadre" ADD CONSTRAINT "TravailEncadre_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravailEncadre" ADD CONSTRAINT "TravailEncadre_encadrantId_fkey" FOREIGN KEY ("encadrantId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Soutenance" ADD CONSTRAINT "Soutenance_travailEncadreId_fkey" FOREIGN KEY ("travailEncadreId") REFERENCES "TravailEncadre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Soutenance" ADD CONSTRAINT "Soutenance_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Soutenance" ADD CONSTRAINT "Soutenance_presidentId_fkey" FOREIGN KEY ("presidentId") REFERENCES "Enseignant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_equipementId_fkey" FOREIGN KEY ("equipementId") REFERENCES "EquipementCampus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionFormation" ADD CONSTRAINT "InscriptionFormation_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionFormation" ADD CONSTRAINT "InscriptionFormation_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionFormation" ADD CONSTRAINT "InscriptionFormation_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

