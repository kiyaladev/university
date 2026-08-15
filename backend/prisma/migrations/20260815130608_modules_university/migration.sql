-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('BROUILLON', 'EN_ATTENTE_PAIEMENT', 'PAYEE', 'VALIDEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'REUSSI', 'ECHOUE', 'ANNULE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('MOBILE_MONEY', 'ESPECES', 'VIREMENT');

-- CreateEnum
CREATE TYPE "StatutPaie" AS ENUM ('BROUILLON', 'VALIDEE', 'PAYEE');

-- CreateEnum
CREATE TYPE "TypeEvaluation" AS ENUM ('CC', 'EXAMEN', 'RATTRAPAGE', 'ORAL', 'TP');

-- CreateEnum
CREATE TYPE "StatutEvaluation" AS ENUM ('OUVERTE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "SessionDeliberation" AS ENUM ('NORMALE', 'RATTRAPAGE');

-- CreateEnum
CREATE TYPE "StatutDeliberation" AS ENUM ('BROUILLON', 'VALIDEE');

-- CreateEnum
CREATE TYPE "DecisionJury" AS ENUM ('ADMIS', 'AJOURNE', 'DEFAILLANT');

-- CreateEnum
CREATE TYPE "TypeAttestation" AS ENUM ('SCOLARITE', 'SITUATION', 'REUSSITE', 'DIPLOME', 'ASSIDUITE');

-- CreateEnum
CREATE TYPE "StatutAttestation" AS ENUM ('EMISE', 'REVOQUEE');

-- CreateEnum
CREATE TYPE "StatutNotification" AS ENUM ('EN_ATTENTE', 'ENVOYEE', 'ECHOUE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ETUDIANT';

-- CreateTable
CREATE TABLE "Etudiant" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT,
    "dateNaissance" DATE,
    "lieuNaissance" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Etudiant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "statut" "StatutInscription" NOT NULL DEFAULT 'BROUILLON',
    "montantFrais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateInscription" TIMESTAMP(3),
    "valideeParId" TEXT,
    "valideeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Frais" (
    "id" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'GNF',
    "mode" "ModePaiement" NOT NULL DEFAULT 'MOBILE_MONEY',
    "operateur" TEXT,
    "telephone" TEXT,
    "nomComplet" TEXT,
    "motif" TEXT,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "transactionId" TEXT,
    "inscriptionId" TEXT,
    "etudiantId" TEXT,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completeLe" TIMESTAMP(3),
    "creeParId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "type" "TypeEvaluation" NOT NULL DEFAULT 'CC',
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "matiereId" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3),
    "statut" "StatutEvaluation" NOT NULL DEFAULT 'OUVERTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "note" DOUBLE PRECISION,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "saisieParId" TEXT,
    "saisieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliberation" (
    "id" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "session" "SessionDeliberation" NOT NULL DEFAULT 'NORMALE',
    "statut" "StatutDeliberation" NOT NULL DEFAULT 'BROUILLON',
    "tauxReussite" DOUBLE PRECISION,
    "commentaire" TEXT,
    "creeParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valideeParId" TEXT,
    "valideeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliberation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliberationLigne" (
    "id" TEXT NOT NULL,
    "deliberationId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "moyenne" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "decision" "DecisionJury" NOT NULL DEFAULT 'AJOURNE',
    "mention" TEXT,
    "rang" INTEGER,

    CONSTRAINT "DeliberationLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeAttestation" NOT NULL,
    "motif" TEXT,
    "statut" "StatutAttestation" NOT NULL DEFAULT 'EMISE',
    "qrToken" TEXT NOT NULL,
    "anneeId" TEXT,
    "promotionId" TEXT,
    "inscriptionId" TEXT,
    "etudiantId" TEXT,
    "emiseParId" TEXT,
    "emiseLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueeLe" TIMESTAMP(3),
    "revoqueeParId" TEXT,
    "motifRevocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAttestation" (
    "id" TEXT NOT NULL,
    "attestationId" TEXT NOT NULL,
    "ip" TEXT,
    "resultat" BOOLEAN NOT NULL DEFAULT true,
    "verifieeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeuillePaie" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "statut" "StatutPaie" NOT NULL DEFAULT 'BROUILLON',
    "montantTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creeParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valideeParId" TEXT,
    "valideeLe" TIMESTAMP(3),
    "payeeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "anneeAcademiqueId" TEXT,

    CONSTRAINT "FeuillePaie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LignePaie" (
    "id" TEXT NOT NULL,
    "feuilleId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "tauxHoraire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heuresReelles" INTEGER NOT NULL DEFAULT 0,
    "volumePrevu" INTEGER NOT NULL DEFAULT 0,
    "montantBrut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LignePaie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "motif" TEXT,
    "destinataireNom" TEXT,
    "etudiantId" TEXT,
    "statut" "StatutNotification" NOT NULL DEFAULT 'EN_ATTENTE',
    "envoyeParId" TEXT,
    "envoyeLe" TIMESTAMP(3),
    "erreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Etudiant_matricule_key" ON "Etudiant"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Etudiant_email_key" ON "Etudiant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Etudiant_userId_key" ON "Etudiant"("userId");

-- CreateIndex
CREATE INDEX "Etudiant_nom_prenom_idx" ON "Etudiant"("nom", "prenom");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_numero_key" ON "Inscription"("numero");

-- CreateIndex
CREATE INDEX "Inscription_statut_idx" ON "Inscription"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_etudiantId_anneeId_key" ON "Inscription"("etudiantId", "anneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Frais_anneeId_promotionId_key" ON "Frais"("anneeId", "promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- CreateIndex
CREATE INDEX "Paiement_statut_idx" ON "Paiement"("statut");

-- CreateIndex
CREATE INDEX "Paiement_inscriptionId_idx" ON "Paiement"("inscriptionId");

-- CreateIndex
CREATE INDEX "Paiement_horodatage_idx" ON "Paiement"("horodatage");

-- CreateIndex
CREATE INDEX "Evaluation_matiereId_idx" ON "Evaluation"("matiereId");

-- CreateIndex
CREATE INDEX "Evaluation_promotionId_idx" ON "Evaluation"("promotionId");

-- CreateIndex
CREATE INDEX "Note_inscriptionId_idx" ON "Note"("inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_evaluationId_inscriptionId_key" ON "Note"("evaluationId", "inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Deliberation_anneeId_promotionId_session_key" ON "Deliberation"("anneeId", "promotionId", "session");

-- CreateIndex
CREATE UNIQUE INDEX "DeliberationLigne_deliberationId_inscriptionId_key" ON "DeliberationLigne"("deliberationId", "inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_numero_key" ON "Attestation"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_qrToken_key" ON "Attestation"("qrToken");

-- CreateIndex
CREATE INDEX "Attestation_type_statut_idx" ON "Attestation"("type", "statut");

-- CreateIndex
CREATE INDEX "VerificationAttestation_verifieeLe_idx" ON "VerificationAttestation"("verifieeLe");

-- CreateIndex
CREATE UNIQUE INDEX "FeuillePaie_libelle_key" ON "FeuillePaie"("libelle");

-- CreateIndex
CREATE INDEX "FeuillePaie_statut_idx" ON "FeuillePaie"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "LignePaie_feuilleId_enseignantId_key" ON "LignePaie"("feuilleId", "enseignantId");

-- CreateIndex
CREATE INDEX "Notification_statut_idx" ON "Notification"("statut");

-- CreateIndex
CREATE INDEX "Notification_telephone_idx" ON "Notification"("telephone");

-- AddForeignKey
ALTER TABLE "Etudiant" ADD CONSTRAINT "Etudiant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_valideeParId_fkey" FOREIGN KEY ("valideeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_saisieParId_fkey" FOREIGN KEY ("saisieParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliberation" ADD CONSTRAINT "Deliberation_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliberation" ADD CONSTRAINT "Deliberation_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliberation" ADD CONSTRAINT "Deliberation_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliberation" ADD CONSTRAINT "Deliberation_valideeParId_fkey" FOREIGN KEY ("valideeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliberationLigne" ADD CONSTRAINT "DeliberationLigne_deliberationId_fkey" FOREIGN KEY ("deliberationId") REFERENCES "Deliberation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliberationLigne" ADD CONSTRAINT "DeliberationLigne_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_anneeId_fkey" FOREIGN KEY ("anneeId") REFERENCES "AnneeAcademique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_emiseParId_fkey" FOREIGN KEY ("emiseParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_revoqueeParId_fkey" FOREIGN KEY ("revoqueeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAttestation" ADD CONSTRAINT "VerificationAttestation_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "Attestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeuillePaie" ADD CONSTRAINT "FeuillePaie_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeuillePaie" ADD CONSTRAINT "FeuillePaie_valideeParId_fkey" FOREIGN KEY ("valideeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeuillePaie" ADD CONSTRAINT "FeuillePaie_anneeAcademiqueId_fkey" FOREIGN KEY ("anneeAcademiqueId") REFERENCES "AnneeAcademique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LignePaie" ADD CONSTRAINT "LignePaie_feuilleId_fkey" FOREIGN KEY ("feuilleId") REFERENCES "FeuillePaie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LignePaie" ADD CONSTRAINT "LignePaie_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Enseignant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_envoyeParId_fkey" FOREIGN KEY ("envoyeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
